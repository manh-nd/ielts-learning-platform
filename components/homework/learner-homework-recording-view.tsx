"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  MicIcon,
  SquareIcon,
  RotateCcwIcon,
  PlayIcon,
  PauseIcon,
  SendIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
  LockIcon,
  HelpCircleIcon,
  Volume2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useLiveAudioRecorder } from "@/components/speaking/live/hooks/use-live-audio-recorder";
import { FreeTierConsentNoticeModal } from "@/components/speaking/live/free-tier-consent-notice-modal";
import { PcmAudioController } from "@/lib/audio/pcm-audio-controller";
import {
  dispatchHomeworkViewed,
  dispatchHomeworkRecordCompleted,
} from "@/lib/telemetry/telemetry-client";
import type {
  HomeworkSubmission,
  SubmissionAttempt,
} from "@/modules/homework/domain/homework-types";
import { commitHomeworkAttempt } from "./client/commit-homework-attempt";
import type { LearnerHomeworkDetail } from "@/modules/homework/application/homework-read-models";

export interface RecordedClipData {
  blob?: Blob;
  url?: string;
  durationSeconds: number;
  storageKey?: string;
}

export interface LearnerHomeworkRecordingViewProps {
  detail: LearnerHomeworkDetail;
  mockMode?: boolean;
  hasConsent?: boolean;
  onConsentGranted?: () => void;
  initialRecordedClips?: Record<string, RecordedClipData>;
  onSubmitted?: (
    submission: HomeworkSubmission,
    attempt: SubmissionAttempt
  ) => void;
  className?: string;
}

