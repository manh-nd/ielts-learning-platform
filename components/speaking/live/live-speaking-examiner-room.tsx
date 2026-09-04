"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Sparkles,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
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
import { FreeTierConsentNoticeModal } from "./free-tier-consent-notice-modal";
import { MicPermissionDeniedDialog } from "./mic-permission-denied-dialog";
import { useGeminiLive } from "./use-gemini-live";
import {
  LiveSpeakingConfig,
  CandidateTurnMarker,
  RecordedAudioData,
} from "./types";
import {
  IeltsSpeakingEvaluationResult,
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";
import {
  dispatchPracticeStarted,
  dispatchPracticeAudioRecorded,
  dispatchPracticeSubmittedForFeedback,
  dispatchPracticeFeedbackReady,
  dispatchPracticeAgainStarted,
  dispatchPracticeAudioError,
} from "@/lib/telemetry/telemetry-client";

export interface LiveSpeakingExaminerRoomProps extends LiveSpeakingConfig {
  title?: string;
  subtitle?: string;
  className?: string;
  hasConsent?: boolean;
  onConsentGranted?: () => void;
  initialSessionId?: string | null;
  onSessionChange?: (sessionId: string | null) => void;
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
  hasConsent = false,
  onConsentGranted,
  initialSessionId = null,
  onSessionChange,
  onBackToDashboard,
  onRestart,
  ...config
}: LiveSpeakingExaminerRoomProps) {
  const finishExamActionRef = useRef<() => void>(() => {});

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
    onExamCompleted: () => {
      finishExamActionRef.current?.();
    },
    ...config,
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => initialSessionId || `ses_live_${Date.now()}`
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

  // Consent & Permission States
  const [hasLocalConsent, setHasLocalConsent] = useState<boolean>(false);
  const effectiveHasConsent = Boolean(hasConsent || hasLocalConsent);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);

  const [micDialogDismissed, setMicDialogDismissed] = useState<boolean>(false);
  const isMicDenied = status === "permission_denied";
  const showMicPermissionDialog = isMicDenied && !micDialogDismissed;

  // Audio Upload Resilience States
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);
  const [savedFinalizedAudio, setSavedFinalizedAudio] =
    useState<RecordedAudioData | null>(null);

  const handleStartConnect = useCallback(async () => {
    if (!effectiveHasConsent) {
      setShowConsentModal(true);
      return;
    }
    setMicDialogDismissed(false);
    dispatchPracticeStarted(activeSessionId, {
      topic_title: topic?.title,
      target_part: targetPart,
    });
    await connect();
  }, [effectiveHasConsent, connect, activeSessionId, topic?.title, targetPart]);

  const handleConsentGranted = useCallback(async () => {
    setHasLocalConsent(true);
    setShowConsentModal(false);
    onConsentGranted?.();
    setMicDialogDismissed(false);
    dispatchPracticeStarted(activeSessionId, {
      topic_title: topic?.title,
      target_part: targetPart,
      consent_granted: true,
    });
    await connect();
  }, [onConsentGranted, connect, activeSessionId, topic?.title, targetPart]);

  // Telemetry: Mic permission denied tracking
  useEffect(() => {
    if (status === "permission_denied") {
      dispatchPracticeAudioError(
        activeSessionId,
        "PERMISSION_DENIED",
        "Microphone access was denied by learner or browser"
      );
    }
  }, [status, activeSessionId]);

  // Session state restoration from URL or sessionStorage
  useEffect(() => {
    let isCancelled = false;
    const sessionToRestore =
      initialSessionId ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("ielts_active_speaking_session_id")
        : null);

    if (
      sessionToRestore &&
      !isExamFinished &&
      !evaluationResult &&
      !practiceFeedback
    ) {
      const restoreSession = async () => {
        try {
          const res = await fetch(
            `/api/speaking/evaluate?sessionId=${encodeURIComponent(sessionToRestore)}`
          );
          if (!res.ok) return;
          const data = await res.json();
          if (isCancelled || !data?.success || !data?.session) return;

          const pSession = data.session;
          const responses = data.responses || [];

          setActiveSessionId(pSession.id);
          if (responses.length > 0 && responses[0].storageKey) {
            setPersistedStorageKey(responses[0].storageKey);
          }

          if (pSession.status === "evaluated" && pSession.scorecardJson) {
            setPracticeFeedback(pSession.scorecardJson as PracticeFeedback);
            if (pSession.evidenceJson?.trace) {
              setTraceMetadata(
                pSession.evidenceJson.trace as SpeakingEvaluationTrace
              );
            }
            setIsExamFinished(true);
          } else if (pSession.status === "completed") {
            setIsExamFinished(true);
            if (pSession.evidenceJson?.evaluationStatus === "failed") {
              setEvalError(
                pSession.evidenceJson.evaluationError ||
                  "Lần phân tích trước bị gián đoạn. Vui lòng bấm thử phân tích lại."
              );
            }
          }
        } catch (err) {
          console.warn("[LiveExaminerRoom] Session restoration error:", err);
        }
      };

      restoreSession();
    }

    return () => {
      isCancelled = true;
    };
  }, [initialSessionId, isExamFinished, evaluationResult, practiceFeedback]);

  // Audio upload with exponential backoff
  const uploadAudioWithRetry = useCallback(
    async (
      sessionId: string,
      blob: Blob,
      mimeType: string,
      maxRetries = 2
    ): Promise<string> => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, attempt === 1 ? 500 : 1500));
        }
        try {
          const uploadUrlRes = await fetch("/api/speaking/upload-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              filename: "candidate.webm",
              mimeType,
            }),
          });
          if (!uploadUrlRes.ok) {
            throw new Error(
              `Upload URL request failed (${uploadUrlRes.status})`
            );
          }
          const uploadInfo = (await uploadUrlRes.json()) as {
            uploadUrl: string;
            storageKey: string;
          };
          const putRes = await fetch(uploadInfo.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": mimeType },
            body: blob,
          });
          if (!putRes.ok) {
            throw new Error(`Storage PUT failed (${putRes.status})`);
          }
          return uploadInfo.storageKey;
        } catch (err) {
          lastErr = err;
          console.warn(
            `[LiveExaminerRoom] Audio upload attempt ${attempt + 1} failed:`,
            err
          );
        }
      }
      throw lastErr;
    },
    []
  );

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
        audioBase64ToUse || persistedAudioBase64 || undefined;

      try {
        dispatchPracticeSubmittedForFeedback(resolvedSessionId, {
          target_part: isPart1Practice ? "part_1" : "full",
        });
        const evalStartTime = Date.now();

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
        const evalDurationMs = Date.now() - evalStartTime;
        const overallBand = data.isPractice
          ? undefined
          : (data.result as IeltsSpeakingEvaluationResult)?.overallScorecard
              ?.overallBand;

        dispatchPracticeFeedbackReady(resolvedSessionId, evalDurationMs, {
          is_practice: Boolean(data.isPractice),
          ...(overallBand !== undefined ? { overall_band: overallBand } : {}),
        });

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
    if (isEvaluating) return;
    setIsEvaluating(true);
    setIsExamFinished(true);
    setEvalError(null);
    setUploadError(null);

    const finalizedAudio = await disconnect();
    setSavedFinalizedAudio(finalizedAudio);

    // Save session in sessionStorage and update URL for refresh recovery
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "ielts_active_speaking_session_id",
        activeSessionId
      );
      const url = new URL(window.location.href);
      url.searchParams.set("sessionId", activeSessionId);
      window.history.replaceState(null, "", url.toString());
    }
    onSessionChange?.(activeSessionId);

    let storageKey = "";
    let base64Audio = "";
    const hasValidAudioBlob = Boolean(
      finalizedAudio?.blob && finalizedAudio.blob.size > 0
    );

    // 1. Convert to base64 as guaranteed fallback
    if (hasValidAudioBlob && finalizedAudio?.blob) {
      dispatchPracticeAudioRecorded(
        activeSessionId,
        Math.round((finalizedAudio.durationSeconds || 0) * 1000),
        finalizedAudio.blob.size,
        {
          mime_type: finalizedAudio.mimeType || "audio/webm;codecs=opus",
          turn_count: turnMarkers.length,
        }
      );

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
          "[LiveExaminerRoom] Could not read audio blob as base64:",
          readErr
        );
      }

      // 2. Upload to storage with 2 silent retries and exponential backoff
      setIsUploadingAudio(true);
      try {
        storageKey = await uploadAudioWithRetry(
          activeSessionId,
          finalizedAudio.blob,
          finalizedAudio.mimeType || "audio/webm;codecs=opus",
          2
        );
        setPersistedStorageKey(storageKey);
      } catch (uploadErr) {
        console.warn(
          "[LiveExaminerRoom] Direct storage upload failed after retries:",
          uploadErr
        );
        setIsUploadingAudio(false);
        setIsEvaluating(false);
        setUploadError(
          "Không thể tải tệp âm thanh lên máy chủ do lỗi kết nối mạng. Bản thu âm của bạn vẫn được bảo toàn trong bộ nhớ."
        );
        return;
      }
      setIsUploadingAudio(false);
    }

    if (
      !hasValidAudioBlob &&
      !base64Audio &&
      !storageKey &&
      !persistedAudioBase64 &&
      !persistedStorageKey
    ) {
      dispatchPracticeAudioError(
        activeSessionId,
        "EMPTY_AUDIO_RECORDING",
        "Chưa ghi nhận được âm thanh từ microphone (0 bytes)."
      );
      setEvalError(
        "Chưa ghi nhận được âm thanh từ microphone. Vui lòng nói vào microphone trước khi nộp bài."
      );
      setIsEvaluating(false);
      return;
    }

    await triggerEvaluation(
      activeSessionId,
      storageKey,
      base64Audio,
      finalizedAudio?.durationSeconds,
      turnMarkers
    );
  }, [
    activeSessionId,
    disconnect,
    isEvaluating,
    onSessionChange,
    persistedAudioBase64,
    persistedStorageKey,
    triggerEvaluation,
    turnMarkers,
    uploadAudioWithRetry,
  ]);

  const handleRetryUpload = useCallback(async () => {
    if (!savedFinalizedAudio?.blob) return;
    setIsUploadingAudio(true);
    setUploadError(null);
    setIsEvaluating(true);
    try {
      const storageKey = await uploadAudioWithRetry(
        activeSessionId,
        savedFinalizedAudio.blob,
        savedFinalizedAudio.mimeType || "audio/webm;codecs=opus",
        2
      );
      setPersistedStorageKey(storageKey);
      setIsUploadingAudio(false);
      await triggerEvaluation(
        activeSessionId,
        storageKey,
        persistedAudioBase64 || undefined,
        savedFinalizedAudio.durationSeconds,
        turnMarkers
      );
    } catch (err) {
      console.error("[LiveExaminerRoom] Retry upload failed:", err);
      setIsUploadingAudio(false);
      setIsEvaluating(false);
      setUploadError(
        "Tải lên lại vẫn thất bại do gián đoạn kết nối mạng. Vui lòng kiểm tra đường truyền và thử lại."
      );
    }
  }, [
    activeSessionId,
    persistedAudioBase64,
    savedFinalizedAudio,
    triggerEvaluation,
    turnMarkers,
    uploadAudioWithRetry,
  ]);

  useEffect(() => {
    finishExamActionRef.current = handleFinishExam;
  });

  // If upload failed, display the Upload Recovery Card with audio preview & retry button
  if (uploadError && !isEvaluating) {
    return (
      <Card
        data-testid="upload-failure-recovery-card"
        className={cn(
          "w-full max-w-4xl mx-auto p-6 sm:p-8 shadow-md border-rose-500/40 bg-background",
          className
        )}
      >
        <div className="flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-foreground">
              Tải tệp âm thanh thất bại
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
              {uploadError}
            </p>
          </div>

          {savedFinalizedAudio?.url && (
            <div className="w-full bg-muted/40 p-3 rounded-lg border space-y-2">
              <span className="text-[11px] font-medium text-muted-foreground block">
                Nghe lại bản thu đã lưu trong bộ nhớ:
              </span>
              <audio
                controls
                src={savedFinalizedAudio.url}
                className="w-full h-8"
              />
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              size="sm"
              onClick={handleRetryUpload}
              disabled={isUploadingAudio}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 cursor-pointer text-xs"
            >
              {isUploadingAudio ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang thử lại...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Thử tải lên lại</span>
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setUploadError(null);
                setIsExamFinished(false);
              }}
              disabled={isUploadingAudio}
              className="cursor-pointer text-xs"
            >
              Quay lại
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // If exam has finished, display the comprehensive Result View
  if (isExamFinished) {
    return (
      <LiveSpeakingResultView
        evaluationResult={evaluationResult}
        practiceFeedback={practiceFeedback}
        traceMetadata={traceMetadata}
        isPracticeMode={isPart1Practice}
        isLoading={isEvaluating}
        error={evalError}
        recordedAudio={savedFinalizedAudio || recordedAudio}
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
          setSavedFinalizedAudio(null);
          setUploadError(null);
          const newSessionId = `ses_live_${Date.now()}`;
          dispatchPracticeAgainStarted(newSessionId, {
            previous_session_id: activeSessionId,
          });
          setActiveSessionId(newSessionId);
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("ielts_active_speaking_session_id");
            const url = new URL(window.location.href);
            url.searchParams.delete("sessionId");
            window.history.replaceState(null, "", url.pathname);
          }
          onSessionChange?.(null);
          onRestart?.();
        }}
        onBackToDashboard={() => {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("ielts_active_speaking_session_id");
            const url = new URL(window.location.href);
            url.searchParams.delete("sessionId");
            window.history.replaceState(null, "", url.pathname);
          }
          onSessionChange?.(null);
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
          onConnect={handleStartConnect}
          onDisconnect={handleFinishExam}
          onToggleMute={toggleMute}
          onToggleNoiseSuppression={toggleNoiseSuppression}
          onRequestPermissionDialog={() => setMicDialogDismissed(false)}
        />
      </CardFooter>

      {/* Free Tier Consent Gate Modal */}
      <FreeTierConsentNoticeModal
        open={showConsentModal}
        onConsent={handleConsentGranted}
        onCancel={() => setShowConsentModal(false)}
      />

      {/* Microphone Permission Denied Instructional Dialog */}
      <MicPermissionDeniedDialog
        open={showMicPermissionDialog}
        onRetry={() => {
          setMicDialogDismissed(false);
          connect();
        }}
        onClose={() => setMicDialogDismissed(true)}
      />
    </Card>
  );
}
