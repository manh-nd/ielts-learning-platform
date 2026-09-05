"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type {
  SpeakingCriteriaScores,
  SpeakingCriteriaFeedback,
} from "@/modules/homework/domain/homework-types";
import { calculateIeltsSpeakingOverallBand } from "@/modules/homework/domain/homework-types";
import type { PublishAssessmentInput } from "@/modules/homework/application/homework-inputs";
import type { TeacherReviewCockpitData } from "@/modules/homework/application/homework-read-models";
import { useActiveReviewTimer } from "./hooks/use-active-review-timer";
import { AudioWaveformVisualizer } from "@/components/speaking/audio-waveform-visualizer";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Sparkles,
  RotateCcw,
  Mic,
  FileEdit,
  Play,
  Pause,
  AlertTriangle,
  ThumbsUp,
  Target,
  Send,
  Lock,
  PauseCircle,
} from "lucide-react";

export interface TeacherReviewCockpitProps {
  initialData: TeacherReviewCockpitData;
  mockMode?: boolean;
  onStartReview?: () => Promise<void>;
  onPublish?: (input: PublishAssessmentInput) => Promise<void>;
  className?: string;
  "data-testid"?: string;
}

export function TeacherReviewCockpit({
  initialData,
  mockMode = false,
  onStartReview,
  onPublish,
  className,
  "data-testid": testId = "teacher-review-cockpit",
}: TeacherReviewCockpitProps) {
  const {
    assignment,
    submission,
    attempt,
    student,
    aiProposal,
    teacherDraft,
    publishedAssessment,
  } = initialData;

  // Status state
  const [submissionStatus, setSubmissionStatus] = useState<string>(
    submission.status
  );
  const isPublished = submissionStatus === "published";
  const isInReview = submissionStatus === "in_review";
  const isPendingStart = submissionStatus === "submitted";

  // ActiveReviewTimer
  const { activeDurationMs, isPaused, pauseReason, formattedDuration } =
    useActiveReviewTimer({
      initialDurationMs: 0,
      isEnabled: isInReview && !isPublished,
    });

  // Criteria Scores state
  const defaultScores: SpeakingCriteriaScores = useMemo(() => {
    if (publishedAssessment) {
      return {
        fluencyAndCoherence: publishedAssessment.fluencyCoherence,
        lexicalResource: publishedAssessment.lexicalResource,
        grammaticalRangeAndAccuracy:
          publishedAssessment.grammaticalRangeAccuracy,
        pronunciation: publishedAssessment.pronunciation,
      };
    }
    if (teacherDraft) {
      return {
        fluencyAndCoherence: teacherDraft.fluencyCoherence,
        lexicalResource: teacherDraft.lexicalResource,
        grammaticalRangeAndAccuracy: teacherDraft.grammaticalRangeAccuracy,
        pronunciation: teacherDraft.pronunciation,
      };
    }
    if (aiProposal && aiProposal.status === "ready") {
      return { ...aiProposal.scores };
    }
    return {
      fluencyAndCoherence: 6.0,
      lexicalResource: 6.0,
      grammaticalRangeAndAccuracy: 6.0,
      pronunciation: 6.0,
    };
  }, [publishedAssessment, teacherDraft, aiProposal]);

  const [scores, setScores] = useState<SpeakingCriteriaScores>(defaultScores);

  // Overall Feedback & Criteria Feedback state
  const [overallFeedback, setOverallFeedback] = useState<string>(
    publishedAssessment?.overallFeedback || teacherDraft?.overallFeedback || ""
  );

  const [criteriaFeedback, setCriteriaFeedback] =
    useState<SpeakingCriteriaFeedback>(
      publishedAssessment?.criteriaFeedback ||
        teacherDraft?.criteriaFeedback ||
        {}
    );

  // Active prompt / audio clip tab
  const [activePromptIndex, setActivePromptIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // UI action states
  const [isStartingReview, setIsStartingReview] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate Overall Band using official IELTS rounding formula
  const overallBand = useMemo(() => {
    return calculateIeltsSpeakingOverallBand(
      scores.fluencyAndCoherence,
      scores.lexicalResource,
      scores.grammaticalRangeAndAccuracy,
      scores.pronunciation
    );
  }, [scores]);

  const rawAverage = useMemo(() => {
    const sum =
      scores.fluencyAndCoherence +
      scores.lexicalResource +
      scores.grammaticalRangeAndAccuracy +
      scores.pronunciation;
    return (sum / 4).toFixed(2);
  }, [scores]);

  const currentPrompt =
    assignment.prompts[activePromptIndex] || assignment.prompts[0];
  const currentClip = attempt.audioResponses.find(
    (c) => c.promptId === currentPrompt?.promptId
  );
  const clipDurationSec = Math.max(
    1,
    Math.round((currentClip?.durationMs || 30000) / 1000)
  );

  // Audio playback progress synchronization
  useEffect(() => {
    if (!isPlaying) return;
    const stepMs = 200;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + (stepMs / 1000) * playbackSpeed;
        if (next >= clipDurationSec) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, stepMs);
    return () => clearInterval(interval);
  }, [isPlaying, clipDurationSec, playbackSpeed]);

  // Handler: Start Review (First-Committed-Wins Lock)
  const handleStartReview = useCallback(async () => {
    try {
      setIsStartingReview(true);
      setErrorMessage(null);

      if (onStartReview) {
        await onStartReview();
      } else if (!mockMode) {
        const res = await fetch(
          `/api/teacher/submissions/${submission.id}/start-review`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP_${res.status}`);
        }
      }

      setSubmissionStatus("in_review");
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || "Không thể bắt đầu chấm bài.");
    } finally {
      setIsStartingReview(false);
    }
  }, [onStartReview, mockMode, submission.id]);

  // Handler: Atomic Publish
  const handlePublish = useCallback(async () => {
    if (!overallFeedback.trim()) {
      setErrorMessage(
        "Vui lòng nhập nhận xét tổng quan của Giáo viên trước khi duyệt công bố."
      );
      return;
    }

    try {
      setIsPublishing(true);
      setErrorMessage(null);

      const payload: PublishAssessmentInput = {
        fluencyCoherence: scores.fluencyAndCoherence,
        lexicalResource: scores.lexicalResource,
        grammaticalRangeAccuracy: scores.grammaticalRangeAndAccuracy,
        pronunciation: scores.pronunciation,
        overallFeedback: overallFeedback.trim(),
        criteriaFeedback,
        activeReviewDurationMs: activeDurationMs,
      };

      if (onPublish) {
        await onPublish(payload);
      } else if (!mockMode) {
        const res = await fetch(
          `/api/teacher/submissions/${submission.id}/publish`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP_${res.status}`);
        }
      }

      setSubmissionStatus("published");
      setSuccessMessage(
        "Đã xuất bản kết quả đánh giá chính thức thành công cho Học viên!"
      );
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || "Không thể công bố bài chấm.");
    } finally {
      setIsPublishing(false);
    }
  }, [
    overallFeedback,
    scores,
    criteriaFeedback,
    activeDurationMs,
    onPublish,
    mockMode,
    submission.id,
  ]);

  // Handler: Apply all AI scores
  const handleAcceptAllAi = useCallback(() => {
    if (aiProposal && aiProposal.status === "ready") {
      setScores({ ...aiProposal.scores });
    }
  }, [aiProposal]);

  const handleResetCriterionToAi = useCallback(
    (key: keyof SpeakingCriteriaScores) => {
      if (aiProposal && aiProposal.status === "ready") {
        setScores((prev) => ({ ...prev, [key]: aiProposal.scores[key] }));
      }
    },
    [aiProposal]
  );

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, "0")}:${remainingSecs
      .toString()
      .padStart(2, "0")}`;
  };

  const criteriaConfig = [
    {
      key: "fluencyAndCoherence" as const,
      label: "Fluency & Coherence",
      short: "FC",
      vietnamese: "Lưu loát & Mạch lạc",
      colorBadge: "bg-emerald-700 text-white",
      textColor: "text-emerald-700 dark:text-emerald-300",
    },
    {
      key: "lexicalResource" as const,
      label: "Lexical Resource",
      short: "LR",
      vietnamese: "Vốn từ vựng",
      colorBadge: "bg-blue-700 text-white",
      textColor: "text-blue-700 dark:text-blue-300",
    },
    {
      key: "grammaticalRangeAndAccuracy" as const,
      label: "Grammatical Range & Accuracy",
      short: "GRA",
      vietnamese: "Ngữ pháp chính xác",
      colorBadge: "bg-amber-700 text-white",
      textColor: "text-amber-700 dark:text-amber-300",
    },
    {
      key: "pronunciation" as const,
      label: "Pronunciation",
      short: "PR",
      vietnamese: "Phát âm chuẩn",
      colorBadge: "bg-purple-700 text-white",
      textColor: "text-purple-700 dark:text-purple-300",
    },
  ];

  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground flex flex-col antialiased",
        className
      )}
      data-testid={testId}
    >
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              render={<Link href={`/teacher/classrooms`} />}
              aria-label="Quay lại danh sách bài tập"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <Avatar className="h-10 w-10 border border-primary/20">
              {student.avatarUrl && (
                <AvatarImage src={student.avatarUrl} alt={student.name} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {student.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  {student.name}
                </h1>
                <Badge variant="outline" className="text-xs font-normal">
                  Lượt nộp #{attempt.attemptNumber}
                </Badge>
                <Badge
                  className={cn(
                    "text-[11px] font-semibold",
                    isPublished
                      ? "bg-emerald-700 text-white"
                      : isInReview
                        ? "bg-amber-700 text-white"
                        : "bg-blue-700 text-white"
                  )}
                  data-testid="submission-status-badge"
                >
                  {isPublished
                    ? "Đã Công Bố"
                    : isInReview
                      ? "Đang Chấm Bài"
                      : "Đã Nộp Bài"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {assignment.title} • {student.email}
              </p>
            </div>
          </div>

          {/* Active Review Timer & Actions */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            {isInReview && (
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium shadow-2xs",
                  isPaused
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                )}
                data-testid="active-review-timer-badge"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Thời gian chấm: {formattedDuration}</span>
                {isPaused ? (
                  <span className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-sans font-semibold">
                    <PauseCircle className="h-3 w-3" />(
                    {pauseReason === "tab_hidden"
                      ? "Tạm dừng: Ẩn tab"
                      : "Tạm dừng: Bất hoạt"}
                    )
                  </span>
                ) : (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>
            )}

            {isPendingStart && (
              <Button
                onClick={handleStartReview}
                disabled={isStartingReview}
                className="gap-1.5 text-xs h-9 font-semibold"
                data-testid="start-review-button"
              >
                <FileEdit className="h-4 w-4" />
                <span>
                  {isStartingReview ? "Đang khóa bài..." : "Bắt đầu chấm"}
                </span>
              </Button>
            )}

            {isInReview && !isPublished && (
              <Button
                onClick={handlePublish}
                disabled={isPublishing}
                className="gap-1.5 text-xs h-9 font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
                data-testid="publish-assessment-button"
              >
                <Send className="h-4 w-4" />
                <span>
                  {isPublishing ? "Đang xuất bản..." : "Duyệt & Công bố"}
                </span>
              </Button>
            )}

            {isPublished && (
              <Badge className="bg-emerald-700 text-white text-xs px-3 py-1 font-semibold gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Đã công bố cho Học viên</span>
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Notifications Banner */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {/* Main 2-Column Split Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Discrete Prompts & Audio Playback */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="border shadow-xs py-0 gap-0 overflow-hidden">
            <CardHeader className="p-3 sm:p-4 pb-3 border-b bg-muted/10">
              <Tabs
                value={activePromptIndex.toString()}
                onValueChange={(val) => {
                  setActivePromptIndex(Number(val));
                  setCurrentTime(0);
                  setIsPlaying(false);
                }}
                className="w-full"
              >
                <TabsList className="grid grid-cols-3 w-full h-10">
                  {assignment.prompts.map((p, idx) => (
                    <TabsTrigger
                      key={p.promptId}
                      value={idx.toString()}
                      className="text-xs font-semibold"
                      data-testid={`tab-prompt-${idx + 1}`}
                    >
                      Prompt {idx + 1} (Part {p.partNumber})
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Question / Prompt Info */}
              <div className="p-4 rounded-xl bg-muted/40 border text-sm space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5 text-primary font-semibold">
                    <Mic className="h-3.5 w-3.5" />
                    IELTS Speaking Part {currentPrompt?.partNumber}
                  </span>
                  <span>
                    Thời lượng:{" "}
                    {currentClip
                      ? Math.round(currentClip.durationMs / 1000)
                      : 0}
                    s
                  </span>
                </div>
                <p className="font-semibold text-foreground">
                  {currentPrompt?.text}
                </p>
                {currentPrompt?.subPrompts &&
                  currentPrompt.subPrompts.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-muted-foreground pt-1 space-y-0.5">
                      {currentPrompt.subPrompts.map((sub, i) => (
                        <li key={i}>{sub}</li>
                      ))}
                    </ul>
                  )}
              </div>

              {/* Audio Waveform Player */}
              <div className="p-4 rounded-xl border bg-card/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono font-bold text-foreground">
                    {formatTime(currentTime)} / {formatTime(clipDurationSec)}
                  </span>

                  {/* Playback speed */}
                  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md text-[11px] font-mono">
                    {[0.8, 1.0, 1.2, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={cn(
                          "px-2 py-0.5 rounded transition-colors",
                          playbackSpeed === speed
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Waveform Visualizer */}
                <AudioWaveformVisualizer
                  isLive={false}
                  audioDuration={clipDurationSec}
                  currentTime={currentTime}
                  onSeek={(t) => setCurrentTime(t)}
                  barCount={48}
                  height={56}
                  className="cursor-pointer rounded-lg bg-muted/30 border"
                />

                {/* Audio Player Controls */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setIsPlaying((p) => !p)}
                      aria-label={isPlaying ? "Tạm dừng audio" : "Phát audio"}
                      className="h-9 w-9 p-0 rounded-full bg-primary text-primary-foreground"
                      data-testid="audio-play-pause-button"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCurrentTime(0)}
                      aria-label="Phát lại từ đầu"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Phát lại từ đầu"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <span className="text-[11px] text-muted-foreground font-mono">
                    Clip: {currentClip?.storageKey || "Bản thu âm của học viên"}
                  </span>
                </div>
              </div>

              {/* Per-Criterion Comments Form */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileEdit className="h-3.5 w-3.5 text-primary" />
                  Ghi chú đánh giá từng tiêu chí (Tùy chọn)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {criteriaConfig.map((crit) => (
                    <div key={crit.key} className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground block">
                        {crit.short} - {crit.vietnamese}:
                      </label>
                      <Textarea
                        value={criteriaFeedback[crit.key] || ""}
                        onChange={(e) =>
                          setCriteriaFeedback((prev) => ({
                            ...prev,
                            [crit.key]: e.target.value,
                          }))
                        }
                        disabled={isPublished || isPendingStart}
                        placeholder={`Ghi chú cho tiêu chí ${crit.label}...`}
                        className="text-xs min-h-[60px] resize-y"
                        data-testid={`criteria-comment-${crit.key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols): AI Proposal & 4-Criteria Scorecard */}
        <div className="lg:col-span-5 space-y-5">
          {/* AI Proposal Card (if present) OR AI Graceful Failure Banner */}
          {aiProposal && aiProposal.status === "ready" ? (
            <Card
              className="border shadow-xs bg-muted/20 py-0 gap-0 overflow-hidden"
              data-testid="ai-proposal-card"
            >
              <CardHeader className="p-4 border-b bg-card/60 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-xs font-bold text-foreground">
                      Đề Xuất Đánh Giá Tự Động Từ AI
                    </CardTitle>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Mô hình: {aiProposal.modelVersion}
                    </span>
                  </div>
                </div>

                {!isPublished && isInReview && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAcceptAllAi}
                    className="h-7 text-[11px] gap-1 border-primary/30 hover:bg-primary/10"
                    data-testid="apply-ai-scores-button"
                  >
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span>Áp dụng điểm AI</span>
                  </Button>
                )}
              </CardHeader>

              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between bg-card p-3 rounded-lg border">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">
                      Ước lượng Overall Band:
                    </span>
                    <span
                      className="text-2xl font-extrabold text-primary font-mono"
                      data-testid="ai-overall-band"
                    >
                      Band {aiProposal.overallBand.toFixed(1)}
                    </span>
                  </div>

                  <div className="text-right text-[11px] text-muted-foreground font-mono space-y-0.5">
                    <div>
                      FC: {aiProposal.scores.fluencyAndCoherence.toFixed(1)} •
                      LR: {aiProposal.scores.lexicalResource.toFixed(1)}
                    </div>
                    <div>
                      GRA:{" "}
                      {aiProposal.scores.grammaticalRangeAndAccuracy.toFixed(1)}{" "}
                      • PR: {aiProposal.scores.pronunciation.toFixed(1)}
                    </div>
                  </div>
                </div>

                {aiProposal.feedbackSummary && (
                  <p className="text-xs text-foreground bg-card/60 p-3 rounded-lg border leading-relaxed">
                    {aiProposal.feedbackSummary}
                  </p>
                )}

                {Array.isArray(aiProposal.strengths) &&
                  aiProposal.strengths.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        Điểm mạnh:
                      </span>
                      <ul className="text-[11px] list-disc list-inside text-foreground bg-emerald-500/5 p-2 rounded border border-emerald-500/20">
                        {aiProposal.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {Array.isArray(aiProposal.improvements) &&
                  aiProposal.improvements.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Cần cải thiện:
                      </span>
                      <ul className="text-[11px] list-disc list-inside text-foreground bg-amber-500/5 p-2 rounded border border-amber-500/20">
                        {aiProposal.improvements.map((imp, i) => (
                          <li key={i}>{imp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </CardContent>
            </Card>
          ) : (
            /* Graceful AI Failure Banner */
            <div
              className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-1"
              data-testid="ai-failure-graceful-banner"
            >
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Đề xuất tự động từ AI tạm thời không khả dụng.</span>
              </div>
              <p className="text-[11px] leading-relaxed pl-6">
                Thầy/Cô vui lòng chấm điểm và ghi nhận xét trực tiếp cho học
                viên bằng form bên dưới.
              </p>
            </div>
          )}

          {/* 4-Criteria Assessment Scorecard */}
          <Card
            className="border shadow-sm bg-card py-0 gap-0 overflow-hidden"
            data-testid="speaking-scorecard-section"
          >
            <CardHeader className="p-4 sm:p-5 border-b bg-muted/20 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-foreground tracking-tight">
                    Bảng Điểm 4 Tiêu Chí IELTS Speaking
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Thang điểm từ 0.0 đến 9.0 (bước nhảy 0.5)
                  </p>
                </div>
              </div>

              {/* Overall Band Display */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Overall Band Score
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span
                      className="text-3xl sm:text-4xl font-extrabold text-primary tracking-tight font-mono"
                      data-testid="overall-band-score"
                    >
                      {overallBand.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      (Điểm thô: {rawAverage})
                    </span>
                  </div>
                </div>

                {isPublished && (
                  <Badge className="bg-emerald-700 text-white font-semibold text-xs gap-1">
                    <Lock className="h-3 w-3" />
                    <span>Đã khóa chính thức</span>
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {criteriaConfig.map((crit) => {
                const currentScore = scores[crit.key];
                const aiScore = aiProposal?.scores?.[crit.key];
                const hasDiff =
                  aiScore !== undefined && currentScore !== aiScore;
                const delta =
                  aiScore !== undefined ? currentScore - aiScore : 0;

                return (
                  <div
                    key={crit.key}
                    className="p-3.5 rounded-xl border bg-muted/20 space-y-2"
                    data-testid={`criterion-block-${crit.key}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            "px-2 py-0.5 font-bold",
                            crit.colorBadge
                          )}
                        >
                          {crit.short}
                        </Badge>
                        <span className="font-semibold text-xs text-foreground">
                          {crit.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {aiScore !== undefined && (
                          <span className="text-xs text-muted-foreground font-mono">
                            AI: {aiScore.toFixed(1)}
                            {hasDiff && (
                              <span
                                className={cn(
                                  "ml-1 font-semibold",
                                  delta > 0
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-rose-700 dark:text-rose-400"
                                )}
                              >
                                (
                                {delta > 0
                                  ? `+${delta.toFixed(1)}`
                                  : delta.toFixed(1)}
                                )
                              </span>
                            )}
                          </span>
                        )}

                        <span
                          className={cn(
                            "text-base font-bold font-mono",
                            crit.textColor
                          )}
                          data-testid={`score-value-${crit.key}`}
                        >
                          {(currentScore ?? 0).toFixed(1)}
                        </span>

                        {hasDiff && !isPublished && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleResetCriterionToAi(crit.key)}
                            aria-label={`Khôi phục điểm AI cho ${crit.label}`}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {!isPublished && (
                      <div className="pt-1 px-1">
                        <Slider
                          min={0}
                          max={9}
                          step={0.5}
                          aria-label={`Điểm tiêu chí ${crit.label}`}
                          value={[currentScore]}
                          disabled={isPendingStart}
                          onValueChange={(val) => {
                            const newScore = Array.isArray(val) ? val[0] : val;
                            setScores((prev) => ({
                              ...prev,
                              [crit.key]: newScore,
                            }));
                          }}
                          data-testid={`slider-${crit.key}`}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground font-medium mt-1 font-mono px-0.5">
                          <span>0.0</span>
                          <span>5.0</span>
                          <span>6.0</span>
                          <span>7.0</span>
                          <span>8.0</span>
                          <span>9.0</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Mandatory Overall Feedback */}
              <div className="space-y-1.5 pt-2 border-t">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Nhận xét tổng quan của Giáo viên:</span>
                  <span className="text-[10px] font-bold text-destructive uppercase">
                    * Bắt buộc
                  </span>
                </label>
                <Textarea
                  value={overallFeedback}
                  onChange={(e) => setOverallFeedback(e.target.value)}
                  disabled={isPublished || isPendingStart}
                  placeholder="Nhận xét tổng thể về phản xạ, độ trôi chảy, phát âm và từ vựng của học viên..."
                  className="text-xs min-h-[90px] resize-y"
                  data-testid="overall-feedback-textarea"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
