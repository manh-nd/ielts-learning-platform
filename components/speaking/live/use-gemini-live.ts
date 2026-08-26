"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  LiveSessionStatus,
  VoiceActivityState,
  ExamStage,
  Part2Phase,
  CueCardData,
  TranscriptItem,
  LiveSpeakingConfig,
  UseGeminiLiveReturn,
  RecordedAudioData,
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
  type: "setupComplete" | "toolCall" | "serverContent" | "goAway" | "unknown";
  toolCalls?: Array<{
    id?: string;
    name: string;
    args?: Record<string, unknown>;
  }>;
  serverContent?: Record<string, unknown>;
  goAway?: Record<string, unknown>;
}

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
  };

  if (obj.setupComplete) {
    return { type: "setupComplete" };
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
  topic?: LiveSpeakingConfig["topic"]
): string {
  let topicSpecifics = "";
  if (topic) {
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

  return `
Role: Senior IELTS Speaking Examiner (Dr. Harrison).
Goal: Conduct a structured, realistic IELTS Speaking examination (Part 1, Part 2, and Part 3).
${candidateName ? `The candidate's name is ${candidateName}.` : "Address the candidate formally."}

CRITICAL TURN-TAKING & PACING RULES:
1. Ask EXACTLY ONE question per turn. Keep each prompt short (1-2 sentences). Never answer for the candidate or combine multiple questions into a single turn.
2. START OF TEST: Start with: "Good day. My name is Dr. Harrison, and I will be your IELTS Examiner today. Could you please tell me your full name?"
3. STOP TALKING immediately after asking for the candidate's name. Wait for the candidate to respond.
4. Only AFTER the candidate tells you their name, say "Thank you. Let's begin Part 1." and ask Question 1 of Part 1.
5. In Part 1 and Part 3: Ask each question individually. Always wait for the candidate's complete answer before asking the next question.

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
    systemInstruction,
    voiceName = "Puck",
    tokenEndpoint = "/api/speaking/live-token",
    mockMode = false,
    enableNoiseSuppression = true,
    onStatusChange,
    onStageChange,
    onError,
    onTranscriptUpdate,
  } = config;

  const [status, setStatus] = useState<LiveSessionStatus>("idle");
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
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isNoiseSuppressionActive, setIsNoiseSuppressionActive] =
    useState<boolean>(enableNoiseSuppression);
  const [error, setError] = useState<Error | null>(null);
  const [inputVolume, setInputVolume] = useState<number>(0);
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudioData | null>(
    null
  );

  // References
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);
  const audioControllerRef = useRef<PcmAudioController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isMutedRef = useRef<boolean>(false);
  const isNoiseSuppressionActiveRef = useRef<boolean>(enableNoiseSuppression);
  const mockTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeToolCallIdRef = useRef<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const nudgeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<LiveSessionStatus>("idle");
  const currentTurnTextRef = useRef<{ user: string; examiner: string }>({
    user: "",
    examiner: "",
  });
  const committedTranscriptsRef = useRef<TranscriptItem[]>([]);

  // Sync refs
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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

  const startNudgeTimer = useCallback(() => {
    clearNudgeTimer();
    // Do not nudge during Part 2 prep countdown
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
          // Ignored if socket closed
        }
      }
    }, 9000);
  }, [clearNudgeTimer, examStage, part2Phase]);

  // Sync refs
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isNoiseSuppressionActiveRef.current = isNoiseSuppressionActive;
  }, [isNoiseSuppressionActive]);

  const updateStatus = useCallback(
    (newStatus: LiveSessionStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
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

  // Cleanup helper
  const cleanupAudio = useCallback(() => {
    if (mockTimerRef.current) {
      clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }

    if (prepIntervalRef.current) {
      clearInterval(prepIntervalRef.current);
      prepIntervalRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignored
      }
    }

    if (audioControllerRef.current) {
      audioControllerRef.current.close();
      audioControllerRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
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

    setInputVolume(0);
    setVoiceActivity("idle");
  }, [clearNudgeTimer, releaseWakeLock]);

  // Update in-progress live transcription stream without fragmenting turns
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

  // Finalize and commit in-progress speech turn into history
  const commitCurrentTurn = useCallback(() => {
    let changed = false;

    if (currentTurnTextRef.current.user.trim()) {
      committedTranscriptsRef.current.push({
        id: `tr-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: "user",
        text: currentTurnTextRef.current.user.trim(),
        timestamp: Date.now(),
        isFinal: true,
      });
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
  }, [onTranscriptUpdate]);

  // Append transcript item (used for mock mode or direct commits)
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

  // Finish Part 2 prep early & trigger AI speaking
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

  // Handle Tool Calling events from Gemini
  const handleToolCall = useCallback(
    (call: { id?: string; name: string; args?: Record<string, unknown> }) => {
      activeToolCallIdRef.current = call.id || null;

      if (call.name === "display_cue_card") {
        updateStage(2);
        setPart2Phase("prep_countdown");
        setPrepTimeRemaining(60);

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

        // Send tool response immediately to satisfy synchronous tool requirement
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
                  "Cue card is displayed on screen and candidate is now preparing. Please remain completely silent until notified that preparation is complete.",
              }
            );
            wsRef.current.send(JSON.stringify(toolResponsePayload));
          } catch (err) {
            console.error(
              "[useGeminiLive] Error sending display_cue_card toolResponse:",
              err
            );
          }
        }

        // Run 60-second countdown
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
              message: "Session concluded. Evaluation ready.",
            });
            wsRef.current.send(JSON.stringify(toolResponsePayload));
          } catch (err) {
            console.error("[useGeminiLive] Error responding to end_exam:", err);
          }
        }
      }
    },
    [finishPart2PrepEarly, topic, updateStage]
  );

  // Mock simulation runner for Storybook & local offline dev
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

  // Connect live session
  const connect = useCallback(async () => {
    cleanupAudio();
    setError(null);
    recordedChunksRef.current = [];
    currentTurnTextRef.current = { user: "", examiner: "" };
    committedTranscriptsRef.current = [];
    setTranscripts([]);
    recordStartTimeRef.current = Date.now();
    updateStage(1);
    setPart2Phase("idle");

    if (mockMode) {
      runMockSimulation();
      return;
    }

    try {
      updateStatus("requesting_token");

      // 1. Fetch Ephemeral Token from Next.js API
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

      // 2. Initialize Audio Controller (Recording & Playback)
      const controller = new PcmAudioController();
      audioControllerRef.current = controller;

      controller.onMicLevel((level) => {
        if (isMutedRef.current) {
          setInputVolume(0);
          return;
        }
        setInputVolume(level);
        if (level > 0.05) {
          clearNudgeTimer();
          setVoiceActivity((curr) =>
            curr === "ai_speaking" ? curr : "user_speaking"
          );
        } else {
          setVoiceActivity((curr) =>
            curr === "user_speaking" ? "idle" : curr
          );
        }
      });

      controller.onSpeakerLevel((level) => {
        setVoiceActivity(level > 0.01 ? "ai_speaking" : "idle");
      });

      // 3. Connect WebSocket directly to Gemini Multimodal Live API
      const effectiveInstruction =
        systemInstruction ||
        buildExaminerSystemInstruction(candidateName, topic);

      const targetModel = tokenData.model || "gemini-3.1-flash-live-preview";
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${ephemeralKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send initial Setup configuration
        const setupPayload = {
          setup: {
            model: `models/${targetModel}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceName || "Aoede",
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
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                silenceDurationMs: 2500,
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

          // Handle setup complete
          if (parsed.type === "setupComplete") {
            updateStatus("connected");
            playCallStartSound();
            try {
              // Request Wake Lock to prevent screen sleep
              await requestWakeLock();

              // Start audio recording with Lingua-Loop standard PcmAudioController
              await controller.startRecording((base64PCM, rms) => {
                if (ws.readyState === WebSocket.OPEN && !isMutedRef.current) {
                  const elapsedMs = Date.now() - recordStartTimeRef.current;

                  // 1. Warm-up gate: first 3.5s block transmission
                  if (elapsedMs < 3500) {
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
                  ws.send(JSON.stringify(audioPayload));
                }
              });

              // Also start parallel MediaRecorder for session audio evaluation
              const micStream = controller.getMediaStream();
              if (micStream && typeof MediaRecorder !== "undefined") {
                try {
                  recordedChunksRef.current = [];
                  const mimeType = MediaRecorder.isTypeSupported(
                    "audio/webm;codecs=opus"
                  )
                    ? "audio/webm;codecs=opus"
                    : "audio/webm";
                  const recorder = new MediaRecorder(micStream, { mimeType });
                  recorder.ondataavailable = (ev) => {
                    if (ev.data && ev.data.size > 0) {
                      recordedChunksRef.current.push(ev.data);
                    }
                  };
                  recorder.start(1000);
                  mediaRecorderRef.current = recorder;
                } catch (recErr) {
                  console.warn(
                    "[useGeminiLive] MediaRecorder start error:",
                    recErr
                  );
                }
              }

              const initialTrigger = {
                clientContent: {
                  turns: [
                    {
                      role: "user",
                      parts: [
                        {
                          text: "Hello. Please initiate the conversation according to your role instructions.",
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

          // Handle Tool Calls (display_cue_card, start_part_3, end_exam)
          if (parsed.toolCalls && parsed.toolCalls.length > 0) {
            for (const call of parsed.toolCalls) {
              handleToolCall(call);
            }
          }

          const serverContent = response.serverContent;
          if (!serverContent) return;

          // Handle interruption (barge-in)
          if (serverContent.interrupted) {
            controller.stopPlayback();
            commitCurrentTurn();
            clearNudgeTimer();
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

          // Handle Output Transcription (Examiner Speech) - streaming accumulation
          if (serverContent.outputTranscription?.text) {
            const clean = sanitizeTranscriptText(
              serverContent.outputTranscription.text
            );
            if (clean) {
              currentTurnTextRef.current.examiner += clean;
              updateTranscriptStream();
            }
          }

          // If examiner turn completes, commit transcript turn and start silence nudge timer (9s)
          if (serverContent.turnComplete) {
            commitCurrentTurn();
            startNudgeTimer();
          }

          // Handle Input Transcription (User Speech) - streaming accumulation
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
    handleToolCall,
    updateTranscriptStream,
    commitCurrentTurn,
    onError,
    clearNudgeTimer,
    requestWakeLock,
    startNudgeTimer,
  ]);

  // Disconnect session & compile recorded audio
  const disconnect = useCallback(() => {
    updateStatus("disconnecting");

    // Package recorded audio blob
    if (recordedChunksRef.current.length > 0) {
      const mimeType =
        mediaRecorderRef.current?.mimeType || "audio/webm;codecs=opus";
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - recordStartTimeRef.current) / 1000)
      );

      setRecordedAudio({
        blob,
        url,
        durationSeconds,
        mimeType,
      });
    }

    cleanupAudio();
    updateStatus("idle");
  }, [cleanupAudio, updateStatus]);

  // Mute controls
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Noise suppression toggle
  const toggleNoiseSuppression = useCallback((enabled?: boolean) => {
    setIsNoiseSuppressionActive((prev) => {
      const next = enabled !== undefined ? enabled : !prev;
      isNoiseSuppressionActiveRef.current = next;
      return next;
    });
  }, []);

  // Send text message directly
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
  }, []);

  // Mock stage changer for storybook
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

  // Teardown on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    status,
    voiceActivity,
    examStage,
    part2Phase,
    cueCardData,
    prepTimeRemaining,
    scratchpadNotes,
    transcripts,
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
