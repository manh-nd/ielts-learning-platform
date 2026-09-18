"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LiveSpeakingConfig,
  UseGeminiLiveReturn,
  LiveSessionStatus,
  LiveSpeakingState,
  VoiceActivityState,
  TranscriptItem,
  ConversationReplayData,
} from "./types";
import { PcmAudioController } from "@/lib/audio/pcm-audio-controller";
import { ConversationReplayRecorder } from "@/lib/audio/conversation-replay-recorder";
import { sanitizeTranscriptText } from "@/lib/audio/live-guards";
import { LiveSessionCoordinator } from "./live-session-coordinator";
import { useLiveAudioRecorder } from "./hooks/use-live-audio-recorder";
import { PracticeConversationCoordinator } from "@/modules/speaking/application/practice-conversation-coordinator";
import { getPracticePlan } from "@/modules/speaking/application/get-practice-plan";
import { FakeSpeakingLiveExaminer } from "@/modules/speaking/application/testing/fake-speaking-live-examiner";
import type { SpeakingLiveExaminerPort } from "@/modules/speaking/application/ports/speaking-live-examiner.port";
import { normalizeSpeakingPracticeScope } from "@/modules/speaking/domain";
export { buildExaminerSystemInstruction } from "@/modules/speaking/application/legacy-examiner-instruction";
export {
  getSupportedMediaRecorderMimeType,
  pcmBase64ChunksToWavBlob,
} from "./hooks/use-live-audio-recorder";

export function isPermissionDeniedError(error: unknown): boolean {
  if (!error) return false;
  const { name = "", message = "" } = error as Error;
  return (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    /permission|denied/i.test(message)
  );
}

