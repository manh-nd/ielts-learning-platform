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
  CandidateTurnMarker,
} from "./types";
import { PcmAudioController } from "@/lib/audio/pcm-audio-controller";
import {
  playCallStartSound,
  playCallEndSound,
} from "@/lib/audio/interface-sounds";
import {
  GLOBAL_EXAM_GUARD_PROMPT,
  VOICE_ANCHOR_PROMPT,
  sanitizeTranscriptText,
} from "@/lib/audio/live-guards";

export interface ParsedLiveMessage {
  type:
    | "setupComplete"
    | "toolCall"
    | "serverContent"
    | "goAway"
    | "sessionResumptionUpdate"
    | "unknown";
  toolCalls?: Array<{
    id?: string;
    name: string;
    args?: Record<string, unknown>;
  }>;
  serverContent?: Record<string, unknown>;
  goAway?: Record<string, unknown>;
  resumptionHandle?: string;
}
import {
  useLiveAudioRecorder,
  getSupportedMediaRecorderMimeType,
  pcmBase64ChunksToWavBlob,
} from "./hooks/use-live-audio-recorder";

export { getSupportedMediaRecorderMimeType, pcmBase64ChunksToWavBlob };

export function parseLiveServerMessage(raw: unknown): ParsedLiveMessage {
  if (typeof raw !== "object" || raw === null) {
    return { type: "unknown" };
  }
  const obj = raw as {
    setupComplete?: Record<string, unknown>;
    toolCall?: {
      functionCalls?: Array<{
        id?: string;
        name: string;
        args?: Record<string, unknown>;
      }>;
    };
    serverContent?: Record<string, unknown> & {
      toolCall?: {
        functionCalls?: Array<{
          id?: string;
          name: string;
          args?: Record<string, unknown>;
        }>;
      };
    };
    goAway?: Record<string, unknown>;
    sessionResumptionUpdate?: {
      newHandle?: string;
      resumptionHandle?: string;
    };
  };

  if (obj.setupComplete) {
    return { type: "setupComplete" };
  }

  if (obj.sessionResumptionUpdate) {
    return {
      type: "sessionResumptionUpdate",
      resumptionHandle:
        obj.sessionResumptionUpdate.newHandle ||
        obj.sessionResumptionUpdate.resumptionHandle,
    };
  }

  const toolCalls =
    obj.toolCall?.functionCalls || obj.serverContent?.toolCall?.functionCalls;
  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    return {
      type: "toolCall",
      toolCalls,
      serverContent: obj.serverContent,
    };
  }

  if (obj.serverContent) {
    return {
      type: "serverContent",
      serverContent: obj.serverContent,
    };
  }

  if (obj.goAway) {
    return {
      type: "goAway",
      goAway: obj.goAway,
    };
  }

  return { type: "unknown" };
}

