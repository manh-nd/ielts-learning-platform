"use client";

import * as React from "react";
import Link from "next/link";
import {
  AwardIcon,
  CheckCircle2Icon,
  PlayIcon,
  PauseIcon,
  Volume2Icon,
  ArrowLeftIcon,
  CalendarIcon,
  UserCheckIcon,
  MessageSquareQuoteIcon,
  BookOpenIcon,
  RotateCcwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BandScoreBadge } from "@/components/ui/band-score-badge";
import type { LearnerPublishedAssessmentData } from "@/modules/homework/domain/homework-types";

export interface LearnerPublishedAssessmentViewProps {
  data: LearnerPublishedAssessmentData;
  mockMode?: boolean;
  className?: string;
}

const CRITERIA_DEFINITIONS = [
  {
    key: "fluencyCoherence" as const,
    feedbackKey: "fluencyAndCoherence" as const,
    titleEn: "Fluency & Coherence",
    titleVi: "Độ lưu loát & Mạch lạc",
    shortCode: "FC",
    description:
      "Khả năng nói liền mạch, tốc độ tự nhiên và kết nối ý mạch lạc.",
  },
  {
    key: "lexicalResource" as const,
    feedbackKey: "lexicalResource" as const,
    titleEn: "Lexical Resource",
    titleVi: "Vốn từ vựng",
    shortCode: "LR",
    description:
      "Sử dụng từ vựng phong phú, chính xác ngữ cảnh và collocations tự nhiên.",
  },
  {
    key: "grammaticalRangeAccuracy" as const,
    feedbackKey: "grammaticalRangeAndAccuracy" as const,
    titleEn: "Grammatical Range & Accuracy",
    titleVi: "Ngữ pháp & Độ chính xác",
    shortCode: "GRA",
    description:
      "Độ đa dạng của cấu trúc câu ghép phức và mức độ kiểm soát lỗi ngữ pháp.",
  },
  {
    key: "pronunciation" as const,
    feedbackKey: "pronunciation" as const,
    titleEn: "Pronunciation",
    titleVi: "Phát âm & Ngữ điệu",
    shortCode: "PR",
    description: "Ngữ điệu, trọng âm từ, nối âm và tính dễ hiểu của phát âm.",
  },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function LearnerPublishedAssessmentView({
  data,
  mockMode: _mockMode = false,
  className,
}: LearnerPublishedAssessmentViewProps) {
  const { assignment, classroom, attempt, publishedAssessment, teacher } = data;
  const prompts = assignment.prompts;

  // Active prompt tab for audio replay
  const [activePromptIndex, setActivePromptIndex] = React.useState(0);
  const activePrompt = prompts[activePromptIndex] || prompts[0];

  // Active clip corresponding to active prompt
  const activeClip = attempt.audioResponses.find(
    (c) => c.promptId === activePrompt?.promptId
  );
  const clipDurationSec = Math.max(
    1,
    Math.round((activeClip?.durationMs || 30000) / 1000)
  );

  // Audio Playback state
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1.0);

  const handleSelectPromptTab = React.useCallback((index: number) => {
    setActivePromptIndex(index);
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Audio playback ticker
  React.useEffect(() => {
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

  const togglePlay = React.useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSeek = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTime = parseFloat(e.target.value);
      setCurrentTime(newTime);
    },
    []
  );

  const cyclePlaybackSpeed = React.useCallback(() => {
    setPlaybackSpeed((prev) => {
      if (prev === 1.0) return 1.25;
      if (prev === 1.25) return 1.5;
      if (prev === 1.5) return 0.75;
      return 1.0;
    });
  }, []);

  const formattedPublishedDate = publishedAssessment.publishedAt
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(publishedAssessment.publishedAt))
    : "Đã công bố";

  return (
    <main
      data-testid="learner-published-assessment-view"
      className={cn("max-w-5xl mx-auto space-y-6 px-4 py-6 sm:px-6", className)}
    >
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={`/learner/assignments/${assignment.id}`} />}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8 px-2"
              aria-label="Quay lại chi tiết bài tập"
            >
              <ArrowLeftIcon className="size-3.5" />
              <span>Quay lại bài tập</span>
            </Button>
            <span className="text-muted-foreground/40">•</span>
            <Badge
              variant="outline"
              className="bg-primary/5 text-primary border-primary/20 text-xs font-medium"
            >
              {classroom.name}
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {assignment.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            data-testid="published-badge"
            className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 gap-1.5 text-xs font-semibold px-2.5 py-1"
          >
            <CheckCircle2Icon className="size-3.5" />
            <span>Kết quả chính thức</span>
          </Badge>
          <Badge
            variant="outline"
            className="bg-muted/50 text-muted-foreground text-xs gap-1 px-2.5 py-1"
          >
            <CalendarIcon className="size-3" />
            <span>{formattedPublishedDate}</span>
          </Badge>
        </div>
      </div>

      {/* Hero Card: IELTS Overall Band */}
      <Card
        data-testid="overall-band-card"
        className="border-primary/30 bg-gradient-to-br from-card via-card to-primary/[0.04] shadow-sm overflow-hidden"
      >
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-2">
              <div className="flex items-center gap-2">
                <AwardIcon className="size-5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Official IELTS Speaking Score
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Điểm Tổng Thể & Đánh Giá Giảng Viên
              </h2>
              <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                Điểm tổng thể được tính toán theo quy tắc làm tròn chính thức
                của kỳ thi IELTS từ 4 tiêu chí thành phần. Kết quả này đã được
                Giáo viên đối soát và phê duyệt chính thức.
              </p>
              <div className="flex items-center gap-2 pt-1 text-xs text-foreground/80">
                <UserCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Giáo viên chấm:{" "}
                  <strong className="font-semibold text-foreground">
                    {teacher.name}
                  </strong>
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-muted-foreground">
                  Lượt nộp #{attempt.attemptNumber}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-card border border-border/80 shadow-xs min-w-[200px]">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Overall Band
              </span>
              <BandScoreBadge
                data-testid="overall-band-badge"
                score={publishedAssessment.overallBand}
                size="xl"
                showDescriptor={true}
                className="text-lg px-4 py-1.5 shadow-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 Criteria Grid */}
      <section aria-labelledby="criteria-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="criteria-heading"
            className="text-sm font-bold text-foreground flex items-center gap-2"
          >
            <BookOpenIcon className="size-4 text-primary" />
            <span>Chi Tiết 4 Tiêu Chí Chấm Thi IELTS Speaking</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CRITERIA_DEFINITIONS.map((criterion) => {
            const score = publishedAssessment[criterion.key];
            const comment =
              publishedAssessment.criteriaFeedback?.[criterion.feedbackKey];

            return (
              <Card
                key={criterion.key}
                data-testid={`criterion-card-${criterion.shortCode.toLowerCase()}`}
                className="border-border/80 shadow-xs flex flex-col justify-between"
              >
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-extrabold px-1.5 py-0 bg-primary/10 text-primary border-primary/20"
                        >
                          {criterion.shortCode}
                        </Badge>
                        <CardTitle className="text-sm font-bold text-foreground">
                          {criterion.titleEn}
                        </CardTitle>
                      </div>
                      <p className="text-xs text-foreground/80 font-medium">
                        {criterion.titleVi}
                      </p>
                    </div>

                    <BandScoreBadge
                      score={score}
                      size="md"
                      data-testid={`score-${criterion.shortCode.toLowerCase()}`}
                    />
                  </div>
                </CardHeader>

                <CardContent className="px-4 pb-4 pt-0 text-xs space-y-2">
                  <p className="text-xs text-foreground/80 leading-relaxed italic border-b border-border/40 pb-2">
                    {criterion.description}
                  </p>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <MessageSquareQuoteIcon className="size-3 text-primary" />
                      Nhận xét từ Giáo viên:
                    </span>
                    <p
                      data-testid={`comment-${criterion.shortCode.toLowerCase()}`}
                      className="text-xs text-foreground bg-muted/40 p-2.5 rounded-md leading-relaxed border border-border/60"
                    >
                      {comment && comment.trim()
                        ? comment
                        : "Giáo viên không để lại nhận xét riêng cho tiêu chí này. Vui lòng xem nhận xét tổng quan."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Official Teacher Overall Feedback */}
      <Card
        data-testid="teacher-feedback-card"
        className="border-border/80 bg-card shadow-xs"
      >
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6 border-b border-border/50">
          <div className="flex items-center gap-2">
            <MessageSquareQuoteIcon className="size-4 text-primary" />
            <CardTitle className="text-sm font-bold text-foreground">
              Nhận Xét Tổng Quan Từ Giáo Viên ({teacher.name})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 text-xs sm:text-sm text-foreground leading-relaxed">
          <p
            data-testid="teacher-overall-feedback-text"
            className="whitespace-pre-line bg-primary/[0.02] p-4 rounded-lg border border-primary/10 font-medium"
          >
            {publishedAssessment.overallFeedback}
          </p>
        </CardContent>
      </Card>

      {/* Audio Responses Replay Section */}
      <Card
        data-testid="audio-replay-card"
        className="border-border/80 shadow-xs"
      >
        <CardHeader className="pb-3 pt-4 px-4 sm:px-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Volume2Icon className="size-4 text-primary" />
              <CardTitle className="text-sm font-bold text-foreground">
                Nghe Lại Bản Thu Âm Bài Làm Đã Nộp
              </CardTitle>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {prompts.length} câu hỏi trả lời
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Prompt Tabs */}
          <div
            role="tablist"
            aria-label="Danh sách câu hỏi bài tập Speaking"
            className="flex flex-wrap gap-2 border-b border-border/50 pb-3"
          >
            {prompts.map((prompt, idx) => {
              const isSelected = activePromptIndex === idx;
              return (
                <button
                  key={prompt.promptId}
                  role="tab"
                  id={`tab-prompt-${idx}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-prompt-${idx}`}
                  data-testid={`prompt-tab-${prompt.promptId}`}
                  onClick={() => handleSelectPromptTab(idx)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted border-transparent hover:text-foreground"
                  )}
                >
                  Part {prompt.partNumber} • Câu hỏi {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Active Prompt Details */}
          {activePrompt && (
            <div
              role="tabpanel"
              id={`panel-prompt-${activePromptIndex}`}
              aria-labelledby={`tab-prompt-${activePromptIndex}`}
              className="space-y-4 pt-1"
            >
              <div className="p-4 rounded-lg bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-bold uppercase tracking-wider"
                  >
                    IELTS Speaking Part {activePrompt.partNumber}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground leading-relaxed">
                  {activePrompt.text}
                </p>

                {activePrompt.subPrompts &&
                  activePrompt.subPrompts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        You should say:
                      </span>
                      <ul className="list-disc list-inside text-xs text-foreground/80 space-y-0.5 pl-1">
                        {activePrompt.subPrompts.map((sub, sIdx) => (
                          <li key={sIdx}>{sub}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              {/* Audio Player Controls */}
              <div
                data-testid="audio-player-controls"
                className="p-4 rounded-lg bg-card border border-border/80 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Volume2Icon className="size-3.5 text-primary" />
                    Bản ghi âm câu trả lời
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground font-mono">
                    {formatTime(currentTime)} / {formatTime(clipDurationSec)}
                  </span>
                </div>

                {/* Progress Scrubber */}
                <div className="space-y-1">
                  <label htmlFor="audio-time-slider" className="sr-only">
                    Thanh điều hướng âm thanh
                  </label>
                  <input
                    id="audio-time-slider"
                    type="range"
                    min={0}
                    max={clipDurationSec}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    aria-label={`Tiến trình phát âm thanh câu hỏi ${activePromptIndex + 1}`}
                  />
                </div>

                {/* Player Action Buttons */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={togglePlay}
                      data-testid="toggle-play-button"
                      aria-label={
                        isPlaying
                          ? `Tạm dừng phát âm thanh câu hỏi ${activePromptIndex + 1}`
                          : `Phát âm thanh câu hỏi ${activePromptIndex + 1}`
                      }
                      className="gap-1.5 text-xs font-semibold h-8 px-3"
                    >
                      {isPlaying ? (
                        <>
                          <PauseIcon className="size-3.5" />
                          <span>Tạm dừng</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon className="size-3.5" />
                          <span>Phát lại</span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentTime(0)}
                      aria-label="Phát lại từ đầu"
                      className="gap-1 text-xs h-8 px-2.5"
                    >
                      <RotateCcwIcon className="size-3" />
                      <span>Về đầu</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cyclePlaybackSpeed}
                      className="text-xs h-8 px-2.5 font-mono text-muted-foreground hover:text-foreground"
                      aria-label={`Tốc độ phát: ${playbackSpeed}x. Bấm để thay đổi tốc độ.`}
                    >
                      {playbackSpeed}x
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
