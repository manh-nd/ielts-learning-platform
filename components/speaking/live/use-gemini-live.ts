"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  LiveSessionStatus,
  LiveSpeakingState,
  VoiceActivityState,
  ExamStage,
  Part2Phase,
  CueCardData,
  TranscriptItem,
  LiveSpeakingConfig,
  UseGeminiLiveReturn,
  RecordedAudioData,
  ConversationReplayData,
  FinalizedLiveSessionAudio,
  CandidateTurnMarker,
} from "./types";
import type { SpeakingLiveExaminerAction } from "@/modules/speaking/application/ports/speaking-live-examiner.port";
import { PcmAudioController } from "@/lib/audio/pcm-audio-controller";
import { ConversationReplayRecorder } from "@/lib/audio/conversation-replay-recorder";
import { LiveSessionCoordinator } from "./live-session-coordinator";
import {
  playCallStartSound,
  playCallEndSound,
} from "@/lib/audio/interface-sounds";
import {
  GLOBAL_EXAM_GUARD_PROMPT,
  VOICE_ANCHOR_PROMPT,
  sanitizeTranscriptText,
} from "@/lib/audio/live-guards";
import { resolvePart1TurnLineage } from "@/modules/speaking/domain";
import {
  useLiveAudioRecorder,
  getSupportedMediaRecorderMimeType,
  pcmBase64ChunksToWavBlob,
} from "./hooks/use-live-audio-recorder";

export { getSupportedMediaRecorderMimeType, pcmBase64ChunksToWavBlob };

/**
 * Determines whether a microphone initialization error represents a permission denial.
 */
export function isPermissionDeniedError(err: unknown): boolean {
  if (!err) return false;
  const errName = (err as Error)?.name || "";
  const errMsg = (err as Error)?.message || "";
  return (
    errName === "NotAllowedError" ||
    errName === "PermissionDeniedError" ||
    errMsg.toLowerCase().includes("permission") ||
    errMsg.toLowerCase().includes("denied")
  );
}

