"use client";

import { useState, useCallback } from "react";
import { Sparkles, User, ShieldCheck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveConnectionBadge } from "./live-connection-badge";
import { LiveTranscriptStream } from "./live-transcript-stream";
import { LiveSessionControls } from "./live-session-controls";
import { LiveSpeakingCueCardModal } from "./live-speaking-cue-card-modal";
import { LiveSpeakingResultView } from "./live-speaking-result-view";
import { useGeminiLive } from "./use-gemini-live";
import { LiveSpeakingConfig, CandidateTurnMarker } from "./types";
import {
  IeltsSpeakingEvaluationResult,
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";

export interface LiveSpeakingExaminerRoomProps extends LiveSpeakingConfig {
  title?: string;
  subtitle?: string;
  className?: string;
  onBackToDashboard?: () => void;
  onRestart?: () => void;
}

export function LiveSpeakingExaminerRoom({
  title = "Phòng Thi Thử IELTS Speaking Trực Tiếp",
  subtitle = "Đối thoại thời gian thực 1-on-1 với Giám khảo AI (Examiner)",
  candidateName = "Thí sinh",
  topic,
  targetPart = "full",
  mockMode = false,
  className,
  onBackToDashboard,
  onRestart,
  ...config
}: LiveSpeakingExaminerRoomProps) {
  const {
    status,
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
    inputVolume,
    recordedAudio,
    connect,
    disconnect,
    toggleMute,
    toggleNoiseSuppression,
    setScratchpadNotes,
    finishPart2PrepEarly,
  } = useGeminiLive({
    candidateName,
    topic,
    targetPart,
    mockMode,
    ...config,
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => `ses_live_${Date.now()}`
  );
  const [persistedStorageKey, setPersistedStorageKey] = useState<string | null>(
    null
  );
  const [persistedAudioBase64, setPersistedAudioBase64] = useState<
    string | null
  >(null);
  const [evaluationResult, setEvaluationResult] =
    useState<IeltsSpeakingEvaluationResult | null>(null);
  const [practiceFeedback, setPracticeFeedback] =
    useState<PracticeFeedback | null>(null);
  const [traceMetadata, setTraceMetadata] =
    useState<SpeakingEvaluationTrace | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [isExamFinished, setIsExamFinished] = useState<boolean>(false);

  const isConnected = status === "connected";
  const isPart1Practice = targetPart === "part1" || targetPart === "part_1";

  // Dispatch evaluation request to server
  const triggerEvaluation = useCallback(
    async (
      sessionIdToUse?: string,
      storageKeyToUse?: string,
      audioBase64ToUse?: string,
      audioDuration?: number,
      markers?: CandidateTurnMarker[]
    ) => {
      setIsEvaluating(true);
      setEvalError(null);

      const resolvedSessionId = sessionIdToUse || activeSessionId;
      const resolvedStorageKey =
        storageKeyToUse || persistedStorageKey || undefined;
      const resolvedBase64 =
        audioBase64ToUse ||
        (!resolvedStorageKey ? persistedAudioBase64 || "" : undefined);

      try {
        const payload = {
          sessionId: resolvedSessionId,
          topicTitle: topic?.title || "General IELTS Speaking Mock Test",
          candidateName,
          practiceMode: isPart1Practice ? "part_1" : undefined,
          targetPart: isPart1Practice ? "part_1" : "full",
          questions:
            isPart1Practice && topic?.part1.questions
              ? topic.part1.questions
              : undefined,
          transcripts: transcripts.map((t) => ({
            sender: t.sender,
            text: t.text,
            timestamp: t.timestamp,
          })),
          turnMarkers: markers || turnMarkers,
          part1Question:
            topic?.part1.questions[0] || "Introduction and interview questions",
          part2Topic: topic?.part2.topicTitle || "Individual long turn topic",
          part3Theme: topic?.part3.theme || "Two-way discussion topic",
          storageKey: resolvedStorageKey,
          audioBase64: resolvedBase64,
          durationSeconds:
            audioDuration || recordedAudio?.durationSeconds || 120,
        };

        const res = await fetch("/api/speaking/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.message || `Lỗi khi chấm điểm (${res.status})`
          );
        }

        const data = await res.json();
        if (data.isPractice) {
          setPracticeFeedback(data.result as PracticeFeedback);
        } else {
          setEvaluationResult(data.result as IeltsSpeakingEvaluationResult);
        }
        if (data.trace) {
          setTraceMetadata(data.trace as SpeakingEvaluationTrace);
        }
      } catch (err: unknown) {
        console.error("[LiveExaminerRoom] Evaluation failed:", err);
        setEvalError(
          (err as Error)?.message || "Không thể thực hiện chấm điểm tự động."
        );
      } finally {
        setIsEvaluating(false);
      }
    },
    [
      activeSessionId,
      candidateName,
      isPart1Practice,
      persistedAudioBase64,
      persistedStorageKey,
      recordedAudio,
      topic,
      transcripts,
      turnMarkers,
    ]
  );

  // Finish exam manually or automatically
  const handleFinishExam = useCallback(async () => {
    const finalizedAudio = await disconnect();
    setIsExamFinished(true);

    let storageKey = "";
    let base64Audio = "";

    // 1. Attempt Presigned S3/Storage Direct Upload
    if (finalizedAudio?.blob) {
      try {
        const uploadUrlRes = await fetch("/api/speaking/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId,
            filename: "candidate.webm",
            mimeType: finalizedAudio.mimeType || "audio/webm;codecs=opus",
          }),
        });

        if (uploadUrlRes.ok) {
          const uploadInfo = (await uploadUrlRes.json()) as {
            uploadUrl: string;
            storageKey: string;
          };

          const putRes = await fetch(uploadInfo.uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type":
                finalizedAudio.mimeType || "audio/webm;codecs=opus",
            },
            body: finalizedAudio.blob,
          });

          if (putRes.ok) {
            storageKey = uploadInfo.storageKey;
            setPersistedStorageKey(storageKey);
          }
        }
      } catch (uploadErr) {
        console.warn(
          "[LiveExaminerRoom] Direct storage upload failed, falling back to base64:",
          uploadErr
        );
      }

      // Fallback to base64 if S3 upload didn't yield a key
      if (!storageKey) {
        try {
          const reader = new FileReader();
          base64Audio = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const res = reader.result as string;
              const commaIndex = res.indexOf(",");
              resolve(commaIndex !== -1 ? res.slice(commaIndex + 1) : res);
            };
            reader.readAsDataURL(finalizedAudio.blob);
          });
          setPersistedAudioBase64(base64Audio);
        } catch (readErr) {
          console.warn(
            "[LiveExaminerRoom] Could not read audio blob:",
            readErr
          );
        }
      }
    }

    await triggerEvaluation(
      activeSessionId,
      storageKey,
      base64Audio,
      finalizedAudio?.durationSeconds,
      turnMarkers
    );
  }, [activeSessionId, disconnect, triggerEvaluation, turnMarkers]);

  // If exam has finished, display the comprehensive Result View
  if (isExamFinished || examStage === "completed") {
    return (
      <LiveSpeakingResultView
        evaluationResult={evaluationResult}
        practiceFeedback={practiceFeedback}
        traceMetadata={traceMetadata}
        isPracticeMode={isPart1Practice}
        isLoading={isEvaluating}
        error={evalError}
        recordedAudio={recordedAudio}
        transcripts={transcripts}
        onRetryEvaluation={() =>
          triggerEvaluation(
            activeSessionId,
            persistedStorageKey || undefined,
            persistedAudioBase64 || undefined
          )
        }
        onRestartTest={() => {
          setIsExamFinished(false);
          setEvaluationResult(null);
          setPracticeFeedback(null);
          setTraceMetadata(null);
          setPersistedStorageKey(null);
          setPersistedAudioBase64(null);
          setActiveSessionId(`ses_live_${Date.now()}`);
          onRestart?.();
        }}
        onBackToDashboard={() => {
          onBackToDashboard?.();
        }}
      />
    );
  }

  return (
    <Card
      data-testid="live-speaking-examiner-room"
      className={cn(
        "w-full max-w-4xl mx-auto shadow-md border overflow-hidden py-0 gap-0 transition-all",
        isConnected && "ring-1 ring-indigo-500/30",
        className
      )}
    >
      {/* Header */}
      <CardHeader className="px-5 py-3.5 border-b bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                {title}
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] font-mono uppercase bg-primary/10 text-primary border-primary/30 font-bold"
              >
                Part {examStage}
              </Badge>
              {topic && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-medium hidden sm:inline-flex"
                >
                  {topic.title}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {subtitle}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <LiveConnectionBadge
              status={status}
              voiceActivity={voiceActivity}
            />
            {isConnected && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleFinishExam}
                className="h-7 text-xs px-2.5 font-medium cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                <span>Nộp bài & Chấm điểm</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Main Content Studio with optimized padding */}
      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Stage Visualization Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AI Examiner Card */}
          <div
            data-testid="examiner-stage-card"
            className={cn(
              "flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl border text-center transition-all bg-gradient-to-b from-indigo-500/5 to-transparent",
              voiceActivity === "ai_speaking" &&
                "ring-2 ring-indigo-500 bg-indigo-500/10 shadow-xs"
            )}
          >
            <div className="relative mb-2.5">
              <div
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center bg-indigo-600 text-white shadow-md transition-transform",
                  voiceActivity === "ai_speaking" && "scale-105"
                )}
              >
                <Sparkles className="w-7 h-7" />
              </div>
              {voiceActivity === "ai_speaking" && (
                <span className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping pointer-events-none" />
              )}
            </div>

            <div className="font-semibold text-xs sm:text-sm text-foreground">
              Giám khảo IELTS (Dr. Harrison)
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {voiceActivity === "ai_speaking"
                ? "Đang đặt câu hỏi & lắng nghe..."
                : isConnected
                  ? "Sẵn sàng hội thoại"
                  : "Chưa kết nối"}
            </p>
          </div>

          {/* Candidate Card */}
          <div
            data-testid="candidate-stage-card"
            className={cn(
              "flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl border text-center transition-all bg-gradient-to-b from-emerald-500/5 to-transparent",
              voiceActivity === "user_speaking" &&
                "ring-2 ring-emerald-500 bg-emerald-500/10 shadow-xs"
            )}
          >
            <div className="relative mb-2.5">
              <div
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-md transition-transform",
                  voiceActivity === "user_speaking" && "scale-105"
                )}
              >
                <User className="w-7 h-7" />
              </div>
              {voiceActivity === "user_speaking" && (
                <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping pointer-events-none" />
              )}
            </div>

            <div className="font-semibold text-xs sm:text-sm text-foreground">
              {candidateName}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isMuted
                ? "Microphone đang tắt tiếng"
                : voiceActivity === "user_speaking"
                  ? "Đang trả lời câu hỏi..."
                  : isConnected
                    ? "Microphone đang bật (Nói tự nhiên)"
                    : "Sẵn sàng"}
            </p>
          </div>
        </div>

        {/* Part 2 Cue Card Modal & Prep Countdown */}
        {examStage === 2 && cueCardData && (
          <LiveSpeakingCueCardModal
            cueCard={cueCardData}
            phase={part2Phase}
            prepTimeRemaining={prepTimeRemaining}
            notes={scratchpadNotes}
            onNotesChange={setScratchpadNotes}
            onFinishPrepEarly={finishPart2PrepEarly}
          />
        )}

        {/* Real-time Subtitle & Transcript Stream */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-medium text-muted-foreground">
              Phụ đề & Gỡ băng hội thoại trực tiếp:
            </span>
            {mockMode && (
              <Badge
                variant="outline"
                className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold"
              >
                Mock Simulation Mode
              </Badge>
            )}
          </div>
          <LiveTranscriptStream transcripts={transcripts} />
        </div>
      </CardContent>

      {/* Footer Controls */}
      <CardFooter className="flex items-center justify-between border-t bg-muted/10 px-5 py-3.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-800 dark:text-emerald-300" />
          <span>Mô hình: Gemini 3.1 Flash Live</span>
        </div>

        <LiveSessionControls
          status={status}
          isMuted={isMuted}
          isNoiseSuppressionActive={isNoiseSuppressionActive}
          inputVolume={inputVolume}
          onConnect={connect}
          onDisconnect={disconnect}
          onToggleMute={toggleMute}
          onToggleNoiseSuppression={toggleNoiseSuppression}
        />
      </CardFooter>
    </Card>
  );
}