/** Browser effects only. The application coordinator owns practice progression. */
export function useGeminiLive(
  config: LiveSpeakingConfig = {}
): UseGeminiLiveReturn {
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  const [status, setStatus] = useState<LiveSessionStatus>("idle");
  const statusRef = useRef<LiveSessionStatus>("idle");
  const [speakingState, setSpeakingState] = useState<LiveSpeakingState>({
    kind: "idle",
  });
  const [voiceActivity, setVoiceActivity] =
    useState<VoiceActivityState>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const [snapshot, setSnapshot] = useState<
    PracticeConversationCoordinator["snapshot"] | null
  >(null);
  const [error, setError] = useState<Error | null>(null);
  const [scratchpadNotes, setScratchpadNotes] = useState("");
  const [conversationReplay, setConversationReplay] =
    useState<ConversationReplayData | null>(null);
  const practice = useRef<PracticeConversationCoordinator | null>(null);
  const recording = useRef<LiveSessionCoordinator | null>(null);
  const controller = useRef<PcmAudioController | null>(null);
  const replay = useRef<ConversationReplayRecorder | null>(null);
  const port = useRef<SpeakingLiveExaminerPort | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const epoch = useRef(0);
  const muted = useRef(false);
  const captureStartedAt = useRef(0);
  const recorder = useLiveAudioRecorder({
    enableNoiseSuppression: config.enableNoiseSuppression ?? true,
    onMicLevel: (level) => {
      if (statusRef.current !== "connected" || muted.current) return;
      practice.current?.microphone(level > 0.04);
      if (level > 0.04) {
        setVoiceActivity("user_speaking");
        setSpeakingState({ kind: "user-speaking" });
      } else
        setVoiceActivity((value) =>
          value === "user_speaking" ? "idle" : value
        );
    },
    onMuteChange: (value) => {
      muted.current = value;
    },
  });
  const {
    cleanup: cleanupRecorder,
    finalizeRecording,
    resetRecording,
    startRecording,
  } = recorder;
  const updateStatus = useCallback((value: LiveSessionStatus) => {
    statusRef.current = value;
    setStatus(value);
    configRef.current.onStatusChange?.(value);
  }, []);
  const cleanup = useCallback(() => {
    epoch.current++;
    if (timer.current) clearInterval(timer.current);
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
    timer.current = null;
    playbackTimer.current = null;
    practice.current?.suspend();
    unsubscribe.current?.();
    unsubscribe.current = null;
    void port.current?.disconnect();
    controller.current?.close();
    controller.current = null;
    cleanupRecorder();
  }, [cleanupRecorder]);
  useEffect(
    () => () => {
      cleanup();
      recording.current?.reset();
    },
    [cleanup]
  );

  const addTranscript = useCallback(
    (sender: "user" | "examiner", text: string) => {
      const clean = sanitizeTranscriptText(text);
      if (!clean) return;
      const last = transcriptRef.current.at(-1);
      if (last?.sender === sender && !last.isFinal) last.text += clean;
      else
        transcriptRef.current.push({
          id: crypto.randomUUID(),
          sender,
          text: clean,
          timestamp: Date.now(),
          isFinal: false,
        });
      const next = transcriptRef.current.map((t) => ({ ...t }));
      setTranscripts(next);
      configRef.current.onTranscriptUpdate?.(next);
    },
    []
  );

  const connect = useCallback(
    async (
      admittedPlan?: import("@/modules/speaking/domain/practice-plan").PracticePlan
    ) => {
      cleanup();
      const connectionEpoch = epoch.current;
      const current = configRef.current;
      const scope = normalizeSpeakingPracticeScope(
        current.targetPart ?? "part_1"
      );
      const plan =
        admittedPlan ??
        current.practicePlan ??
        (scope
          ? getPracticePlan(current.topic?.id ?? "tech-ai-future", scope)
          : null);
      if (!plan) {
        setError(new Error("Choose an independent practice part."));
        updateStatus("error");
        return;
      }
      resetRecording();
      setError(null);
      setConversationReplay(null);
      transcriptRef.current = [];
      setTranscripts([]);
      const examiner = current.mockMode
        ? new FakeSpeakingLiveExaminer(true)
        : current.examinerPort;
      if (!examiner) {
        setError(new Error("Examiner is unavailable."));
        updateStatus("error");
        return;
      }
      port.current = examiner;
      const audio = new PcmAudioController();
      controller.current = audio;
      const audioSession = new LiveSessionCoordinator({
        finalizeRecording,
        cleanupAudio: cleanup,
        onStatusChange: updateStatus,
        onEnded: () => setSpeakingState({ kind: "ended" }),
      });
      recording.current = audioSession;
      audioSession.startSession(audio, (start) => {
        const value = new ConversationReplayRecorder({ sessionEpochMs: start });
        replay.current = value;
        return value;
      });
      const coordinator = new PracticeConversationCoordinator(plan, {
        speak: (prompt) => {
          for (const item of transcriptRef.current) item.isFinal = true;
          setSpeakingState({ kind: "waiting-for-model" });
          if (examiner.presentPrompt)
            examiner.presentPrompt({
              questionId: prompt.id,
              text: prompt.text,
            });
          else examiner.sendText({ text: prompt.text });
        },
        activity: (started) => {
          if (started) {
            audioSession.handleInterruption();
            examiner.startCandidateActivity?.();
          } else examiner.endCandidateActivity?.();
        },
        changed: () => {
          const state = coordinator.snapshot;
          setSnapshot(state);
          current.onStageChange?.(
            state.phase === "ended"
              ? "completed"
              : (Number(state.scope.slice(-1)) as 1 | 2 | 3)
          );
        },
        completed: () =>
          audioSession.handleEndExam(current.onExamCompleted, 1000),
      });
      practice.current = coordinator;
      setSnapshot(coordinator.snapshot);
      let connected = false;
      const drained = () => {
        if (
          connectionEpoch !== epoch.current ||
          statusRef.current !== "connected"
        )
          return;
        if (audio.isPlaying()) playbackTimer.current = setTimeout(drained, 50);
        else {
          coordinator.examinerFinished();
          setSpeakingState({ kind: "listening" });
        }
      };
      unsubscribe.current = examiner.subscribe((event) => {
        if (connectionEpoch !== epoch.current) return;
        switch (event.type) {
          case "connected":
            if (connected) break;
            connected = true;
            updateStatus("connected");
            coordinator.start(captureStartedAt.current);
            break;
          case "reconnecting":
            coordinator.suspend();
            audioSession.handleInterruption();
            updateStatus("reconnecting");
            setSpeakingState({ kind: "reconnecting" });
            break;
          case "resumed":
            updateStatus("connected");
            coordinator.resume();
            setSpeakingState({ kind: "listening" });
            break;
          case "connection_failed":
            coordinator.suspend();
            audioSession.handleInterruption();
            setError(new Error(event.reason));
            updateStatus("error");
            setSpeakingState({ kind: "failed", reason: event.reason });
            current.onError?.(new Error(event.reason));
            if (!connected) cleanup();
            break;
          case "disconnected":
            coordinator.suspend();
            updateStatus("error");
            break;
          case "examiner_audio_chunk":
            if (statusRef.current !== "connected") break;
            setVoiceActivity("ai_speaking");
            setSpeakingState({ kind: "model-speaking" });
            audio.playAudioChunk(event.audioBase64, (info) =>
              audioSession.acceptExaminerPcm(
                info.pcm,
                info.scheduledStartTimeMs,
                info.durationMs
              )
            );
            break;
          case "candidate_transcript_updated":
            coordinator.appendTranscript(event.text);
            addTranscript("user", event.text);
            break;
          case "examiner_transcript_updated":
            addTranscript("examiner", event.text);
            break;
          case "candidate_interrupted_examiner":
            audioSession.handleInterruption();
            setSpeakingState({ kind: "user-speaking" });
            break;
          case "live_turn_completed":
            if (playbackTimer.current) clearTimeout(playbackTimer.current);
            drained();
            audioSession.handleTurnComplete(current.onExamCompleted);
            break;
          case "examiner_action_requested":
            break;
        }
      });
      updateStatus("connecting");
      setSpeakingState({ kind: "connecting" });
      try {
        captureStartedAt.current = Date.now();
        if (!current.mockMode) {
          await startRecording(
            audio,
            (base64, rms) => {
              if (
                connectionEpoch !== epoch.current ||
                statusRef.current !== "connected" ||
                muted.current
              )
                return;
              if (audio.isPlaying() && rms < 0.03) return;
              examiner.sendCandidateAudio({
                audioBase64: base64,
                mimeType: "audio/pcm;rate=16000",
              });
            },
            (raw) => replay.current?.addLearnerChunk(raw)
          );
          if (connectionEpoch !== epoch.current) {
            cleanupRecorder();
            return;
          }
          audioSession.anchorMicCapture();
        }
        timer.current = setInterval(() => {
          coordinator.tick();
          if (coordinator.snapshot.phase === "preparing")
            setSnapshot(coordinator.snapshot);
        }, 100);
        await examiner.connect({
          applicationControlled: true,
        });
      } catch (failure) {
        if (connectionEpoch !== epoch.current) return;
        const value =
          failure instanceof Error ? failure : new Error("Connection failed");
        setError(value);
        updateStatus(
          isPermissionDeniedError(value) ? "permission_denied" : "error"
        );
        current.onError?.(value);
        if (!connected) cleanup();
      }
    },
    [
      cleanup,
      resetRecording,
      finalizeRecording,
      updateStatus,
      addTranscript,
      startRecording,
      cleanupRecorder,
    ]
  );

  const finalizeLiveSession = useCallback(
    async (reason: "ai_completed" | "learner_finish") => {
      practice.current?.endEarly();
      const result = recording.current
        ? await recording.current.finalizeLiveSession(reason)
        : {
            recordedAudio: await finalizeRecording(),
            conversationReplay: null,
          };
      setConversationReplay(result.conversationReplay);
      return result;
    },
    [finalizeRecording]
  );
  const cue = snapshot?.cueCard;
  return {
    status,
    speakingState,
    voiceActivity,
    transcripts,
    error,
    conversationReplay,
    examStage:
      snapshot?.phase === "ended"
        ? "completed"
        : (Number((snapshot?.scope ?? "part_1").slice(-1)) as 1 | 2 | 3),
    part2Phase:
      snapshot?.phase === "preparing"
        ? "prep_countdown"
        : snapshot?.scope === "part_2" && snapshot.phase === "answering"
          ? "speaking"
          : "idle",
    cueCardData: cue
      ? {
          topicTitle: snapshot?.title ?? "",
          cueCardPrompt: cue.text,
          bulletPoints: [...cue.bulletPoints],
        }
      : null,
    prepTimeRemaining: snapshot?.remainingSeconds ?? 60,
    scratchpadNotes,
    turnMarkers: snapshot?.answers ?? [],
    isMuted: recorder.isMuted,
    isNoiseSuppressionActive: recorder.isNoiseSuppressionActive,
    inputVolume: recorder.inputVolume,
    recordedAudio: recorder.recordedAudio,
    connect,
    disconnect: async () =>
      (await finalizeLiveSession("learner_finish")).recordedAudio,
    finalizeLiveSession,
    toggleMute: recorder.toggleMute,
    toggleNoiseSuppression: recorder.toggleNoiseSuppression,
    setScratchpadNotes,
    finishPart2PrepEarly: () => practice.current?.startSpeaking(),
    finishAnswer: () => {
      if (configRef.current.mockMode) practice.current?.microphone(true);
      practice.current?.done();
    },
    repeatQuestion: () => practice.current?.repeat(),
    getTurnMarkers: () => [...(practice.current?.snapshot.answers ?? [])],
    sendTextMessage: () => practice.current?.repeat(),
    clearTranscripts: () => {
      transcriptRef.current = [];
      setTranscripts([]);
    },
    triggerMockStageChange: () => {},
  };
}