export function buildExaminerSystemInstruction(
  candidateName?: string,
  topic?: LiveSpeakingConfig["topic"],
  targetPart: LiveSpeakingConfig["targetPart"] = "full"
): string {
  const isPart1Only = targetPart === "part1" || targetPart === "part_1";
  let topicSpecifics = "";

  if (topic) {
    if (isPart1Only) {
      topicSpecifics = `
EXAMINATION TOPIC & QUESTIONS (PART 1 PRACTICE ONLY):
Theme: "${topic.title}" (${topic.category})

PART 1: "${topic.part1.theme}"
Questions (ask strictly ONE at a time, in order):
${topic.part1.questions.map((q, idx) => `  Question ${idx + 1}: "${typeof q === "string" ? q : q.text}"`).join("\n")}

CONCLUDING PART 1 PRACTICE:
After the candidate finishes answering the final Part 1 question (Question ${topic.part1.questions.length}), say: "Thank you very much. That concludes your Part 1 Speaking practice session." and IMMEDIATELY CALL THE TOOL 'end_exam'.
Do NOT move to Part 2 or Part 3.
`;
    } else {
      topicSpecifics = `
EXAMINATION TOPIC & QUESTIONS:
Theme: "${topic.title}" (${topic.category})

PART 1: "${topic.part1.theme}"
Questions (ask strictly ONE at a time, in order):
${topic.part1.questions.map((q, idx) => `  Question ${idx + 1}: "${typeof q === "string" ? q : q.text}"`).join("\n")}

PART 2 CUE CARD:
When Part 1 is finished, say "Thank you. Now let's move to Part 2 of the test. I will show you a cue card." and CALL THE TOOL 'display_cue_card'.
Topic Title: "${topic.part2.topicTitle}"
Prompt: "${topic.part2.cueCardPrompt}"
Bullet points:
${topic.part2.bulletPoints.map((bp) => `  - ${bp}`).join("\n")}
Follow-up: "${topic.part2.followUpQuestion || "Do you have anything else to add?"}"
Action: Call 'display_cue_card'. Wait silently while candidate prepares. When told candidate is ready, say "Your preparation time is up. Please begin your 2-minute talk now." After candidate finishes speaking, ask follow-up, then CALL THE TOOL 'start_part_3'.

PART 3: "${topic.part3.theme}"
Questions (ask strictly ONE at a time):
${topic.part3.questions.map((q, idx) => `  Question ${idx + 1}: "${q}"`).join("\n")}
After Part 3, say "Thank you very much. That concludes your IELTS Speaking examination." and CALL THE TOOL 'end_exam'.
`;
    }
  }

  return `
Role: Senior IELTS Speaking Examiner (Dr. Harrison).
Goal: ${isPart1Only ? "Conduct a focused, high-fidelity IELTS Speaking Part 1 practice session." : "Conduct a structured, realistic IELTS Speaking examination (Part 1, Part 2, and Part 3)."}
${candidateName ? `The candidate's name is ${candidateName}.` : "Address the candidate formally."}

CRITICAL TURN-TAKING & PACING RULES:
1. Ask EXACTLY ONE question per turn. Keep each prompt short (1-2 sentences). Never answer for the candidate or combine multiple questions into a single turn.
2. START OF TEST: Start with: "Good day. My name is Dr. Harrison, and I will be your IELTS Examiner today. Could you please tell me your full name?"
3. STOP TALKING immediately after asking for the candidate's name. Wait for the candidate to respond.
4. Only AFTER the candidate tells you their name, say "Thank you. Let's begin Part 1." and ask Question 1 of Part 1.
5. In Part 1: Ask each question individually. Always wait for the candidate's complete answer before asking the next question.
${isPart1Only ? `6. After candidate finishes Question ${topic?.part1.questions.length || 3}, conclude the session and call 'end_exam'.` : "6. Move through Part 1 -> Part 2 -> Part 3 as specified."}

${topicSpecifics}

${GLOBAL_EXAM_GUARD_PROMPT}

${VOICE_ANCHOR_PROMPT}
`.trim();
}

export function useGeminiLive(
  config: LiveSpeakingConfig = {}
): UseGeminiLiveReturn {
  const {
    examinerPort,
    candidateName,
    topic,
    targetPart = "full",
    systemInstruction,
    mockMode = false,
    enableNoiseSuppression = true,
    onStatusChange,
    onStageChange,
    onError,
    onTranscriptUpdate,
    onExamCompleted,
  } = config;

  const examinerPortRef = useRef(examinerPort);
  useEffect(() => {
    examinerPortRef.current = examinerPort;
  }, [examinerPort]);
  const portUnsubscribeRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [speakingState, setSpeakingState] = useState<LiveSpeakingState>({
    kind: "idle",
  });
  const [voiceActivity, setVoiceActivity] =
    useState<VoiceActivityState>("idle");
  const [examStage, setExamStage] = useState<ExamStage>(1);
  const [part2Phase, setPart2Phase] = useState<Part2Phase>("idle");
  const [cueCardData, setCueCardData] = useState<CueCardData | null>(
    topic
      ? {
          topicTitle: topic.part2.topicTitle,
          cueCardPrompt: topic.part2.cueCardPrompt,
          bulletPoints: topic.part2.bulletPoints,
          followUpQuestion: topic.part2.followUpQuestion,
        }
      : null
  );
  const [prepTimeRemaining, setPrepTimeRemaining] = useState<number>(60);
  const [scratchpadNotes, setScratchpadNotes] = useState<string>("");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [turnMarkers, setTurnMarkers] = useState<CandidateTurnMarker[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [conversationReplay, setConversationReplay] =
    useState<ConversationReplayData | null>(null);

  // References
  const coordinatorRef = useRef<LiveSessionCoordinator | null>(null);
  const conversationReplayRecorderRef =
    useRef<ConversationReplayRecorder | null>(null);

  const recordStartTimeRef = useRef<number>(0);
  const turnMarkersRef = useRef<CandidateTurnMarker[]>([]);
  const currentTurnStartMsRef = useRef<number>(0);
  const currentTurnIndexRef = useRef<number>(0);

  const audioControllerRef = useRef<PcmAudioController | null>(null);
  const isMutedRef = useRef<boolean>(false);
  const mockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const nudgeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<LiveSessionStatus>("idle");
  const hasConnectedRef = useRef<boolean>(false);
  const examStageRef = useRef<ExamStage>(1);
  const currentTurnTextRef = useRef<{ user: string; examiner: string }>({
    user: "",
    examiner: "",
  });
  const committedTranscriptsRef = useRef<TranscriptItem[]>([]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    examStageRef.current = examStage;
  }, [examStage]);

  const requestWakeLock = useCallback(async () => {
    if (typeof window !== "undefined" && "wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch (err) {
        console.warn(
          "[useGeminiLive] Could not acquire Screen Wake Lock:",
          err
        );
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.warn(
          "[useGeminiLive] Could not release Screen Wake Lock:",
          err
        );
      }
    }
  }, []);

  const addTranscript = useCallback(
    (sender: "user" | "examiner", text: string, isFinal = true) => {
      const sanitized = sanitizeTranscriptText(text);
      if (!sanitized) return;

      const newItem: TranscriptItem = {
        id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sender,
        text: sanitized,
        timestamp: Date.now(),
        isFinal,
      };

      setTranscripts((prev) => [...prev, newItem]);
      onTranscriptUpdate?.([...transcripts, newItem]);
    },
    [onTranscriptUpdate, transcripts]
  );

  const updateTranscriptStream = useCallback(() => {
    const current = [...committedTranscriptsRef.current];

    if (currentTurnTextRef.current.user) {
      current.push({
        id: `streaming_user_${Date.now()}`,
        sender: "user",
        text: currentTurnTextRef.current.user,
        timestamp: Date.now(),
        isFinal: false,
      });
    }

    if (currentTurnTextRef.current.examiner) {
      current.push({
        id: `streaming_examiner_${Date.now()}`,
        sender: "examiner",
        text: currentTurnTextRef.current.examiner,
        timestamp: Date.now(),
        isFinal: false,
      });
    }

    setTranscripts(current);
    onTranscriptUpdate?.(current);
  }, [onTranscriptUpdate]);

  const recordTurnMarker = useCallback(
    (userText: string) => {
      const nowMs = Date.now() - recordStartTimeRef.current;
      const startMs =
        currentTurnStartMsRef.current || Math.max(0, nowMs - 5000);
      const endMs = Math.max(startMs + 100, nowMs);
      const turnIndex = currentTurnIndexRef.current;
      currentTurnIndexRef.current += 1;

      const lineage = resolvePart1TurnLineage({
        turnIndex,
        questions: topic ? topic.part1.questions : undefined,
      });

      const marker: CandidateTurnMarker = {
        partNumber:
          examStageRef.current === "completed" ? 3 : examStageRef.current,
        itemIndex: turnIndex,
        promptQuestion: lineage.promptQuestion,
        questionId: lineage.questionId,
        turnKind: lineage.turnKind,
        startMs,
        endMs,
        liveTranscript: userText,
      };

      currentTurnStartMsRef.current = 0;

      turnMarkersRef.current = [...turnMarkersRef.current, marker];
      setTurnMarkers([...turnMarkersRef.current]);
    },
    [topic]
  );

  const commitCurrentTurn = useCallback(() => {
    let hasCommitted = false;

    if (currentTurnTextRef.current.user.trim()) {
      const userText = sanitizeTranscriptText(currentTurnTextRef.current.user);
      if (userText) {
        committedTranscriptsRef.current.push({
          id: `tr_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          sender: "user",
          text: userText,
          timestamp: Date.now(),
          isFinal: true,
        });
        recordTurnMarker(userText);
        hasCommitted = true;
      }
    }

    if (currentTurnTextRef.current.examiner.trim()) {
      const examinerText = sanitizeTranscriptText(
        currentTurnTextRef.current.examiner
      );
      if (examinerText) {
        committedTranscriptsRef.current.push({
          id: `tr_examiner_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          sender: "examiner",
          text: examinerText,
          timestamp: Date.now(),
          isFinal: true,
        });
        hasCommitted = true;
      }
    }

    currentTurnTextRef.current = { user: "", examiner: "" };

    if (hasCommitted) {
      const updated = [...committedTranscriptsRef.current];
      setTranscripts(updated);
      onTranscriptUpdate?.(updated);
    } else {
      updateTranscriptStream();
    }
  }, [onTranscriptUpdate, recordTurnMarker, updateTranscriptStream]);

  const clearNudgeTimer = useCallback(() => {
    if (nudgeTimerRef.current) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }, []);

  const {
    startRecording: startAudioRecording,
    finalizeRecording,
    cleanup: cleanupRecorder,
    isMuted,
    toggleMute: toggleRecorderMute,
    isNoiseSuppressionActive,
    toggleNoiseSuppression,
    inputVolume,
    recordedAudio,
    resetRecording,
  } = useLiveAudioRecorder({
    enableNoiseSuppression,
    onMicLevel: (level) => {
      if (
        level > 0.04 &&
        statusRef.current === "connected" &&
        !isMutedRef.current
      ) {
        clearNudgeTimer();
        if (currentTurnStartMsRef.current === 0) {
          currentTurnStartMsRef.current = Math.max(
            0,
            Date.now() - recordStartTimeRef.current
          );
        }
        setVoiceActivity((curr) =>
          curr === "ai_speaking" ? curr : "user_speaking"
        );
        setSpeakingState({ kind: "user-speaking" });
      } else if (level <= 0.04) {
        setVoiceActivity((curr) => (curr === "user_speaking" ? "idle" : curr));
      }
    },
    onMuteChange: (muted) => {
      if (muted) {
        examinerPortRef.current?.endCandidateAudio();
      }
    },
  });

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const startNudgeTimer = useCallback(() => {
    clearNudgeTimer();
    if (examStage === 2 && part2Phase === "prep_countdown") return;

    nudgeTimerRef.current = setTimeout(() => {
      if (statusRef.current === "connected") {
        examinerPortRef.current?.sendText({
          text: `[System: The candidate has been silent for more than 9 seconds. As an encouraging senior IELTS examiner, gently prompt them: "Would you like me to repeat the question?" or provide a natural short hint to keep the conversation flowing.]`,
        });
      }
    }, 9000);
  }, [clearNudgeTimer, examStage, part2Phase]);

  const updateStatus = useCallback(
    (newStatus: LiveSessionStatus) => {
      statusRef.current = newStatus;
      setStatus(newStatus);
      onStatusChange?.(newStatus);
      if (newStatus === "connecting" || newStatus === "requesting_token") {
        setSpeakingState({ kind: "connecting" });
      } else if (newStatus === "connected") {
        setSpeakingState({ kind: "listening" });
      } else if (newStatus === "idle") {
        setSpeakingState({ kind: "idle" });
      } else if (newStatus === "error") {
        setSpeakingState({ kind: "failed", reason: "Connection failed" });
      }
    },
    [onStatusChange]
  );

  const updateStage = useCallback(
    (newStage: ExamStage) => {
      setExamStage(newStage);
      onStageChange?.(newStage);
    },
    [onStageChange]
  );

  const cleanupAudio = useCallback(() => {
    if (mockTimerRef.current) {
      clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }

    if (prepIntervalRef.current) {
      clearInterval(prepIntervalRef.current);
      prepIntervalRef.current = null;
    }

    cleanupRecorder();

    if (audioControllerRef.current) {
      audioControllerRef.current.close();
      audioControllerRef.current = null;
    }

    if (portUnsubscribeRef.current) {
      portUnsubscribeRef.current();
      portUnsubscribeRef.current = null;
    }

    if (examinerPortRef.current) {
      examinerPortRef.current.disconnect().catch(() => {});
    }

    clearNudgeTimer();
    releaseWakeLock();

    if (statusRef.current === "connected") {
      playCallEndSound();
    }

    setVoiceActivity("idle");
  }, [cleanupRecorder, clearNudgeTimer, releaseWakeLock]);

  const resetSessionLifecycle = useCallback(() => {
    coordinatorRef.current = null;

    if (conversationReplayRecorderRef.current) {
      conversationReplayRecorderRef.current.disableAndReleaseBuffers();
      conversationReplayRecorderRef.current = null;
    }

    setConversationReplay(null);
  }, []);

  const finalizeLiveSession = useCallback(
    async (
      triggerReason: "learner_finish" | "ai_completed" = "learner_finish"
    ): Promise<FinalizedLiveSessionAudio> => {
      if (!coordinatorRef.current) {
        const audio = await finalizeRecording();
        return { recordedAudio: audio, conversationReplay: null };
      }

      const finalized =
        await coordinatorRef.current.finalizeLiveSession(triggerReason);

      if (finalized.conversationReplay) {
        setConversationReplay(finalized.conversationReplay);
      }

      return finalized;
    },
    [finalizeRecording]
  );

  const finishPart2PrepEarly = useCallback(() => {
    if (prepIntervalRef.current) {
      clearInterval(prepIntervalRef.current);
      prepIntervalRef.current = null;
    }
    setPrepTimeRemaining(0);
    setPart2Phase("speaking");

    examinerPortRef.current?.sendText({
      text: "[System: The candidate's 1-minute preparation time is over. As the IELTS Examiner, please say: 'Your preparation time is up. Please begin your 2-minute talk now.' and listen carefully.]",
    });
  }, []);

  const handleExaminerAction = useCallback(
    (action: SpeakingLiveExaminerAction) => {
      if (action.type === "display_cue_card_requested") {
        updateStage(2);
        setPart2Phase("prep_countdown");
        setPrepTimeRemaining(60);
        currentTurnIndexRef.current = 0;

        setCueCardData({
          topicTitle:
            action.topicTitle || topic?.part2.topicTitle || "Cue Card Topic",
          cueCardPrompt:
            action.cueCardPrompt || topic?.part2.cueCardPrompt || "",
          bulletPoints:
            (action.bulletPoints as string[]) ||
            topic?.part2.bulletPoints ||
            [],
          followUpQuestion: topic?.part2.followUpQuestion,
        });

        if (action.requestId) {
          examinerPortRef.current?.respondToExaminerAction({
            requestId: action.requestId,
            status: "cue_card_displayed_prep_started",
            message:
              "Cue card is displayed on screen. Candidate is preparing notes.",
            metadata: { prepTimeSeconds: 60 },
          });
        }

        if (prepIntervalRef.current) clearInterval(prepIntervalRef.current);
        prepIntervalRef.current = setInterval(() => {
          setPrepTimeRemaining((prev) => {
            if (prev <= 1) {
              if (prepIntervalRef.current) {
                clearInterval(prepIntervalRef.current);
                prepIntervalRef.current = null;
              }
              setPart2Phase("speaking");
              finishPart2PrepEarly();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (action.type === "part_3_start_requested") {
        if (prepIntervalRef.current) {
          clearInterval(prepIntervalRef.current);
          prepIntervalRef.current = null;
        }
        updateStage(3);
        setPart2Phase("idle");
        currentTurnIndexRef.current = 0;

        if (action.requestId) {
          examinerPortRef.current?.respondToExaminerAction({
            requestId: action.requestId,
            status: "part_3_active",
            message: "UI in Part 3 mode. Continue with discussion questions.",
          });
        }
      } else if (action.type === "practice_end_requested") {
        updateStage("completed");
        setPart2Phase("idle");

        if (action.requestId) {
          examinerPortRef.current?.respondToExaminerAction({
            requestId: action.requestId,
            status: "exam_completed",
            message: "Session concluded. Ready for evaluation.",
          });
        }

        if (mockMode) {
          void finalizeLiveSession("ai_completed").then(() => {
            onExamCompleted?.();
          });
          return;
        }

        coordinatorRef.current?.handleEndExam(onExamCompleted, 5000);
      }
    },
    [
      finishPart2PrepEarly,
      finalizeLiveSession,
      mockMode,
      onExamCompleted,
      topic,
      updateStage,
    ]
  );

  const runMockSimulation = useCallback(() => {
    updateStatus("connected");
    updateStage(1);
    setError(null);

    setTimeout(() => {
      addTranscript(
        "examiner",
        `Good day, ${candidateName || "Candidate"}. My name is Dr. Harrison, and I will be your IELTS Examiner today for the topic '${topic?.title || "Technology"}'. Could you please tell me your full name?`
      );
    }, 1000);

    let step = 0;
    const mockEvents = [
      {
        delay: 4000,
        action: () => {
          setVoiceActivity("user_speaking");
          addTranscript(
            "user",
            `My name is Nguyen Van Manh. I'm excited to take the test today.`
          );
        },
      },
      {
        delay: 7000,
        action: () => {
          setVoiceActivity("ai_speaking");
          const q0 = topic?.part1.questions[0];
          const text0 = typeof q0 === "string" ? q0 : q0?.text;
          addTranscript(
            "examiner",
            text0 ||
              "What kind of technological devices do you use most frequently every day?"
          );
        },
      },
      {
        delay: 11000,
        action: () => {
          setVoiceActivity("user_speaking");
          addTranscript(
            "user",
            "I frequently use my laptop and smartphone for both software development and academic research."
          );
        },
      },
      {
        delay: 14000,
        action: () => {
          setVoiceActivity("ai_speaking");
          addTranscript(
            "examiner",
            "Thank you. Now we shall move on to Part 2 of the test. I will present a cue card with your topic."
          );
          handleExaminerAction({
            type: "display_cue_card_requested",
            requestId: "mock-call-part2",
            topicTitle:
              topic?.part2.topicTitle || "A significant piece of technology",
            cueCardPrompt:
              topic?.part2.cueCardPrompt ||
              "Describe a technological device that changed your life.",
            bulletPoints: topic?.part2.bulletPoints || [
              "What it is",
              "When you got it",
              "Why it matters",
            ],
          });
        },
      },
    ];

    mockTimerRef.current = setInterval(() => {
      if (step < mockEvents.length) {
        mockEvents[step].action();
        step++;
      }
    }, 3500);
  }, [
    addTranscript,
    candidateName,
    handleExaminerAction,
    topic,
    updateStage,
    updateStatus,
  ]);

  const connect = useCallback(async () => {
    cleanupAudio();
    resetRecording();
    resetSessionLifecycle();
    setError(null);
    currentTurnTextRef.current = { user: "", examiner: "" };
    committedTranscriptsRef.current = [];
    turnMarkersRef.current = [];
    setTranscripts([]);
    setTurnMarkers([]);
    recordStartTimeRef.current = Date.now();
    hasConnectedRef.current = false;
    currentTurnStartMsRef.current = 0;
    currentTurnIndexRef.current = 0;
    updateStage(1);
    setPart2Phase("idle");

    const coordinator = new LiveSessionCoordinator({
      clock: () =>
        typeof performance !== "undefined" ? performance.now() : Date.now(),
      onStatusChange: (s) => updateStatus(s),
      onEnded: () => setSpeakingState({ kind: "ended" }),
      finalizeRecording,
      cleanupAudio,
    });
    coordinatorRef.current = coordinator;

    const controller = new PcmAudioController();
    audioControllerRef.current = controller;

    coordinator.startSession(controller, (epoch) => {
      const replayRecorder = new ConversationReplayRecorder({
        sessionEpochMs: epoch,
      });
      conversationReplayRecorderRef.current = replayRecorder;
      return replayRecorder;
    });

    if (mockMode) {
      runMockSimulation();
      return;
    }

    const currentPort = examinerPortRef.current;
    if (!currentPort) {
      const err = new Error(
        "SpeakingLiveExaminerPort must be provided for live speaking sessions."
      );
      setError(err);
      updateStatus("error");
      onError?.(err);
      return;
    }

    updateStatus("requesting_token");
    updateStatus("connecting");
    recordStartTimeRef.current = Date.now();

    controller.onSpeakerLevel((level) => {
      if (level > 0.01) {
        setVoiceActivity("ai_speaking");
        setSpeakingState({ kind: "model-speaking" });
      } else {
        setVoiceActivity((curr) => (curr === "ai_speaking" ? "idle" : curr));
      }
    });

    try {
      await startAudioRecording(
        controller,
        (base64Pcm, rms) => {
          if (statusRef.current === "connected" && !isMutedRef.current) {
            const elapsedMs = Date.now() - recordStartTimeRef.current;

            if (elapsedMs < 3000) {
              return;
            }

            if (controller.isPlaying() && rms < 0.03) {
              return;
            }

            currentPort.sendCandidateAudio({
              audioBase64: base64Pcm,
              mimeType: "audio/pcm;rate=16000",
            });
          }
        },
        (rawInt16) => {
          conversationReplayRecorderRef.current?.addLearnerChunk(rawInt16);
        }
      );
      coordinator.anchorMicCapture();
    } catch (micErr: unknown) {
      console.error("[useGeminiLive] Failed to start microphone:", micErr);
      const isDenied = isPermissionDeniedError(micErr);

      const err = new Error(
        isDenied
          ? "Quyền microphone bị từ chối. Vui lòng cấp quyền để tiếp tục."
          : "Không thể truy cập Microphone. Vui lòng kiểm tra thiết bị."
      );
      Object.assign(err, { isMicDenied: isDenied });
      setError(err);
      updateStatus(isDenied ? "permission_denied" : "error");
      onError?.(err);
      cleanupAudio();
      return;
    }

    if (portUnsubscribeRef.current) {
      portUnsubscribeRef.current();
    }

    portUnsubscribeRef.current = currentPort.subscribe((evt) => {
      if (evt.type === "connected") {
        hasConnectedRef.current = true;
        updateStatus("connected");
        playCallStartSound();
        requestWakeLock().catch(() => {});
        currentPort.sendText({
          text: "Hello. Please initiate the IELTS Speaking examination according to your instructions.",
        });
      } else if (evt.type === "disconnected") {
        updateStatus("idle");
      } else if (evt.type === "connection_failed") {
        const err = new Error(evt.reason || "Connection failed");
        setError(err);
        updateStatus("error");
        onError?.(err);
        if (!hasConnectedRef.current) {
          cleanupAudio();
        }
      } else if (evt.type === "examiner_audio_chunk") {
        clearNudgeTimer();
        audioControllerRef.current?.playAudioChunk(evt.audioBase64, (info) => {
          coordinatorRef.current?.acceptExaminerPcm(
            info.pcm,
            info.scheduledStartTimeMs,
            info.durationMs
          );
        });
      } else if (evt.type === "examiner_transcript_updated") {
        const clean = sanitizeTranscriptText(evt.text);
        if (clean) {
          currentTurnTextRef.current.examiner += clean;
          updateTranscriptStream();
        }
      } else if (evt.type === "candidate_transcript_updated") {
        const clean = sanitizeTranscriptText(evt.text);
        if (clean) {
          currentTurnTextRef.current.user += clean;
          updateTranscriptStream();
        }
      } else if (evt.type === "candidate_interrupted_examiner") {
        coordinatorRef.current?.handleInterruption();
        commitCurrentTurn();
        clearNudgeTimer();
        setSpeakingState({ kind: "user-speaking" });
      } else if (evt.type === "live_turn_completed") {
        commitCurrentTurn();
        startNudgeTimer();
        setSpeakingState({ kind: "listening" });
        coordinatorRef.current?.handleTurnComplete(onExamCompleted);
      } else if (evt.type === "examiner_action_requested") {
        handleExaminerAction(evt.action);
      }
    });

    const effectiveInstruction =
      systemInstruction ||
      buildExaminerSystemInstruction(candidateName, topic, targetPart);

    try {
      await currentPort.connect({ systemInstruction: effectiveInstruction });
    } catch (connErr) {
      console.error("[useGeminiLive] currentPort.connect error:", connErr);
      if (!hasConnectedRef.current) {
        const err =
          (connErr as Error) || new Error("Initial connection failed");
        setError(err);
        updateStatus("error");
        onError?.(err);
        cleanupAudio();
      }
    }
  }, [
    candidateName,
    cleanupAudio,
    commitCurrentTurn,
    clearNudgeTimer,
    finalizeRecording,
    handleExaminerAction,
    mockMode,
    onError,
    onExamCompleted,
    requestWakeLock,
    resetRecording,
    resetSessionLifecycle,
    runMockSimulation,
    startAudioRecording,
    startNudgeTimer,
    systemInstruction,
    targetPart,
    topic,
    updateStage,
    updateStatus,
    updateTranscriptStream,
  ]);

  const disconnect =
    useCallback(async (): Promise<RecordedAudioData | null> => {
      const finalized = await finalizeLiveSession("learner_finish");
      return finalized.recordedAudio;
    }, [finalizeLiveSession]);

  const toggleMute = useCallback(() => {
    toggleRecorderMute();
  }, [toggleRecorderMute]);

  const sendTextMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    if (examinerPortRef.current) {
      examinerPortRef.current.sendText({ text });
    }
  }, []);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setTurnMarkers([]);
  }, []);

  const triggerMockStageChange = useCallback(
    (stage: ExamStage) => {
      updateStage(stage);
    },
    [updateStage]
  );

  return {
    status,
    speakingState,
    voiceActivity,
    examStage,
    part2Phase,
    cueCardData,
    prepTimeRemaining,
    scratchpadNotes,
    transcripts,
    turnMarkers,
    error,
    isMuted,
    isNoiseSuppressionActive,
    inputVolume,
    recordedAudio,
    conversationReplay,
    connect,
    disconnect,
    finalizeLiveSession,
    toggleMute,
    toggleNoiseSuppression,
    setScratchpadNotes,
    finishPart2PrepEarly,
    sendTextMessage,
    clearTranscripts,
    triggerMockStageChange,
  };
}
