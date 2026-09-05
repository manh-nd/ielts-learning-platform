"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
import { LiveSpeakingResultView } from "./live-speaking-result-view";
import { FreeTierConsentNoticeModal } from "./free-tier-consent-notice-modal";
import { MicPermissionDeniedDialog } from "./mic-permission-denied-dialog";
import { useGeminiLive } from "./use-gemini-live";
import {
  RecordedAudioData,
  ACTIVE_SPEAKING_SESSION_STORAGE_KEY,
  clearActiveSpeakingSession,
} from "./types";
import { SpeakingPracticeTopic } from "@/lib/data/speaking-practice-topics";
import { SpeakingMockTopic } from "@/lib/data/speaking-mock-topics";
import {
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";
import {
  dispatchPracticeStarted,
  dispatchPracticeAgainStarted,
  dispatchPracticeAudioError,
} from "@/lib/telemetry/telemetry-client";
import { CANONICAL_SPEAKING_PRACTICE_SCOPE } from "@/modules/speaking/domain";
import {
  finishSpeakingPracticeWorkflow,
  retrySpeakingPracticeEvaluationWorkflow,
  retrySpeakingAudioUploadWorkflow,
  restoreSpeakingPracticeWorkflow,
  type SpeakingPracticeWorkflowOutcome,
  type SpeakingPracticeWorkflowPorts,
} from "@/modules/speaking/application/speaking-practice-workflow";
import { createSpeakingPracticeBrowserPorts } from "@/modules/speaking/infrastructure/browser/speaking-practice-browser-adapter";

/**
 * Internal Compatibility Debt:
 * Adapts SpeakingPracticeTopic to satisfy legacy useGeminiLive engine's topic shape requirement.
 *
 * CRITICAL INVARIANTS:
 * - private/internal only
 * - placeholder Part 2/3 MUST never be exposed to Practice UI
 * - MUST never be interpreted as real Mock content
 * - targetPart="part_1" (CANONICAL_SPEAKING_PRACTICE_SCOPE) guarantees these placeholder fields are unreachable
 * - do not export this as a reusable Practice/Mock abstraction
 */
function adaptPracticeTopicToLiveEngine(
  topic?: SpeakingPracticeTopic
): SpeakingMockTopic | undefined {
  if (!topic) return undefined;
  return {
    id: topic.id,
    title: topic.title,
    category: topic.category,
    description: topic.description,
    difficulty: topic.difficulty,
    part1: topic.part1,
    // Technical placeholder debt for legacy engine only; unreachable in Part 1 practice
    part2: {
      topicTitle: "",
      cueCardPrompt: "",
      bulletPoints: [],
    },
    part3: {
      theme: "",
      questions: [],
    },
  };
}

export interface LiveSpeakingExaminerRoomProps {
  title?: string;
  subtitle?: string;
  candidateName?: string;
  topic?: SpeakingPracticeTopic;
  mockMode?: boolean;
  className?: string;
  hasConsent?: boolean;
  onConsentGranted?: () => void;
  initialSessionId?: string | null;
  onSessionChange?: (sessionId: string | null) => void;
  onBackToDashboard?: () => void;
  onRestart?: () => void;
  workflowPorts?: SpeakingPracticeWorkflowPorts;
}

export function LiveSpeakingExaminerRoom({
  title = "Phòng Luyện Tập IELTS Speaking Trực Tiếp",
  subtitle = "Đối thoại thời gian thực 1-on-1 với Giám khảo AI (Examiner)",
  candidateName = "Thí sinh",
  topic,
  mockMode = false,
  className,
  hasConsent = false,
  onConsentGranted,
  initialSessionId = null,
  onSessionChange,
  onBackToDashboard,
  onRestart,
  workflowPorts,
}: LiveSpeakingExaminerRoomProps) {
  const finishExamActionRef = useRef<() => void>(() => {});
  const defaultWorkflowPorts = useMemo(
    () => createSpeakingPracticeBrowserPorts(),
    []
  );
  const effectiveWorkflowPorts = workflowPorts || defaultWorkflowPorts;
  const targetPart = CANONICAL_SPEAKING_PRACTICE_SCOPE;

  const {
    status,
    voiceActivity,
    examStage,
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
  } = useGeminiLive({
    candidateName,
    topic: adaptPracticeTopicToLiveEngine(topic),
    targetPart,
    mockMode,
    onExamCompleted: () => {
      finishExamActionRef.current?.();
    },
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(
    () => initialSessionId || `ses_live_${Date.now()}`
  );
  const [persistedStorageKey] = useState<string | null>(null);
  const [persistedAudioBase64] = useState<string | null>(null);
  const [practiceFeedback, setPracticeFeedback] =
    useState<PracticeFeedback | null>(null);
  const [traceMetadata, setTraceMetadata] =
    useState<SpeakingEvaluationTrace | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [canRetryEvaluation, setCanRetryEvaluation] = useState<boolean>(false);
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

  const applyWorkflowOutcome = useCallback(
    (outcome: SpeakingPracticeWorkflowOutcome) => {
      switch (outcome.status) {
        case "audio_missing":
          setEvalError(outcome.error);
          setIsEvaluating(false);
          break;
        case "audio_persistence_failed":
          setUploadError(outcome.error);
          setIsUploadingAudio(false);
          setIsEvaluating(false);
          break;
        case "feedback_ready":
          setPracticeFeedback(outcome.feedback);
          if (outcome.trace) {
            setTraceMetadata(outcome.trace);
          }
          setCanRetryEvaluation(false);
          setIsExamFinished(true);
          setIsEvaluating(false);
          break;
        case "evaluation_failed":
          setEvalError(outcome.error);
          setCanRetryEvaluation(outcome.canRetry);
          setIsExamFinished(true);
          setIsEvaluating(false);
          break;
      }
    },
    []
  );

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

  const isConnected = status === "connected";

  // Session state restoration from URL or sessionStorage (Practice-only application workflow)
  useEffect(() => {
    let isCancelled = false;
    const sessionToRestore =
      initialSessionId ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem(ACTIVE_SPEAKING_SESSION_STORAGE_KEY)
        : null);

    if (sessionToRestore && !isExamFinished && !practiceFeedback) {
      const restorePractice = async () => {
        try {
          const restored = await restoreSpeakingPracticeWorkflow(
            sessionToRestore,
            effectiveWorkflowPorts
          );
          if (isCancelled || !restored) return;

          setActiveSessionId(restored.sessionId);

          switch (restored.status) {
            case "ended_feedback_ready":
              setPracticeFeedback(restored.feedback);
              if (restored.trace) {
                setTraceMetadata(restored.trace);
              }
              setCanRetryEvaluation(false);
              setIsExamFinished(true);
              setIsEvaluating(false);
              setEvalError(null);
              break;

            case "ended_evaluation_failed_retryable":
              setEvalError(restored.error);
              setCanRetryEvaluation(true);
              setIsExamFinished(true);
              setIsEvaluating(false);
              break;

            case "ended_audio_unavailable":
              setEvalError(restored.error);
              setCanRetryEvaluation(false);
              setIsExamFinished(true);
              setIsEvaluating(false);
              break;

            case "ended_evaluating":
              setIsExamFinished(true);
              setIsEvaluating(true);
              setCanRetryEvaluation(false);
              setEvalError(null);
              break;

            case "in_progress":
              setIsExamFinished(false);
              setIsEvaluating(false);
              setCanRetryEvaluation(false);
              break;
          }
        } catch (err) {
          console.warn(
            "[LiveExaminerRoom] Speaking practice restoration error:",
            err
          );
        }
      };

      restorePractice();
    }

    return () => {
      isCancelled = true;
    };
  }, [
    initialSessionId,
    isExamFinished,
    practiceFeedback,
    effectiveWorkflowPorts,
  ]);

  // Finish exam manually or automatically (SpeakingPractice application workflow)
  const handleFinishExam = useCallback(async () => {
    if (isEvaluating) return;
    setIsEvaluating(true);
    setIsExamFinished(true);
    setEvalError(null);
    setUploadError(null);

    const finalizedAudio = await disconnect();
    setSavedFinalizedAudio(finalizedAudio);

    onSessionChange?.(activeSessionId);

    const outcome = await finishSpeakingPracticeWorkflow(
      {
        sessionId: activeSessionId,
        candidateName,
        topicTitle: topic?.title,
        questions: topic?.part1.questions,
        part1Question: topic?.part1.questions?.[0],
        transcripts,
        turnMarkers,
        audio: finalizedAudio,
        durationSeconds: finalizedAudio?.durationSeconds,
        persistedStorageKey: persistedStorageKey || undefined,
        persistedAudioBase64: persistedAudioBase64 || undefined,
      },
      effectiveWorkflowPorts
    );
    applyWorkflowOutcome(outcome);
  }, [
    activeSessionId,
    applyWorkflowOutcome,
    candidateName,
    disconnect,
    effectiveWorkflowPorts,
    isEvaluating,
    onSessionChange,
    persistedAudioBase64,
    persistedStorageKey,
    topic,
    transcripts,
    turnMarkers,
  ]);

  const handleRetryUpload = useCallback(async () => {
    if (!savedFinalizedAudio?.blob) return;
    setIsUploadingAudio(true);
    setUploadError(null);
    setIsEvaluating(true);

    const outcome = await retrySpeakingAudioUploadWorkflow(
      {
        sessionId: activeSessionId,
        audio: savedFinalizedAudio,
        candidateName,
        topicTitle: topic?.title,
        questions: topic?.part1.questions,
        part1Question: topic?.part1.questions?.[0],
        transcripts,
        turnMarkers,
        audioBase64: persistedAudioBase64 || undefined,
      },
      effectiveWorkflowPorts
    );
    applyWorkflowOutcome(outcome);
  }, [
    activeSessionId,
    applyWorkflowOutcome,
    candidateName,
    effectiveWorkflowPorts,
    persistedAudioBase64,
    savedFinalizedAudio,
    topic,
    transcripts,
    turnMarkers,
  ]);

  const handleRetryEvaluation = useCallback(async () => {
    setIsEvaluating(true);
    setEvalError(null);
    const outcome = await retrySpeakingPracticeEvaluationWorkflow(
      {
        sessionId: activeSessionId,
        candidateName,
        topicTitle: topic?.title,
        questions: topic?.part1.questions,
        part1Question: topic?.part1.questions?.[0],
        transcripts,
        turnMarkers,
        storageKey: persistedStorageKey || undefined,
        audioBase64: persistedAudioBase64 || undefined,
        durationSeconds: savedFinalizedAudio?.durationSeconds,
      },
      effectiveWorkflowPorts
    );
    applyWorkflowOutcome(outcome);
  }, [
    activeSessionId,
    candidateName,
    topic,
    transcripts,
    turnMarkers,
    persistedStorageKey,
    persistedAudioBase64,
    savedFinalizedAudio?.durationSeconds,
    effectiveWorkflowPorts,
    applyWorkflowOutcome,
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
                const confirmed =
                  typeof window === "undefined" ||
                  window.confirm(
                    "Bản thu âm chưa được tải lên sẽ bị hủy. Bạn có chắc chắn muốn hủy và thu âm lại không?"
                  );
                if (!confirmed) return;
                setUploadError(null);
                setIsExamFinished(false);
                setSavedFinalizedAudio(null);
                clearActiveSpeakingSession();
              }}
              disabled={isUploadingAudio}
              className="cursor-pointer text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
            >
              Hủy và thu âm lại
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // If exam has finished, display the comprehensive Result View for SpeakingPractice
  if (isExamFinished) {
    return (
      <LiveSpeakingResultView
        practiceFeedback={practiceFeedback}
        traceMetadata={traceMetadata}
        isPracticeMode={true}
        isLoading={isEvaluating}
        error={evalError}
        recordedAudio={savedFinalizedAudio || recordedAudio}
        transcripts={transcripts}
        onRetryEvaluation={
          canRetryEvaluation ? handleRetryEvaluation : undefined
        }
        onRestartTest={() => {
          setIsExamFinished(false);
          setPracticeFeedback(null);
          setTraceMetadata(null);
          setSavedFinalizedAudio(null);
          setUploadError(null);
          setCanRetryEvaluation(false);
          const newSessionId = `ses_live_${Date.now()}`;
          dispatchPracticeAgainStarted(newSessionId, {
            previous_session_id: activeSessionId,
          });
          setActiveSessionId(newSessionId);
          clearActiveSpeakingSession();
          onSessionChange?.(null);
          onRestart?.();
        }}
        onBackToDashboard={() => {
          clearActiveSpeakingSession();
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