export function LearnerHomeworkRecordingView({
  detail,
  mockMode = false,
  hasConsent: initialHasConsent = false,
  onConsentGranted,
  initialRecordedClips = {},
  onSubmitted,
  className,
}: LearnerHomeworkRecordingViewProps) {
  const { assignment, classroom } = detail;
  const prompts = assignment.prompts;

  // Local submission state
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(
    detail.submission
  );
  const [hasConsent, setHasConsent] = useState(Boolean(initialHasConsent));
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingPromptId, setPendingPromptId] = useState<string | null>(null);

  // Active recording prompt
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Audio clips map: promptId -> RecordedClipData
  const [recordedClips, setRecordedClips] = useState<
    Record<string, RecordedClipData>
  >(() => {
    const initial: Record<string, RecordedClipData> = {
      ...initialRecordedClips,
    };
    // If there is already a submitted current attempt, populate storage keys
    if (detail.currentAttempt?.audioResponses) {
      for (const resp of detail.currentAttempt.audioResponses) {
        if (!initial[resp.promptId]) {
          initial[resp.promptId] = {
            storageKey: resp.storageKey,
            durationSeconds: Math.round(resp.durationMs / 1000),
          };
        }
      }
    }
    return initial;
  });

  // Currently playing audio promptId
  const [playingPromptId, setPlayingPromptId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Status & Concurrency
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isConflictLocked, setIsConflictLocked] = useState(
    detail.submission?.status === "in_review"
  );

  // Controllers
  const pcmControllerRef = useRef<PcmAudioController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { startRecording, finalizeRecording, resetRecording } =
    useLiveAudioRecorder();

  // Send homework_viewed telemetry on mount
  useEffect(() => {
    dispatchHomeworkViewed(assignment.id);
  }, [assignment.id]);

  // Clean up audio playback on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const deadlineDate = useMemo(
    () => new Date(assignment.submissionDeadline),
    [assignment.submissionDeadline]
  );
  const now = new Date();
  const isPastDeadline = deadlineDate.getTime() < now.getTime();

  // Format dates in Vietnamese
  const formatDeadline = (d: Date) => {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isReadOnly =
    isConflictLocked ||
    isPastDeadline ||
    submission?.status === "in_review" ||
    submission?.status === "published";

  // Start recording a specific discrete prompt
  const handleStartRecording = useCallback(
    async (promptId: string) => {
      if (isReadOnly || isSubmitting) return;

      // Consent Gate: Prompt FreeTierConsentNoticeModal if not consented yet
      if (!hasConsent && !mockMode) {
        setPendingPromptId(promptId);
        setShowConsentModal(true);
        return;
      }

      // Stop any existing playback
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setPlayingPromptId(null);
      }

      setActivePromptId(promptId);
      setRecordingSeconds(0);
      setSubmissionError(null);

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      if (mockMode) return;

      try {
        const controller = new PcmAudioController();
        pcmControllerRef.current = controller;
        await startRecording(controller);
      } catch (err) {
        console.error("[LearnerHomework] Start recording failed:", err);
        if (timerRef.current) clearInterval(timerRef.current);
        setActivePromptId(null);
        setSubmissionError(
          "Không thể truy cập microphone. Vui lòng cấp quyền micro cho trình duyệt."
        );
      }
    },
    [hasConsent, isReadOnly, isSubmitting, mockMode, startRecording]
  );

  const handleConsentGranted = useCallback(() => {
    setHasConsent(true);
    setShowConsentModal(false);
    onConsentGranted?.();
    if (pendingPromptId) {
      const pId = pendingPromptId;
      setPendingPromptId(null);
      handleStartRecording(pId);
    }
  }, [handleStartRecording, onConsentGranted, pendingPromptId]);

  // Stop and finalize recording for active prompt
  const handleStopRecording = useCallback(async () => {
    if (!activePromptId) return;
    const promptId = activePromptId;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const duration = Math.max(recordingSeconds, 1);

    if (mockMode) {
      // Create mock audio blob
      const mockBlob = new Blob(["mock-audio-data"], { type: "audio/webm" });
      const mockUrl = URL.createObjectURL(mockBlob);
      setRecordedClips((prev) => ({
        ...prev,
        [promptId]: {
          blob: mockBlob,
          url: mockUrl,
          durationSeconds: duration,
        },
      }));
      dispatchHomeworkRecordCompleted(
        assignment.id,
        promptId,
        duration * 1000,
        mockBlob.size
      );
      setActivePromptId(null);
      return;
    }

    try {
      const finalized = await finalizeRecording();
      if (finalized?.blob) {
        const url = URL.createObjectURL(finalized.blob);
        setRecordedClips((prev) => ({
          ...prev,
          [promptId]: {
            blob: finalized.blob,
            url,
            durationSeconds: finalized.durationSeconds || duration,
          },
        }));

        dispatchHomeworkRecordCompleted(
          assignment.id,
          promptId,
          Math.round((finalized.durationSeconds || duration) * 1000),
          finalized.blob.size
        );
      } else {
        setSubmissionError(
          "Không thu được dữ liệu âm thanh. Vui lòng nói vào micro và thử lại."
        );
      }
    } catch (err) {
      console.error("[LearnerHomework] Finalize recording error:", err);
      setSubmissionError("Lỗi khi xử lý file âm thanh vừa ghi.");
    } finally {
      if (pcmControllerRef.current) {
        pcmControllerRef.current.stopRecording();
        pcmControllerRef.current = null;
      }
      resetRecording();
      setActivePromptId(null);
    }
  }, [
    activePromptId,
    assignment.id,
    finalizeRecording,
    mockMode,
    recordingSeconds,
    resetRecording,
  ]);

  // Re-record action
  const handleRerecordPrompt = useCallback(
    (promptId: string) => {
      if (isConflictLocked || isPastDeadline || isSubmitting) return;
      if (playingPromptId === promptId && audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setPlayingPromptId(null);
      }

      setRecordedClips((prev) => {
        const next = { ...prev };
        delete next[promptId];
        return next;
      });

      handleStartRecording(promptId);
    },
    [
      handleStartRecording,
      isConflictLocked,
      isPastDeadline,
      isSubmitting,
      playingPromptId,
    ]
  );

  // Play / Pause audio clip
  const handleTogglePlay = useCallback(
    (promptId: string) => {
      const clip = recordedClips[promptId];
      if (!clip?.url) return;

      if (playingPromptId === promptId && audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setPlayingPromptId(null);
        return;
      }

      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }

      const audio = new Audio(clip.url);
      audioPlayerRef.current = audio;
      setPlayingPromptId(promptId);

      audio.onended = () => {
        setPlayingPromptId(null);
      };

      audio.onerror = () => {
        setPlayingPromptId(null);
      };

      audio.play().catch((err) => {
        console.warn("[LearnerHomework] Playback error:", err);
        setPlayingPromptId(null);
      });
    },
    [playingPromptId, recordedClips]
  );

  // Submit all recorded clips via extracted client workflow seam
  const handleSubmitHomework = useCallback(async () => {
    if (isConflictLocked || isPastDeadline || isSubmitting) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    const result = await commitHomeworkAttempt({
      assignmentId: assignment.id,
      prompts,
      recordedClips,
      mockMode,
      currentAttemptNumber: submission?.currentAttemptNumber,
    });

    // Cache any newly generated storage keys into recordedClips for subsequent retry attempts
    if (result.uploadedStorageKeys) {
      const keys = result.uploadedStorageKeys;
      setRecordedClips((prev) => {
        const next = { ...prev };
        for (const [promptId, storageKey] of Object.entries(keys)) {
          if (next[promptId]) {
            next[promptId] = {
              ...next[promptId],
              storageKey,
            };
          }
        }
        return next;
      });
    }

    setIsSubmitting(false);

    switch (result.kind) {
      case "committed": {
        setSubmission(result.submission);
        onSubmitted?.(result.submission, result.attempt);
        break;
      }
      case "conflict_locked": {
        setIsConflictLocked(true);
        setSubmissionError(result.message);
        break;
      }
      case "incomplete": {
        setSubmissionError(
          `Bạn chưa thu âm đủ các câu hỏi (${result.missingPromptCount} câu còn thiếu).`
        );
        break;
      }
      case "upload_failed":
      case "rejected": {
        setSubmissionError(result.message);
        break;
      }
    }
  }, [
    assignment.id,
    isConflictLocked,
    isPastDeadline,
    isSubmitting,
    mockMode,
    onSubmitted,
    prompts,
    recordedClips,
    submission?.currentAttemptNumber,
  ]);

  const recordedCount = prompts.filter((p) => recordedClips[p.promptId]).length;
  const allRecorded = recordedCount === prompts.length;

  return (
    <div
      data-testid="learner-homework-recording-view"
      className={cn("space-y-6 max-w-4xl mx-auto", className)}
    >
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/learner/dashboard" />}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          <span>Quay lại Bảng điều khiển</span>
        </Button>

        <Badge
          variant="outline"
          className="text-xs bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-700 font-medium"
        >
          {classroom.name}
        </Badge>
      </div>

      {/* Main Header Card */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MicIcon className="size-4" />
                </span>
                <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                  {assignment.title}
                </CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Bài tập Speaking gồm {prompts.length} câu hỏi độc lập. Vui lòng
                thu âm câu trả lời cho từng câu trước khi nộp.
              </p>
            </div>

            {/* Status Badges */}
            <div className="flex items-center gap-2 shrink-0">
              {submission?.status === "published" ? (
                <Badge
                  variant="outline"
                  className="bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border-purple-300 dark:border-purple-800 gap-1 text-xs font-semibold"
                >
                  <CheckCircle2Icon className="size-3" />
                  <span>Đã chấm xong</span>
                </Badge>
              ) : submission?.status === "in_review" || isConflictLocked ? (
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800 gap-1 text-xs font-semibold"
                >
                  <LockIcon className="size-3" />
                  <span>Đang được chấm</span>
                </Badge>
              ) : submission?.status === "submitted" ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 gap-1 text-xs font-semibold"
                >
                  <CheckCircle2Icon className="size-3" />
                  <span>Đã nộp (Lần #{submission.currentAttemptNumber})</span>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-700 text-xs font-semibold"
                >
                  Chưa nộp
                </Badge>
              )}

              <Badge
                variant="outline"
                className={cn(
                  "gap-1 text-xs font-semibold",
                  isPastDeadline
                    ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 border-red-300 dark:border-red-800"
                    : "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-800"
                )}
              >
                <ClockIcon className="size-3" />
                <span>
                  {isPastDeadline
                    ? "Đã hết hạn nộp"
                    : `Hạn: ${formatDeadline(deadlineDate)}`}
                </span>
              </Badge>
            </div>
          </div>
        </CardHeader>

        {assignment.instructions && (
          <CardContent className="border-t pt-4 text-xs text-muted-foreground">
            <div className="space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <HelpCircleIcon className="size-3.5 text-primary" />
                Hướng dẫn từ Giáo viên:
              </span>
              <p className="whitespace-pre-line leading-relaxed">
                {assignment.instructions}
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Conflict Lock Warning Banner (First-Committed-Wins State) */}
      {(isConflictLocked || submission?.status === "in_review") && (
        <Alert variant="warning" data-testid="conflict-warning-banner">
          <LockIcon className="size-4" />
          <AlertTitle className="font-bold">
            Bài làm đã được Giáo viên tiếp nhận chấm điểm
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 leading-relaxed font-medium">
            Giáo viên hiện đang xem xét và chấm điểm bài tập này. Theo quy tắc
            chấm bài chuẩn hóa, bài làm đã được khóa và không thể cập nhật bản
            thu mới. Bạn chỉ có thể nghe lại các câu trả lời đã gửi.
          </AlertDescription>
        </Alert>
      )}

      {/* Published Status Banner */}
      {submission?.status === "published" && (
        <Alert variant="info" data-testid="submission-published-banner">
          <CheckCircle2Icon className="size-4" />
          <AlertTitle className="font-bold">
            Bài làm đã có kết quả chính thức
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 leading-relaxed font-medium space-y-2">
            <p>
              Giáo viên đã hoàn tất chấm điểm và công bố kết quả cho bài làm
              này. Bạn có thể xem bảng điểm chi tiết hoặc nghe lại các câu trả
              lời đã nộp bên dưới.
            </p>
            <div>
              <Button
                variant="default"
                size="sm"
                render={
                  <Link href={`/learner/assignments/${assignment.id}/result`} />
                }
                data-testid="view-published-result-btn"
                className="gap-1.5 text-xs font-semibold h-7 px-3 mt-1"
              >
                <span>Xem Bảng Điểm & Nhận Xét Chi Tiết</span>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Submitted Success Banner */}
      {submission?.status === "submitted" && !isConflictLocked && (
        <Alert variant="success" data-testid="submission-success-banner">
          <CheckCircle2Icon className="size-4" />
          <AlertTitle className="font-bold">
            Bạn đã nộp bài thành công (Lượt nộp #
            {submission.currentAttemptNumber})
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 leading-relaxed font-medium">
            Bài làm của bạn đã sẵn sàng cho Giáo viên chấm điểm. Nếu muốn cải
            thiện câu trả lời, bạn có thể bấm &quot;Thu âm lại&quot; từng câu và
            nộp bản làm mới (Attempt #{submission.currentAttemptNumber + 1})
            trước khi hạn nộp kết thúc.
          </AlertDescription>
        </Alert>
      )}

      {/* Submission Error Banner */}
      {submissionError && (
        <Alert variant="destructive" data-testid="submission-error-alert">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Không thể nộp bài</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {submissionError}
          </AlertDescription>
        </Alert>
      )}

      {/* Discrete Prompts List */}
      <div className="space-y-4">
        {prompts.map((prompt, idx) => {
          const isRecordingThis = activePromptId === prompt.promptId;
          const isRecordingOther =
            activePromptId !== null && activePromptId !== prompt.promptId;
          const clip = recordedClips[prompt.promptId];
          const isPlayingThis = playingPromptId === prompt.promptId;

          return (
            <Card
              key={prompt.promptId}
              data-testid={`prompt-card-${prompt.promptId}`}
              className={cn(
                "border-border/70 shadow-xs transition-all",
                isRecordingThis &&
                  "border-primary ring-2 ring-primary/20 bg-primary/[0.02]"
              )}
            >
              <CardContent className="space-y-4">
                {/* Prompt Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[0.68rem] uppercase font-bold tracking-wider",
                          prompt.partNumber === 1
                            ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-800"
                            : prompt.partNumber === 2
                              ? "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border-purple-300 dark:border-purple-800"
                              : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800"
                        )}
                      >
                        Part {prompt.partNumber} • Câu hỏi {idx + 1}
                      </Badge>

                      {clip && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 text-[0.68rem] gap-1 font-semibold"
                        >
                          <CheckCircle2Icon className="size-3 text-emerald-700 dark:text-emerald-300" />
                          Đã thu ({formatSeconds(clip.durationSeconds)})
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-foreground leading-snug">
                      {prompt.text}
                    </h3>

                    {/* Sub Prompts */}
                    {prompt.subPrompts && prompt.subPrompts.length > 0 && (
                      <div className="bg-muted/40 rounded-lg p-3 border border-border/40 mt-2">
                        <span className="text-xs font-semibold text-muted-foreground block mb-1">
                          Gợi ý triển khai ý tưởng:
                        </span>
                        <ul className="list-disc list-inside text-xs text-foreground/80 space-y-0.5">
                          {prompt.subPrompts.map((sub, sIdx) => (
                            <li key={sIdx}>{sub}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recorder Control Area */}
                <div className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Case 1: Currently Recording */}
                  {isRecordingThis ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5">
                        <span className="size-3 rounded-full bg-red-500 animate-ping" />
                        <span className="text-sm font-mono font-bold text-red-600 dark:text-red-400">
                          {formatSeconds(recordingSeconds)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Đang thu âm microphone...
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleStopRecording}
                        className="gap-1.5 cursor-pointer text-xs"
                      >
                        <SquareIcon className="size-3.5 fill-current" />
                        <span>Hoàn thành câu trả lời</span>
                      </Button>
                    </div>
                  ) : clip ? (
                    /* Case 2: Already Recorded - Playback & Rerecord */
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTogglePlay(prompt.promptId)}
                          disabled={!clip.url}
                          className="gap-1.5 text-xs cursor-pointer h-8"
                          aria-label={
                            isPlayingThis
                              ? `Tạm dừng câu hỏi ${idx + 1}`
                              : `Phát lại câu hỏi ${idx + 1}`
                          }
                        >
                          {isPlayingThis ? (
                            <>
                              <PauseIcon className="size-3.5 text-primary" />
                              <span>Tạm dừng</span>
                            </>
                          ) : (
                            <>
                              <PlayIcon className="size-3.5 text-primary" />
                              <span>
                                Nghe lại ({formatSeconds(clip.durationSeconds)})
                              </span>
                            </>
                          )}
                        </Button>

                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Volume2Icon className="size-3" />
                          Đã lưu âm thanh
                        </span>
                      </div>

                      {!isReadOnly && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRerecordPrompt(prompt.promptId)}
                          disabled={isRecordingOther || isSubmitting}
                          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer h-8"
                        >
                          <RotateCcwIcon className="size-3.5" />
                          <span>Thu âm lại</span>
                        </Button>
                      )}
                    </div>
                  ) : (
                    /* Case 3: Idle (Not Recorded Yet) */
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-muted-foreground">
                        {isPastDeadline
                          ? "Đã quá thời hạn nộp bài."
                          : submission?.status === "published"
                            ? "Bài tập đã được công bố kết quả."
                            : isConflictLocked ||
                                submission?.status === "in_review"
                              ? "Bài tập đang được chấm điểm."
                              : "Chưa có bản ghi âm."}
                      </span>

                      {!isReadOnly && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartRecording(prompt.promptId)}
                          disabled={isRecordingOther || isSubmitting}
                          className="gap-1.5 text-xs font-medium cursor-pointer border-primary/30 text-primary hover:bg-primary/10 h-8"
                        >
                          <MicIcon className="size-3.5" />
                          <span>Bắt đầu thu âm</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Submission Action Bar */}
      <Card className="border-border/70 shadow-md sticky bottom-4 z-30 bg-card/95 backdrop-blur-md">
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                Tiến độ thu âm:
              </span>
              <span className="text-xs font-bold text-primary">
                {recordedCount} / {prompts.length} câu hỏi
              </span>
            </div>
            <Progress
              value={(recordedCount / prompts.length) * 100}
              className="h-1.5 w-48 sm:w-64"
            />
          </div>

          <div className="flex items-center gap-3">
            {submission?.status === "published" ? (
              <Button disabled variant="outline" className="gap-1.5 text-xs">
                <CheckCircle2Icon className="size-3.5 text-purple-600 dark:text-purple-400" />
                <span>Đã có kết quả (Khóa nộp lại)</span>
              </Button>
            ) : isConflictLocked || submission?.status === "in_review" ? (
              <Button disabled variant="outline" className="gap-1.5 text-xs">
                <LockIcon className="size-3.5 text-amber-500" />
                <span>Đang chấm điểm (Khóa nộp lại)</span>
              </Button>
            ) : isPastDeadline ? (
              <Button disabled variant="outline" className="gap-1.5 text-xs">
                <ClockIcon className="size-3.5 text-destructive" />
                <span>Đã hết hạn nộp bài</span>
              </Button>
            ) : (
              <Button
                onClick={handleSubmitHomework}
                disabled={
                  !allRecorded || isSubmitting || activePromptId !== null
                }
                className="gap-2 text-xs font-medium px-6 cursor-pointer"
                data-testid="submit-homework-btn"
              >
                {isSubmitting ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    <span>Đang nộp bài...</span>
                  </>
                ) : submission?.status === "submitted" ? (
                  <>
                    <SendIcon className="size-3.5" />
                    <span>
                      Nộp lại bài làm (Lần #
                      {submission.currentAttemptNumber + 1})
                    </span>
                  </>
                ) : (
                  <>
                    <SendIcon className="size-3.5" />
                    <span>Nộp bài tập Speaking</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Free Tier Pilot Consent Modal */}
      <FreeTierConsentNoticeModal
        open={showConsentModal}
        onConsent={handleConsentGranted}
        onCancel={() => {
          setShowConsentModal(false);
          setPendingPromptId(null);
        }}
      />
    </div>
  );
}
