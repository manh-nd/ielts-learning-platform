"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import {
  LiveSessionStatus,
  VoiceActivityState,
  TranscriptItem,
  LiveSpeakingConfig,
  UseGeminiLiveReturn,
} from "./types";
import {
  float32ToInt16,
  int16ToBase64,
  downsampleAudioBuffer,
  calculateRMSVolume,
} from "@/lib/audio/pcm-utils";
import { AudioStreamPlayer } from "@/lib/audio/audio-stream-player";

export const DEFAULT_EXAMINER_SYSTEM_INSTRUCTION = `
You are an expert, certified Senior IELTS Speaking Examiner conducting a live, one-on-one IELTS Speaking examination.
Tone & Persona:
- Professional, warm, clear British/International English accent, polite and formal yet approachable.
- Speak with natural cadence, pausing for candidate responses.
- Keep your turns concise (1-2 sentences per question) to give maximum speaking time to the candidate.
- Never interrupt the candidate when they are speaking.
- Progress naturally: Greet the candidate -> Start Part 1 questions -> Segue to Part 2 cue card -> Part 3 abstract discussion.
`;

interface LiveClientSession {
  sendRealtimeInput: (params: {
    audio?: { data: string; mimeType: string };
    text?: string;
  }) => void;
  close: () => void;
}

interface LiveServerMessagePayload {
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    modelTurn?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
        };
      }>;
    };
    outputTranscription?: {
      text?: string;
    };
    inputTranscription?: {
      text?: string;
    };
  };
}