export function buildToolResponse(
  callId: string,
  functionName: string,
  output: Record<string, unknown>
) {
  return {
    toolResponse: {
      functionResponses: [
        {
          id: callId,
          name: functionName,
          response: {
            output,
          },
        },
      ],
    },
  };
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
${topic.part1.questions.map((q, idx) => `  Question ${idx + 1}: "${q}"`).join("\n")}

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
${topic.part1.questions.map((q, idx) => `  Question ${idx + 1}: "${q}"`).join("\n")}

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
    candidateName,
    topic,
    targetPart = "full",
    systemInstruction,
    voiceName = "Puck",
    tokenEndpoint = "/api/speaking/live-token",
    mockMode = false,
    enableNoiseSuppression = true,
    onStatusChange,
    onStageChange,
    onError,
    onTranscriptUpdate,
    onExamCompleted,
  } = config;

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

  // References
  const recordStartTimeRef = useRef<number>(0);
  const turnMarkersRef = useRef<CandidateTurnMarker[]>([]);
  const currentTurnStartMsRef = useRef<number>(0);
  const currentTurnIndexRef = useRef<number>(0);
  const latestResumptionHandleRef = useRef<string | null>(null);

  const audioControllerRef = useRef<PcmAudioController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMutedRef = useRef<boolean>(false);
  const mockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeToolCallIdRef = useRef<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const nudgeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<LiveSessionStatus>("idle");
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
    try {
      if (typeof window !== "undefined" && "wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (err) {
      console.warn("[useGeminiLive] Could not acquire Screen Wake Lock:", err);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {
      console.warn("[useGeminiLive] Could not release Screen Wake Lock:", err);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        document.visibilityState === "visible" &&
        statusRef.current === "connected"
      ) {
        await requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  const clearNudgeTimer = useCallback(() => {
    if (nudgeTimerRef.current) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }, []);

  const {
    isMuted,
    isNoiseSuppressionActive,
    inputVolume,
    recordedAudio,
    startRecording: startAudioRecording,
    finalizeRecording,
    resetRecording,
    toggleMute: toggleRecorderMute,
    toggleNoiseSuppression,
    cleanup: cleanupRecorder,
  } = useLiveAudioRecorder({
    enableNoiseSuppression,
    onMicLevel: (level) => {
      if (level > 0.05) {
        clearNudgeTimer();
        if (!currentTurnStartMsRef.current) {
          currentTurnStartMsRef.current =
            Date.now() - recordStartTimeRef.current;
        }
        setVoiceActivity((curr) =>
          curr === "ai_speaking" ? curr : "user_speaking"
        );
        setSpeakingState({ kind: "user-speaking" });
      } else {
        setVoiceActivity((curr) => (curr === "user_speaking" ? "idle" : curr));
      }
    },
    onMuteChange: (muted) => {
      if (
        muted &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        try {
          wsRef.current.send(
            JSON.stringify({
              realtimeInput: {
                audioStreamEnd: true,
              },
            })
          );
        } catch {
          // Ignored
        }
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
      if (
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN &&
        statusRef.current === "connected"
      ) {
        try {
          const nudgePayload = {
            clientContent: {
              turns: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `[System: The candidate has been silent for more than 9 seconds. As an encouraging senior IELTS examiner, gently prompt them: "Would you like me to repeat the question?" or provide a natural short hint to keep the conversation flowing.]`,
                    },
                  ],
                },
              ],
              turnComplete: true,
            },
          };
          wsRef.current.send(JSON.stringify(nudgePayload));
        } catch {
          // Ignored
        }
      }
    }, 9000);
  }, [clearNudgeTimer, examStage, part2Phase]);

  const updateStatus = useCallback(
    (newStatus: LiveSessionStatus) => {
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

    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // Ignored
      }
      wsRef.current = null;
    }

    clearNudgeTimer();
    releaseWakeLock();

    if (statusRef.current === "connected") {
      playCallEndSound();
    }

    setVoiceActivity("idle");
  }, [cleanupRecorder, clearNudgeTimer, releaseWakeLock]);

  const updateTranscriptStream = useCallback(() => {
    const committed = [...committedTranscriptsRef.current];
    const liveItems: TranscriptItem[] = [...committed];

    if (currentTurnTextRef.current.user.trim()) {
      liveItems.push({
        id: "in-progress-user",
        sender: "user",
        text: currentTurnTextRef.current.user.trim(),
        timestamp: Date.now(),
        isFinal: false,
      });
    }

    if (currentTurnTextRef.current.examiner.trim()) {
      liveItems.push({
        id: "in-progress-examiner",
        sender: "examiner",
        text: currentTurnTextRef.current.examiner.trim(),
        timestamp: Date.now(),
        isFinal: false,
      });
    }

    setTranscripts(liveItems);
    onTranscriptUpdate?.(liveItems);
  }, [onTranscriptUpdate]);

  const recordTurnMarker = useCallback(
    (userText: string) => {
      if (!userText.trim()) return;
      const nowMs = Date.now() - recordStartTimeRef.current;
      const startMs =
        currentTurnStartMsRef.current || Math.max(0, nowMs - 5000);
      const stage = examStageRef.current;
      const partNum = typeof stage === "number" ? stage : 3;

      let promptQ = `Part ${partNum} Question ${currentTurnIndexRef.current + 1}`;
      if (
        partNum === 1 &&
        topic?.part1.questions[currentTurnIndexRef.current]
      ) {
        promptQ = topic.part1.questions[currentTurnIndexRef.current];
      } else if (partNum === 2 && topic?.part2.cueCardPrompt) {
        promptQ = topic.part2.cueCardPrompt;
      } else if (
        partNum === 3 &&
        topic?.part3.questions[currentTurnIndexRef.current]
      ) {
        promptQ = topic.part3.questions[currentTurnIndexRef.current];
      }

      const marker: CandidateTurnMarker = {
        partNumber: partNum,
        itemIndex: currentTurnIndexRef.current,
        promptQuestion: promptQ,
        startMs,
        endMs: nowMs,
        liveTranscript: userText.trim(),
      };

      turnMarkersRef.current.push(marker);
      setTurnMarkers([...turnMarkersRef.current]);
      currentTurnIndexRef.current++;
    },
    [topic]
  );

  const commitCurrentTurn = useCallback(() => {
    let changed = false;

    if (currentTurnTextRef.current.user.trim()) {
      const userText = currentTurnTextRef.current.user.trim();
      committedTranscriptsRef.current.push({
        id: `tr-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: "user",
        text: userText,
        timestamp: Date.now(),
        isFinal: true,
      });
      recordTurnMarker(userText);
      currentTurnTextRef.current.user = "";
      changed = true;
    }

    if (currentTurnTextRef.current.examiner.trim()) {
      committedTranscriptsRef.current.push({
        id: `tr-examiner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: "examiner",
        text: currentTurnTextRef.current.examiner.trim(),
        timestamp: Date.now(),
        isFinal: true,
      });
      currentTurnTextRef.current.examiner = "";
      changed = true;
    }

    if (changed) {
      const updated = [...committedTranscriptsRef.current];
      setTranscripts(updated);
      onTranscriptUpdate?.(updated);
    }
  }, [onTranscriptUpdate, recordTurnMarker]);

  const addTranscript = useCallback(
    (sender: "user" | "examiner", text: string, isFinal = true) => {
      const sanitized = sanitizeTranscriptText(text);
      if (!sanitized.trim()) return;

      if (isFinal) {
        committedTranscriptsRef.current.push({
          id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sender,
          text: sanitized,
          timestamp: Date.now(),
          isFinal: true,
        });
        const updated = [...committedTranscriptsRef.current];
        setTranscripts(updated);
        onTranscriptUpdate?.(updated);
      } else {
        if (sender === "user") {
          currentTurnTextRef.current.user = sanitized;
        } else {
          currentTurnTextRef.current.examiner = sanitized;
        }
        updateTranscriptStream();
      }
    },
    [onTranscriptUpdate, updateTranscriptStream]
  );

  const finishPart2PrepEarly = useCallback(() => {
    if (prepIntervalRef.current) {
      clearInterval(prepIntervalRef.current);
      prepIntervalRef.current = null;
    }
    setPrepTimeRemaining(0);
    setPart2Phase("speaking");

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const startSpeakingPayload = {
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: "[System: The candidate's 1-minute preparation time is over. As the IELTS Examiner, please say: 'Your preparation time is up. Please begin your 2-minute talk now.' and listen carefully.]",
                  },
                ],
              },
            ],
            turnComplete: true,
          },
        };
        wsRef.current.send(JSON.stringify(startSpeakingPayload));
      } catch (err) {
        console.error(
          "[useGeminiLive] Error sending Part 2 speech trigger:",
          err
        );
      }
    }
  }, []);

  const handleToolCall = useCallback(
    (call: { id?: string; name: string; args?: Record<string, unknown> }) => {
      activeToolCallIdRef.current = call.id || null;

      if (call.name === "display_cue_card") {
        updateStage(2);
        setPart2Phase("prep_countdown");
        setPrepTimeRemaining(60);
        currentTurnIndexRef.current = 0;

        if (call.args) {
          setCueCardData({
            topicTitle:
              (call.args.topicTitle as string) ||
              topic?.part2.topicTitle ||
              "Cue Card Topic",
            cueCardPrompt:
              (call.args.cueCardPrompt as string) ||
              topic?.part2.cueCardPrompt ||
              "",
            bulletPoints:
              (call.args.bulletPoints as string[]) ||
              topic?.part2.bulletPoints ||
              [],
            followUpQuestion: topic?.part2.followUpQuestion,
          });
        }

        if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN &&
          call.id
        ) {
          try {
            const toolResponsePayload = buildToolResponse(
              call.id,
              "display_cue_card",
              {
                status: "cue_card_displayed_prep_started",
                prepTimeSeconds: 60,
                message:
                  "Cue card is displayed on screen. Candidate is preparing notes.",
              }
            );
            wsRef.current.send(JSON.stringify(toolResponsePayload));
          } catch (err) {
            console.error("[useGeminiLive] Error sending toolResponse:", err);
          }
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
      } else if (call.name === "start_part_3") {
        if (prepIntervalRef.current) {
          clearInterval(prepIntervalRef.current);
          prepIntervalRef.current = null;
        }
        updateStage(3);
        setPart2Phase("idle");
        currentTurnIndexRef.current = 0;

        if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN &&
          call.id
        ) {
          try {
            const toolResponsePayload = buildToolResponse(
              call.id,
              "start_part_3",
              {
                status: "part_3_active",
                message:
                  "UI in Part 3 mode. Continue with discussion questions.",
              }
            );
            wsRef.current.send(JSON.stringify(toolResponsePayload));
          } catch (err) {
            console.error(
              "[useGeminiLive] Error responding to start_part_3:",
              err
            );
          }
        }
      } else if (call.name === "end_exam") {
        updateStage("completed");
        setPart2Phase("idle");
        if (
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN &&
          call.id
        ) {
          try {
            const toolResponsePayload = buildToolResponse(call.id, "end_exam", {
              status: "exam_completed",
              message: "Session concluded. Ready for evaluation.",
            });
            wsRef.current.send(JSON.stringify(toolResponsePayload));
          } catch (err) {
            console.error("[useGeminiLive] Error responding to end_exam:", err);
          }
        }
        onExamCompleted?.();
      }
    },
    [finishPart2PrepEarly, onExamCompleted, topic, updateStage]
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
          addTranscript(
            "examiner",
            topic?.part1.questions[0] ||
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
          handleToolCall({
            id: "mock-call-part2",
            name: "display_cue_card",
            args: {
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
            },
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
    handleToolCall,
    topic,
    updateStage,
    updateStatus,
  ]);

  const connect = useCallback(async () => {
    cleanupAudio();
    resetRecording();
    setError(null);
    currentTurnTextRef.current = { user: "", examiner: "" };
    committedTranscriptsRef.current = [];
    turnMarkersRef.current = [];
    setTranscripts([]);
    setTurnMarkers([]);
    recordStartTimeRef.current = Date.now();
    currentTurnStartMsRef.current = 0;
    currentTurnIndexRef.current = 0;
    updateStage(1);
    setPart2Phase("idle");

    if (mockMode) {
      runMockSimulation();
      return;
    }

    try {
      updateStatus("requesting_token");

      // 1. Fetch Ephemeral Token with liveConnectConstraints
      const tokenRes = await fetch(tokenEndpoint, { method: "POST" });
      if (!tokenRes.ok) {
        throw new Error(`Failed to obtain live token: ${tokenRes.statusText}`);
      }
      const tokenData = (await tokenRes.json()) as {
        token: string;
        model?: string;
      };
      const ephemeralKey = tokenData.token;

      updateStatus("connecting");
      recordStartTimeRef.current = Date.now();

      // 2. Initialize Low-latency PCM Controller (AudioWorklet + RingBuffer)
      const controller = new PcmAudioController();
      audioControllerRef.current = controller;

      controller.onSpeakerLevel((level) => {
        if (level > 0.01) {
          setVoiceActivity("ai_speaking");
          setSpeakingState({ kind: "model-speaking" });
        } else {
          setVoiceActivity((curr) => (curr === "ai_speaking" ? "idle" : curr));
        }
      });

      // Start recording immediately with user click gesture
      try {
        await startAudioRecording(controller, (base64PCM, rms) => {
          const currentWs = wsRef.current;
          if (
            currentWs &&
            currentWs.readyState === WebSocket.OPEN &&
            statusRef.current === "connected" &&
            !isMutedRef.current
          ) {
            const elapsedMs = Date.now() - recordStartTimeRef.current;

            // 1. Warm-up gate: first 3.0s block transmission
            if (elapsedMs < 3000) {
              return;
            }

            // 2. Echo gate: while speaker is playing, require higher RMS threshold
            if (controller.isPlaying()) {
              if (rms < 0.03) {
                return;
              }
            }

            const audioPayload = {
              realtimeInput: {
                audio: {
                  mimeType: "audio/pcm;rate=16000",
                  data: base64PCM,
                },
              },
            };
            currentWs.send(JSON.stringify(audioPayload));
          }
        });
      } catch (micErr) {
        console.error("[useGeminiLive] Failed to start microphone:", micErr);
        const err = new Error(
          "Không thể truy cập Microphone. Vui lòng cấp quyền micro."
        );
        setError(err);
        onError?.(err);
        cleanupAudio();
        return;
      }

      // 3. Connect WebSocket to Gemini Multimodal Live API
      const effectiveInstruction =
        systemInstruction ||
        buildExaminerSystemInstruction(candidateName, topic, targetPart);

      const targetModel = tokenData.model || "gemini-3.1-flash-live-preview";
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${ephemeralKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const setupPayload = {
          setup: {
            model: `models/${targetModel}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceName || "Puck",
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: effectiveInstruction }],
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "display_cue_card",
                    description:
                      "Display the Part 2 Cue Card topic and bullet points to the candidate and begin their 1-minute preparation countdown.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        topicTitle: {
                          type: "STRING",
                          description: "Title of the cue card topic",
                        },
                        cueCardPrompt: {
                          type: "STRING",
                          description: "The main task description",
                        },
                        bulletPoints: {
                          type: "ARRAY",
                          items: { type: "STRING" },
                          description:
                            "3-4 bullet points guiding the candidate",
                        },
                      },
                      required: ["topicTitle", "cueCardPrompt", "bulletPoints"],
                    },
                  },
                  {
                    name: "start_part_3",
                    description:
                      "Transition the exam into IELTS Speaking Part 3 for in-depth abstract discussion.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        topicTitle: {
                          type: "STRING",
                          description: "Topic theme for Part 3",
                        },
                        introComment: {
                          type: "STRING",
                          description: "Introductory transition sentence",
                        },
                      },
                      required: ["topicTitle"],
                    },
                  },
                  {
                    name: "end_exam",
                    description:
                      "Conclude the entire IELTS Speaking examination session.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        closingRemarks: {
                          type: "STRING",
                          description: "Closing remarks from the examiner",
                        },
                      },
                    },
                  },
                ],
              },
            ],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {},
            contextWindowCompression: {
              slidingWindow: {},
            },
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                silenceDurationMs: 1200,
                prefixPaddingMs: 100,
              },
            },
          },
        };
        ws.send(JSON.stringify(setupPayload));
      };

      ws.onmessage = async (event) => {
        let messageData = "";
        if (typeof Blob !== "undefined" && event.data instanceof Blob) {
          messageData = await event.data.text();
        } else if (typeof event.data === "string") {
          messageData = event.data;
        } else {
          return;
        }

        try {
          const response = JSON.parse(messageData);
          const parsed = parseLiveServerMessage(response);

          // Handle Resumption update
          if (
            parsed.type === "sessionResumptionUpdate" &&
            parsed.resumptionHandle
          ) {
            latestResumptionHandleRef.current = parsed.resumptionHandle;
            return;
          }

          // Handle setup complete
          if (parsed.type === "setupComplete") {
            updateStatus("connected");
            playCallStartSound();
            try {
              await requestWakeLock();

              const initialTrigger = {
                clientContent: {
                  turns: [
                    {
                      role: "user",
                      parts: [
                        {
                          text: "Hello. Please initiate the IELTS Speaking examination according to your instructions.",
                        },
                      ],
                    },
                  ],
                  turnComplete: true,
                },
              };
              ws.send(JSON.stringify(initialTrigger));
            } catch (audioErr) {
              console.error(
                "[useGeminiLive] Failed to start microphone:",
                audioErr
              );
              const err = new Error(
                "Không thể truy cập Microphone. Vui lòng cấp quyền micro."
              );
              setError(err);
              onError?.(err);
              cleanupAudio();
            }
            return;
          }

          // Handle Tool Calls
          if (parsed.toolCalls && parsed.toolCalls.length > 0) {
            for (const call of parsed.toolCalls) {
              handleToolCall(call);
            }
          }

          const serverContent = response.serverContent;
          if (!serverContent) return;

          // Handle barge-in interruption: immediately stop and clear audio queue
          if (serverContent.interrupted) {
            controller.stopPlayback();
            commitCurrentTurn();
            clearNudgeTimer();
            setSpeakingState({ kind: "user-speaking" });
          }

          // Handle Audio Chunks from model
          if (serverContent.modelTurn?.parts) {
            clearNudgeTimer();
            for (const part of serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                controller.playAudioChunk(part.inlineData.data);
              }
            }
          }

          // Handle Output Transcription (Examiner Speech)
          if (serverContent.outputTranscription?.text) {
            const clean = sanitizeTranscriptText(
              serverContent.outputTranscription.text
            );
            if (clean) {
              currentTurnTextRef.current.examiner += clean;
              updateTranscriptStream();
            }
          }

          // Handle turn completion
          if (serverContent.turnComplete) {
            commitCurrentTurn();
            startNudgeTimer();
            setSpeakingState({ kind: "listening" });
          }

          // Handle Input Transcription (User Speech)
          if (serverContent.inputTranscription?.text) {
            const clean = sanitizeTranscriptText(
              serverContent.inputTranscription.text
            );
            if (clean) {
              currentTurnTextRef.current.user += clean;
              updateTranscriptStream();
            }
          }
        } catch (parseErr) {
          console.error(
            "[useGeminiLive] Error parsing WebSocket message:",
            parseErr
          );
        }
      };

      ws.onerror = (err) => {
        console.error("[useGeminiLive] WebSocket Error:", err);
        const errObj = new Error(
          "Kết nối WebSocket với Giám khảo AI gặp sự cố."
        );
        setError(errObj);
        onError?.(errObj);
        updateStatus("error");
      };

      ws.onclose = () => {
        updateStatus("idle");
      };
    } catch (err: unknown) {
      console.error("[useGeminiLive] Connection initiation error:", err);
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      onError?.(errorObj);
      updateStatus("error");
      cleanupAudio();
    }
  }, [
    cleanupAudio,
    updateStage,
    mockMode,
    runMockSimulation,
    updateStatus,
    tokenEndpoint,
    systemInstruction,
    candidateName,
    topic,
    voiceName,
    targetPart,
    handleToolCall,
    updateTranscriptStream,
    commitCurrentTurn,
    onError,
    clearNudgeTimer,
    requestWakeLock,
    startNudgeTimer,
    resetRecording,
    startAudioRecording,
  ]);

  const disconnect =
    useCallback(async (): Promise<RecordedAudioData | null> => {
      updateStatus("disconnecting");

      let audioData: RecordedAudioData | null = null;
      try {
        audioData = await finalizeRecording();
      } catch (err) {
        console.warn("[useGeminiLive] Error finalizing recording:", err);
      }

      cleanupAudio();
      updateStatus("idle");
      setSpeakingState({ kind: "ended" });

      return audioData;
    }, [cleanupAudio, finalizeRecording, updateStatus]);

  const toggleMute = useCallback(() => {
    toggleRecorderMute();
  }, [toggleRecorderMute]);

  const sendTextMessage = useCallback((text: string) => {
    if (
      !text.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    )
      return;
    try {
      const payload = {
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [{ text }],
            },
          ],
          turnComplete: true,
        },
      };
      wsRef.current.send(JSON.stringify(payload));
    } catch (err) {
      console.error("[useGeminiLive] Error sending text:", err);
    }
  }, []);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setTurnMarkers([]);
  }, []);

  const triggerMockStageChange = useCallback(
    (stage: ExamStage) => {
      updateStage(stage);
      if (stage === 2) {
        setPart2Phase("prep_countdown");
        setPrepTimeRemaining(60);
      } else {
        setPart2Phase("idle");
      }
    },
    [updateStage]
  );

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

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
    isMuted,
    isNoiseSuppressionActive,
    error,
    inputVolume,
    recordedAudio,
    connect,
    disconnect,
    toggleMute,
    toggleNoiseSuppression,
    sendTextMessage,
    clearTranscripts,
    setScratchpadNotes,
    finishPart2PrepEarly,
    triggerMockStageChange,
  };
}
