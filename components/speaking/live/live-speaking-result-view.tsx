"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  BookOpen,
  Volume2,
  FileCheck,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SpeakingCriteriaScorecard,
  SpeakingCriteriaScores,
} from "@/components/speaking/review/speaking-criteria-scorecard";
import { AudioWaveformVisualizer } from "@/components/speaking/audio-waveform-visualizer";
import {
  IeltsSpeakingEvaluationResult,
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";
import { RecordedAudioData, TranscriptItem } from "./types";
import { cn } from "@/lib/utils";

export interface LiveSpeakingResultViewProps {
  evaluationResult?: IeltsSpeakingEvaluationResult | null;
  practiceFeedback?: PracticeFeedback | null;
  traceMetadata?: SpeakingEvaluationTrace | null;
  isPracticeMode?: boolean;
  isLoading: boolean;
  error?: string | null;
  recordedAudio: RecordedAudioData | null;
  transcripts: TranscriptItem[];
  onRetryEvaluation?: () => void;
  onRestartTest: () => void;
  onBackToDashboard: () => void;
  className?: string;
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function LiveSpeakingResultView({
  evaluationResult,
  practiceFeedback,
  traceMetadata,
  isPracticeMode: _isPracticeMode,
  isLoading,
  error,
  recordedAudio,
  transcripts,
  onRetryEvaluation,
  onRestartTest,
  onBackToDashboard,
  className,
}: LiveSpeakingResultViewProps) {
  const [copiedMonologue, setCopiedMonologue] = useState(false);
  const [activeClip, setActiveClip] = useState<{
    startMs: number;
    endMs: number;
  } | null>(null);
  const [isPlayingClip, setIsPlayingClip] = useState(false);

  // Full Audio Player State (Tab 3)
  const [fullAudioCurrentTime, setFullAudioCurrentTime] = useState<number>(0);
  const [isFullAudioPlaying, setIsFullAudioPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const clipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize HTML5 audio element events with state
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setFullAudioCurrentTime(audio.currentTime);
    };
    const handlePlay = () => {
      setIsFullAudioPlaying(true);
    };
    const handlePause = () => {
      setIsFullAudioPlaying(false);
    };
    const handleEnded = () => {
      setIsFullAudioPlaying(false);
      setFullAudioCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [recordedAudio?.url]);

  // Full Audio Handlers
  const handleFullAudioTogglePlay = useCallback(() => {
    const audio = audioElementRef.current;
    if (!audio) return;

    if (isFullAudioPlaying) {
      audio.pause();
    } else {
      if (clipTimeoutRef.current) {
        clearTimeout(clipTimeoutRef.current);
        clipTimeoutRef.current = null;
        setIsPlayingClip(false);
        setActiveClip(null);
      }
      audio.play().catch(() => {});
    }
  }, [isFullAudioPlaying]);

  const handleFullAudioSeek = useCallback((targetTimeSeconds: number) => {
    const audio = audioElementRef.current;
    if (audio) {
      audio.currentTime = targetTimeSeconds;
      setFullAudioCurrentTime(targetTimeSeconds);
    }
  }, []);

  const handleSetPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    const audio = audioElementRef.current;
    if (audio) {
      audio.playbackRate = speed;
    }
  }, []);

  // Play clip helper
  const handlePlayClip = useCallback((startMs: number, endMs: number) => {
    const audio = audioElementRef.current;
    if (!audio) return;

    if (clipTimeoutRef.current) {
      clearTimeout(clipTimeoutRef.current);
      clipTimeoutRef.current = null;
    }

    const durationMs = Math.max(800, endMs - startMs);
    audio.currentTime = Math.max(0, startMs / 1000);
    audio.play().catch(() => {});
    setActiveClip({ startMs, endMs });
    setIsPlayingClip(true);

    clipTimeoutRef.current = setTimeout(() => {
      audio.pause();
      setIsPlayingClip(false);
      setActiveClip(null);
    }, durationMs);
  }, []);

  const handleStopClip = useCallback(() => {
    const audio = audioElementRef.current;
    if (audio) {
      audio.pause();
    }
    if (clipTimeoutRef.current) {
      clearTimeout(clipTimeoutRef.current);
      clipTimeoutRef.current = null;
    }
    setIsPlayingClip(false);
    setActiveClip(null);
  }, []);

  useEffect(() => {
    return () => {
      if (clipTimeoutRef.current) {
        clearTimeout(clipTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <Card
        className={cn(
          "w-full max-w-4xl mx-auto p-12 text-center shadow-md",
          className
        )}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-bounce" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-foreground">
              Đang phân tích & Chấm điểm...
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Hệ thống đang chuyển giọng nói thành văn bản và phân tích chi tiết
              4 tiêu chí chấm điểm IELTS (FC, LR, GRA, PR).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/30 px-3 py-1.5 rounded-md border">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Mô hình: Gemini 3.7 Flash</span>
          </div>
        </div>
      </Card>
    );
  }

  if (error || (!evaluationResult && !practiceFeedback)) {
    return (
      <Card
        className={cn(
          "w-full max-w-4xl mx-auto p-8 shadow-md border-rose-500/30",
          className
        )}
      >
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">
              Không thể tải kết quả chấm điểm
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md">
              {error ||
                "Đã xảy ra sự cố khi xử lý chấm điểm tự động. Vui lòng thử lại."}
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            {onRetryEvaluation && (
              <Button
                size="sm"
                onClick={onRetryEvaluation}
                className="gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử chấm điểm lại</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onRestartTest}
              className="cursor-pointer"
            >
              <span>Thi lại bài mới</span>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Render PracticeFeedback View (Part 1 Practice MVP)
  if (practiceFeedback) {
    const {
      estimatedPerformance,
      strengths,
      priorities,
      summary,
      evidenceSufficiency,
    } = practiceFeedback;

    return (
      <div className={cn("w-full max-w-4xl mx-auto space-y-6", className)}>
        {/* Hidden Audio Player for Interactive Clip Playback */}
        {recordedAudio && (
          <audio
            ref={audioElementRef}
            src={recordedAudio.url}
            preload="auto"
            className="hidden"
          />
        )}

        {/* Top Action Bar */}
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={onBackToDashboard}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Bảng điều khiển</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onRestartTest}
              className="gap-1.5 text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Luyện đề khác</span>
            </Button>
          </div>
        </div>

        {/* Practice Feedback Header Banner */}
        <div className="rounded-xl border bg-gradient-to-r from-indigo-500/10 via-background to-muted/20 p-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 text-white text-xs">
                Luyện tập Speaking Part 1
              </Badge>
              <Badge variant="outline" className="text-xs">
                Formative Practice Feedback
              </Badge>
            </div>
            {traceMetadata && (
              <span className="text-[11px] font-mono text-muted-foreground">
                Mô hình: {traceMetadata.modelUsed} ({traceMetadata.durationMs}
                ms)
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            💡 <strong>Lưu ý:</strong> Đây là nhận xét phân tích cho phần Luyện
            tập Part 1 nhằm hỗ trợ cải thiện kỹ năng, không phải chứng chỉ hay
            điểm số thi IELTS chính thức.
          </p>
        </div>

        {/* Estimated Criteria Performance if sufficient evidence */}
        {evidenceSufficiency === "sufficient_for_practice_feedback" &&
          estimatedPerformance && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-3 text-center border shadow-xs">
                <div className="text-[11px] text-muted-foreground font-semibold">
                  Fluency & Coherence
                </div>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
                  {estimatedPerformance.fluencyAndCoherence?.toFixed(1) ||
                    "N/A"}
                </div>
              </Card>
              <Card className="p-3 text-center border shadow-xs">
                <div className="text-[11px] text-muted-foreground font-semibold">
                  Lexical Resource
                </div>
                <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1">
                  {estimatedPerformance.lexicalResource?.toFixed(1) || "N/A"}
                </div>
              </Card>
              <Card className="p-3 text-center border shadow-xs">
                <div className="text-[11px] text-muted-foreground font-semibold">
                  Grammar Range & Acc.
                </div>
                <div className="text-2xl font-black text-purple-700 dark:text-purple-400 mt-1">
                  {estimatedPerformance.grammaticalRangeAndAccuracy?.toFixed(
                    1
                  ) || "N/A"}
                </div>
              </Card>
              <Card className="p-3 text-center border shadow-xs">
                <div className="text-[11px] text-muted-foreground font-semibold">
                  Pronunciation
                </div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                  {estimatedPerformance.pronunciation?.toFixed(1) || "N/A"}
                </div>
              </Card>
            </div>
          )}

        {evidenceSufficiency === "limited" && (
          <Card className="p-4 border-amber-500/30 bg-amber-500/5 text-xs text-amber-900 dark:text-amber-200">
            ⚠ <strong>Bằng chứng nói chưa đủ:</strong> Câu trả lời quá ngắn để
            ước lượng chính xác các tiêu chí. Lần tới bạn hãy trả lời trọn vẹn
            từ 2-3 câu nhé!
          </Card>
        )}

        {/* Summary Card */}
        <Card className="shadow-xs border overflow-hidden">
          <CardHeader className="p-4 border-b bg-muted/20 pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>Nhận xét Hướng dẫn Sư phạm (Coaching Summary)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-xs text-foreground/90 leading-relaxed">
            {summary}
          </CardContent>
        </Card>

        {/* Detailed Points: Strengths & Priorities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Key Strengths */}
          <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Điểm mạnh ghi nhận ({strengths.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {strengths.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Chưa ghi nhận điểm mạnh rõ nét do câu trả lời quá ngắn.
                </p>
              ) : (
                strengths.map((pt, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-background/80 border space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono font-bold"
                      >
                        {pt.criterion}
                      </Badge>
                    </div>
                    <p className="font-medium text-foreground">
                      {pt.observation}
                    </p>
                    {pt.evidence?.transcriptQuote && (
                      <p className="italic text-[11px] text-muted-foreground border-l-2 border-emerald-500/40 pl-2">
                        &ldquo;{pt.evidence.transcriptQuote}&rdquo;
                      </p>
                    )}
                    {pt.suggestion && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        💡 {pt.suggestion}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Priority Improvements */}
          <Card className="border-rose-500/30 bg-rose-500/5 shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Ưu tiên cải thiện ({priorities.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {priorities.map((pt, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-background/80 border space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono font-bold text-rose-600 border-rose-300"
                    >
                      {pt.criterion}
                    </Badge>
                  </div>
                  <p className="font-medium text-foreground">
                    {pt.observation}
                  </p>
                  {pt.evidence?.transcriptQuote && (
                    <p className="italic text-[11px] text-muted-foreground border-l-2 border-rose-500/40 pl-2">
                      &ldquo;{pt.evidence.transcriptQuote}&rdquo;
                    </p>
                  )}
                  {pt.suggestion && (
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">
                      🎯 {pt.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Audio Recording & Transcript Player */}
        {recordedAudio && (
          <Card className="shadow-xs border overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-primary" />
                <span>Bản ghi âm & Bản chép lời</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="p-3 rounded-xl border bg-muted/30 space-y-3">
                <AudioWaveformVisualizer
                  isLive={false}
                  audioDuration={recordedAudio.durationSeconds}
                  currentTime={fullAudioCurrentTime}
                  onSeek={handleFullAudioSeek}
                  barCount={48}
                  height={60}
                  className="cursor-pointer rounded-lg bg-background/80 border"
                />
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={handleFullAudioTogglePlay}
                    >
                      {isFullAudioPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          Tạm dừng
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Phát ghi âm
                        </>
                      )}
                    </Button>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      {formatTimestamp(Math.round(fullAudioCurrentTime * 1000))}{" "}
                      /{" "}
                      {formatTimestamp(
                        Math.round(recordedAudio.durationSeconds * 1000)
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 1.25, 1.5].map((speed) => (
                      <Button
                        key={speed}
                        type="button"
                        variant={playbackSpeed === speed ? "default" : "ghost"}
                        size="xs"
                        className="h-6 px-1.5 text-[11px]"
                        onClick={() => handleSetPlaybackSpeed(speed)}
                      >
                        {speed}x
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 pt-2">
                <span className="font-semibold text-xs text-muted-foreground">
                  Bản chép lời hội thoại:
                </span>
                <div className="p-3 rounded-lg bg-muted/30 border space-y-2 max-h-60 overflow-y-auto text-xs">
                  {transcripts.map((t) => (
                    <div key={t.id} className="flex gap-2">
                      <span
                        className={cn(
                          "font-semibold shrink-0 text-[11px]",
                          t.sender === "examiner"
                            ? "text-indigo-600"
                            : "text-emerald-600"
                        )}
                      >
                        {t.sender === "examiner" ? "Giám khảo:" : "Bạn:"}
                      </span>
                      <span className="text-foreground/90">{t.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (!evaluationResult) {
    return null;
  }

  const { overallScorecard, partEvaluations, evidence, trace } =
    evaluationResult;
  const { criteriaScores, generalFeedback } = overallScorecard;
  const {
    executiveSummary,
    keyStrengths,
    priorityImprovements,
    actionPlan,
    practiceMonologue,
  } = generalFeedback;

  const handleCopyMonologue = () => {
    if (!practiceMonologue) return;
    navigator.clipboard.writeText(practiceMonologue);
    setCopiedMonologue(true);
    setTimeout(() => setCopiedMonologue(false), 2000);
  };

  const currentScores: SpeakingCriteriaScores = {
    fluencyAndCoherence: criteriaScores.fluencyAndCoherence,
    lexicalResource: criteriaScores.lexicalResource,
    grammaticalRangeAndAccuracy: criteriaScores.grammaticalRangeAndAccuracy,
    pronunciation: criteriaScores.pronunciation,
  };

  return (
    <div className={cn("w-full max-w-4xl mx-auto space-y-6", className)}>
      {/* Hidden Audio Player for Interactive Clip Playback */}
      {recordedAudio && (
        <audio
          ref={audioElementRef}
          src={recordedAudio.url}
          preload="auto"
          className="hidden"
        />
      )}

      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="ghost"
          onClick={onBackToDashboard}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Bảng điều khiển</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRestartTest}
            className="gap-1.5 text-xs font-medium cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Luyện đề thi khác</span>
          </Button>
        </div>
      </div>

      {/* Main Scorecard Component */}
      <SpeakingCriteriaScorecard
        scores={currentScores}
        editable={false}
        traceMetadata={{
          modelUsed: trace.modelUsed,
          isFallback: trace.isFallback,
          fallbackReason: trace.fallbackReason,
          durationMs: trace.durationMs,
          tokensUsed: trace.tokensUsed,
        }}
      />

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-md h-9 text-xs">
          <TabsTrigger value="overview">Tổng quan Đánh giá</TabsTrigger>
          <TabsTrigger value="parts">
            Chi tiết từng Part ({partEvaluations.length})
          </TabsTrigger>
          <TabsTrigger value="audio">Ghi âm & Bản chép lời</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview Feedback */}
        <TabsContent value="overview" className="space-y-4 pt-3">
          {/* Executive Summary */}
          <Card className="shadow-xs border py-0 gap-0 overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-primary" />
                <span>Nhận xét Tổng quan từ Giám khảo AI</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs text-foreground/90 leading-relaxed">
              {executiveSummary}
            </CardContent>
          </Card>

          {/* Strengths & Weaknesses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs py-0 gap-0 overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Điểm mạnh nổi bật (Key Strengths)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ul className="space-y-1.5 list-disc pl-4 text-xs text-foreground/90">
                  {keyStrengths.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Priority Improvements */}
            <Card className="border-rose-500/30 bg-rose-500/5 shadow-xs py-0 gap-0 overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Điểm cần cải thiện (Priority Improvements)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ul className="space-y-1.5 list-disc pl-4 text-xs text-foreground/90">
                  {priorityImprovements.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Fluency Evidence (Long Pauses / Fillers) */}
          {evidence?.fluency &&
            evidence.fluency.longPauses &&
            evidence.fluency.longPauses.length > 0 && (
              <Card className="shadow-xs border border-amber-500/30 bg-amber-500/5 py-0 gap-0 overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>
                      Dấu hiệu Ngập ngừng kéo dài (Fluency Hesitations & Pauses)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  {evidence.fluency.longPauses.map((pause, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-md bg-background/80 border text-xs"
                    >
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {formatTimestamp(pause.startMs)} ➔{" "}
                            {formatTimestamp(pause.endMs)} (
                            {(pause.durationMs / 1000).toFixed(1)}s)
                          </Badge>
                          <span>{pause.transcriptSnippet}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {pause.reason}
                        </p>
                      </div>

                      {recordedAudio && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (
                              isPlayingClip &&
                              activeClip?.startMs === pause.startMs
                            ) {
                              handleStopClip();
                            } else {
                              handlePlayClip(pause.startMs, pause.endMs);
                            }
                          }}
                          className="h-7 px-2 text-xs gap-1 cursor-pointer"
                        >
                          {isPlayingClip &&
                          activeClip?.startMs === pause.startMs ? (
                            <>
                              <Pause className="w-3 h-3 text-rose-500" />
                              <span>Dừng</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 text-primary" />
                              <span>Nghe</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

          {/* Band 8.0+ Model Monologue */}
          {practiceMonologue && (
            <Card className="shadow-xs border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-background to-amber-500/5 py-0 gap-0 overflow-hidden">
              <CardHeader className="p-4 border-b bg-indigo-500/10 pb-3 flex flex-row items-center justify-between space-y-0">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>
                        Bài Nói Mẫu Band 8.0+ (Tối ưu từ ý tưởng của bạn)
                      </span>
                    </CardTitle>
                    <Badge className="bg-indigo-600 text-white text-[10px] font-mono py-0">
                      Band 8.0+ Model
                    </Badge>
                  </div>
                  <CardDescription className="text-[11px] text-muted-foreground">
                    Tổng hợp các ý bạn đã trình bày thành bài độc thoại chuẩn
                    C1/C2 dùng để luyện đọc Shadowing
                  </CardDescription>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyMonologue}
                  className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer bg-background"
                >
                  {copiedMonologue ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-300" />
                      <span className="text-emerald-800 dark:text-emerald-300 font-semibold">
                        Đã sao chép
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Sao chép bài mẫu</span>
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <blockquote className="border-l-2 border-indigo-500/60 pl-3.5 text-xs text-foreground/90 italic leading-relaxed font-serif">
                  &ldquo;{practiceMonologue}&rdquo;
                </blockquote>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-lg border">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>
                    💡 <strong>Mẹo luyện tập:</strong> Đọc to bài mẫu này từ 3–5
                    lần theo ngữ điệu tự nhiên (kỹ thuật Shadowing) để khắc sâu
                    các cấu trúc câu và từ vựng nâng cấp vào phản xạ nói.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actionable Practice Plan */}
          {actionPlan && actionPlan.length > 0 && (
            <Card className="shadow-xs border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent py-0 gap-0 overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Lộ trình Luyện tập Khuyến nghị (Action Plan)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ul className="space-y-2 text-xs text-foreground/90">
                  {actionPlan.map((plan: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <span>{plan}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Part-by-Part Evaluations */}
        <TabsContent value="parts" className="space-y-4 pt-3">
          {partEvaluations.map((partEval, index) => (
            <Card
              key={index}
              className="shadow-xs border py-0 gap-0 overflow-hidden"
            >
              <CardHeader className="p-4 border-b bg-muted/20 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="font-mono text-xs font-bold"
                    >
                      Part {partEval.partNumber}
                    </Badge>
                    <CardTitle className="text-sm font-semibold text-foreground">
                      {partEval.promptQuestion}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3.5 text-xs">
                {/* Transcript */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-muted-foreground block">
                      Nội dung câu trả lời (Transcript):
                    </span>
                    {partEval.verifiedTranscript && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      >
                        ✓ Audio Verified
                      </Badge>
                    )}
                  </div>
                  <p className="p-3 rounded-lg bg-muted/30 border font-serif text-foreground/90 italic leading-relaxed">
                    &ldquo;
                    {partEval.verifiedTranscript ||
                      partEval.candidateTranscript}
                    &rdquo;
                  </p>
                </div>

                {/* Pronunciation Notes with Interactive Audio Clips */}
                {partEval.pronunciationNotes &&
                  partEval.pronunciationNotes.length > 0 && (
                    <div>
                      <span className="font-semibold text-purple-800 dark:text-purple-300 block mb-1.5">
                        Lưu ý Phát âm (Phonetic & Stress Notes):
                      </span>
                      <div className="space-y-2">
                        {partEval.pronunciationNotes.map((item, i: number) => {
                          const hasTimestamp =
                            item.startMs !== undefined &&
                            item.endMs !== undefined;
                          const isThisClipPlaying =
                            isPlayingClip &&
                            activeClip?.startMs === item.startMs;

                          return (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg border bg-purple-500/5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-purple-700 dark:text-purple-300 text-sm">
                                    {item.word}
                                  </span>
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {item.expectedIpa}
                                  </span>
                                  {hasTimestamp && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-mono"
                                    >
                                      ⏱ {formatTimestamp(item.startMs!)}
                                    </Badge>
                                  )}
                                </div>

                                {hasTimestamp && recordedAudio && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (isThisClipPlaying) {
                                        handleStopClip();
                                      } else {
                                        handlePlayClip(
                                          item.startMs!,
                                          item.endMs!
                                        );
                                      }
                                    }}
                                    className="h-6 px-2 text-[11px] gap-1 cursor-pointer bg-background"
                                  >
                                    {isThisClipPlaying ? (
                                      <>
                                        <Pause className="w-3 h-3 text-rose-500" />
                                        <span>Dừng</span>
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-3 h-3 text-purple-600" />
                                        <span>▶ Nghe lại giọng bạn</span>
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                              <div className="text-rose-700 dark:text-rose-400">
                                ⚠ {item.detectedIssue}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                💡 {item.recommendation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Grammar Corrections with Clips */}
                {partEval.grammarCorrections &&
                  partEval.grammarCorrections.length > 0 && (
                    <div>
                      <span className="font-semibold text-amber-800 dark:text-amber-300 block mb-1.5">
                        Sửa lỗi Ngữ pháp (Grammar Fixes):
                      </span>
                      <div className="space-y-2">
                        {partEval.grammarCorrections.map((item, i: number) => {
                          const hasTimestamp =
                            item.startMs !== undefined &&
                            item.endMs !== undefined;
                          const isThisClipPlaying =
                            isPlayingClip &&
                            activeClip?.startMs === item.startMs;

                          return (
                            <div
                              key={i}
                              className="p-2.5 rounded-lg border bg-amber-500/5 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-rose-800 dark:text-rose-400 font-medium">
                                  ❌ {item.originalPhrase}
                                </div>
                                {hasTimestamp && recordedAudio && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (isThisClipPlaying) {
                                        handleStopClip();
                                      } else {
                                        handlePlayClip(
                                          item.startMs!,
                                          item.endMs!
                                        );
                                      }
                                    }}
                                    className="h-6 px-2 text-[11px] gap-1 cursor-pointer bg-background"
                                  >
                                    {isThisClipPlaying ? (
                                      <Pause className="w-3 h-3 text-rose-500" />
                                    ) : (
                                      <Play className="w-3 h-3 text-amber-600" />
                                    )}
                                    <span>Nghe</span>
                                  </Button>
                                )}
                              </div>
                              <div className="text-emerald-800 dark:text-emerald-400 font-medium">
                                ✓ {item.correctedPhrase}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {item.explanation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Lexical Upgrades */}
                {partEval.lexicalUpgrades &&
                  partEval.lexicalUpgrades.length > 0 && (
                    <div>
                      <span className="font-semibold text-blue-800 dark:text-blue-300 block mb-1.5 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>
                          Gợi ý nâng cấp Từ vựng (Band 7.5+ Upgrades):
                        </span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {partEval.lexicalUpgrades.map((item, i: number) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg border bg-blue-500/5 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="line-through text-muted-foreground">
                                {item.originalExpression}
                              </span>
                              <span className="font-bold text-blue-700 dark:text-blue-400">
                                ➔ {item.betterAlternative}
                              </span>
                            </div>
                            {item.contextExample && (
                              <p className="text-[11px] text-muted-foreground">
                                {item.contextExample}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Tab 3: Recorded Audio & Full Transcript */}
        <TabsContent value="audio" className="space-y-4 pt-3">
          {recordedAudio && (
            <Card
              className="shadow-xs border py-0 gap-0 overflow-hidden"
              data-testid="recorded-audio-card"
            >
              <CardHeader className="p-4 border-b bg-muted/20 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-primary" />
                      <span>
                        File Ghi âm Toàn Bộ Buổi Thi (
                        {recordedAudio.durationSeconds}s)
                      </span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Sóng âm tương tác & nghe lại âm thanh giọng nói nguyên bản
                      của bạn
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {formatTimestamp(Math.round(fullAudioCurrentTime * 1000))} /{" "}
                    {formatTimestamp(
                      Math.round(recordedAudio.durationSeconds * 1000)
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {/* Waveform Player */}
                <div className="p-3 rounded-xl border bg-muted/30 space-y-3">
                  <AudioWaveformVisualizer
                    isLive={false}
                    audioDuration={recordedAudio.durationSeconds}
                    currentTime={fullAudioCurrentTime}
                    onSeek={handleFullAudioSeek}
                    barCount={48}
                    height={60}
                    className="cursor-pointer rounded-lg bg-background/80 border"
                  />

                  {/* Controls Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={handleFullAudioTogglePlay}
                        data-testid="play-full-audio-btn"
                        className="h-8 px-3 gap-1.5 text-xs font-semibold rounded-full cursor-pointer"
                      >
                        {isFullAudioPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Tạm dừng</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Phát âm thanh</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleFullAudioSeek(0)}
                        title="Phát lại từ đầu"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Speed Selection */}
                    <div className="flex items-center gap-1 bg-muted/80 p-0.5 rounded-md text-xs font-mono">
                      {[0.8, 1.0, 1.2, 1.5].map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => handleSetPlaybackSpeed(speed)}
                          className={cn(
                            "px-2 py-0.5 rounded transition-colors cursor-pointer",
                            playbackSpeed === speed
                              ? "bg-primary text-primary-foreground font-bold shadow-xs"
                              : "text-foreground/90 hover:bg-background/60 font-semibold"
                          )}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Real-time Transcript */}
          <Card className="shadow-xs border py-0 gap-0 overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20 pb-3">
              <CardTitle className="text-sm font-bold">
                Bản chép lời hội thoại
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
              {transcripts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Không có dữ liệu bản chép lời.
                </p>
              ) : (
                transcripts.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "p-2.5 rounded-lg text-xs leading-relaxed",
                      item.sender === "examiner"
                        ? "bg-indigo-500/10 border border-indigo-500/20 text-foreground"
                        : "bg-muted/40 border text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "font-bold mr-1.5 text-xs uppercase",
                        item.sender === "examiner"
                          ? "text-indigo-900 dark:text-indigo-200"
                          : "text-foreground"
                      )}
                    >
                      {item.sender === "examiner" ? "Giám khảo:" : "Thí sinh:"}
                    </span>
                    <span>{item.text}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