export function useGeminiLive(
  config: LiveSpeakingConfig = {}
): UseGeminiLiveReturn {
  const {
    candidateName,
    systemInstruction = DEFAULT_EXAMINER_SYSTEM_INSTRUCTION,
    voiceName = "Puck",
    tokenEndpoint = "/api/speaking/live-token",
    mockMode = false,
    onStatusChange,
    onError,
    onTranscriptUpdate,
  } = config;

  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const [voiceActivity, setVoiceActivity] =
    useState<VoiceActivityState>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [inputVolume, setInputVolume] = useState<number>(0);

  // References
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const audioPlayerRef = useRef<AudioStreamPlayer | null>(null);
  const liveSessionRef = useRef<LiveClientSession | null>(null);
  const isMutedRef = useRef<boolean>(false);
  const mockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync muted ref
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Status change notify
  const updateStatus = useCallback(
    (newStatus: LiveSessionStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  // Initialize stream player
  useEffect(() => {
    const player = new AudioStreamPlayer((isPlaying) => {
      setVoiceActivity(isPlaying ? "ai_speaking" : "idle");
    });
    audioPlayerRef.current = player;

    return () => {
      player.close();
    };
  }, []);

  // Cleanup helper
  const cleanupAudio = useCallback(() => {
    if (mockTimerRef.current) {
      clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }

    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch {
        // Ignored
      }
      processorNodeRef.current = null;
    }

    if (
      inputAudioContextRef.current &&
      inputAudioContextRef.current.state !== "closed"
    ) {
      try {
        inputAudioContextRef.current.close();
      } catch {
        // Ignored
      }
      inputAudioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.interrupt();
    }

    if (liveSessionRef.current) {
      try {
        liveSessionRef.current.close();
      } catch {
        // Ignored
      }
      liveSessionRef.current = null;
    }

    setInputVolume(0);
    setVoiceActivity("idle");
  }, []);

  // Append transcript item
  const addTranscript = useCallback(
    (sender: "user" | "examiner", text: string, isFinal = true) => {
      if (!text.trim()) return;
      setTranscripts((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === sender && !last.isFinal) {
          // Update in-place
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text,
            isFinal,
          };
          onTranscriptUpdate?.(updated);
          return updated;
        }

        const newItem: TranscriptItem = {
          id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sender,
          text,
          timestamp: Date.now(),
          isFinal,
        };
        const next = [...prev, newItem];
        onTranscriptUpdate?.(next);
        return next;
      });
    },
    [onTranscriptUpdate]
  );

  // Mock simulation runner for Storybook & local dev
  const runMockSimulation = useCallback(() => {
    updateStatus("connected");
    setError(null);

    // Initial greeting after 1s
    setTimeout(() => {
      addTranscript(
        "examiner",
        `Good day. My name is Dr. Harrison, and I will be your IELTS Examiner today. Could you please tell me your full name?`
      );
    }, 1000);

    // Mock turn intervals
    let turnCount = 0;
    const mockDialogues = [
      {
        userText: "My name is Nguyen Van Manh. You can call me Manh.",
        aiText:
          "Thank you, Manh. In this first part, I would like to ask you some questions about your hometown. Do you live in a city or the countryside?",
      },
      {
        userText:
          "I currently live in Hanoi, which is the vibrant capital city of Vietnam. It is quite bustling with a rich historical heritage.",
        aiText:
          "Interesting. What is your favorite thing about living in Hanoi?",
      },
    ];

    mockTimerRef.current = setInterval(() => {
      if (turnCount < mockDialogues.length) {
        const turn = mockDialogues[turnCount];
        setVoiceActivity("user_speaking");
        setTimeout(() => {
          addTranscript("user", turn.userText, true);
          setVoiceActivity("ai_speaking");

          setTimeout(() => {
            addTranscript("examiner", turn.aiText, true);
            setVoiceActivity("idle");
          }, 2000);
        }, 1500);
        turnCount++;
      }
    }, 8000);
  }, [addTranscript, updateStatus]);

  // Connect live session
  const connect = useCallback(async () => {
    cleanupAudio();
    setError(null);

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

      // 2. Request user microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      mediaStreamRef.current = stream;

      // 3. Initialize GoogleGenAI client with ephemeral key
      const ai = new GoogleGenAI({
        apiKey: ephemeralKey,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const effectiveInstruction = candidateName
        ? `${systemInstruction}\nThe candidate's name is ${candidateName}. Address them appropriately.`
        : systemInstruction;

      // 4. Connect to Gemini Live WebSocket
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
          systemInstruction: {
            parts: [{ text: effectiveInstruction }],
          },
        },
        callbacks: {
          onopen: () => {
            updateStatus("connected");
          },
          onmessage: (message: LiveServerMessagePayload) => {
            const serverContent = message?.serverContent;

            // Handle interruption (barge-in)
            if (serverContent?.interrupted) {
              audioPlayerRef.current?.interrupt();
            }

            // Handle Audio Chunks from model
            if (serverContent?.modelTurn?.parts) {
              for (const part of serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  audioPlayerRef.current?.queueChunk(part.inlineData.data);
                }
              }
            }

            // Handle Output Transcription (Examiner Speech)
            if (serverContent?.outputTranscription?.text) {
              addTranscript(
                "examiner",
                serverContent.outputTranscription.text,
                serverContent.turnComplete ?? true
              );
            }

            // Handle Input Transcription (User Speech)
            if (serverContent?.inputTranscription?.text) {
              addTranscript(
                "user",
                serverContent.inputTranscription.text,
                true
              );
            }
          },
          onerror: (err: unknown) => {
            console.error("[useGeminiLive] WebSocket Error:", err);
            const errObj = err instanceof Error ? err : new Error(String(err));
            setError(errObj);
            onError?.(errObj);
            updateStatus("error");
          },
          onclose: () => {
            updateStatus("idle");
          },
        },
      });

      liveSessionRef.current = session;

      // 5. Setup AudioContext & Processor for PCM 16kHz Streaming
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const inputAudioCtx = new AudioCtx();
      inputAudioContextRef.current = inputAudioCtx;

      const sourceNode = inputAudioCtx.createMediaStreamSource(stream);
      const bufferSize = 2048;
      const processor = inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || !liveSessionRef.current) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);
        const volume = calculateRMSVolume(inputChannelData);
        setInputVolume(volume);

        if (volume > 0.05) {
          setVoiceActivity((curr) =>
            curr === "ai_speaking" ? curr : "user_speaking"
          );
        } else {
          setVoiceActivity((curr) =>
            curr === "user_speaking" ? "idle" : curr
          );
        }

        // Downsample from browser input rate to 16kHz
        const downsampled = downsampleAudioBuffer(
          inputChannelData,
          inputAudioCtx.sampleRate,
          16000
        );
        const pcm16 = float32ToInt16(downsampled);
        const base64Chunk = int16ToBase64(pcm16);

        try {
          liveSessionRef.current.sendRealtimeInput({
            audio: {
              data: base64Chunk,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } catch {
          // Socket might be closing
        }
      };

      sourceNode.connect(processor);
      processor.connect(inputAudioCtx.destination);
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
    mockMode,
    runMockSimulation,
    updateStatus,
    tokenEndpoint,
    candidateName,
    systemInstruction,
    voiceName,
    addTranscript,
    onError,
  ]);

  // Disconnect session
  const disconnect = useCallback(() => {
    updateStatus("disconnecting");
    cleanupAudio();
    updateStatus("idle");
  }, [cleanupAudio, updateStatus]);

  // Mute controls
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Send text message directly
  const sendTextMessage = useCallback((text: string) => {
    if (!text.trim() || !liveSessionRef.current) return;
    try {
      liveSessionRef.current.sendRealtimeInput({
        text,
      });
    } catch (err) {
      console.error("[useGeminiLive] Error sending text:", err);
    }
  }, []);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    status,
    voiceActivity,
    transcripts,
    isMuted,
    error,
    inputVolume,
    connect,
    disconnect,
    toggleMute,
    sendTextMessage,
    clearTranscripts,
  };
}
