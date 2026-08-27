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
import { IeltsSpeakingEvaluationResult } from "@/lib/gemini/speaking-schema";
import { RecordedAudioData, TranscriptItem } from "./types";
import { cn } from "@/lib/utils";

export interface LiveSpeakingResultViewProps {
  evaluationResult: IeltsSpeakingEvaluationResult | null;
  isLoading: boolean;
  error?: string | null;
  recordedAudio: RecordedAudioData | null;
  transcripts: TranscriptItem[];
  onRetryEvaluation?: () => void;
  onRestartTest: () => void;
  onBackToDashboard: () => void;
  className?: string;
}

export function LiveSpeakingResultView({
  evaluationResult,
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

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const clipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
              Đang phân tích & Chấm điểm 2-Stage...
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Pass 1: Gỡ băng nguyên bản Verbatim $\rightarrow$ Pass 2: Phân
              tích sóng âm đa phương thức & trích xuất mốc thời gian lỗi (FC,
              LR, GRA, PR).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/30 px-3 py-1.5 rounded-md border">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Mô hình: Gemini 3.7 Flash Multimodal + Verbatim STT</span>
          </div>
        </div>
      </Card>
    );
  }

  if (error || !evaluationResult) {
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
                "Đã xảy ra sự cố khi gọi API chấm điểm tự động. Vui lòng thử lại."}
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

  const formatTimestamp = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
          <TabsTrigger value="audio">Ghi âm & Gỡ băng</TabsTrigger>
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
                      Nội dung câu trả lời (Verbatim Transcript):
                    </span>
                    {partEval.verifiedTranscript && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      >
                        ✓ Đã xác thực nguyên bản (Audio Verified)
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
            <Card className="shadow-xs border py-0 gap-0 overflow-hidden">
              <CardHeader className="p-4 border-b bg-muted/20 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" />
                  <span>
                    File Ghi âm Buổi thi ({recordedAudio.durationSeconds}s)
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Nghe lại toàn bộ âm thanh giọng nói của bạn (Source of Truth)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <audio
                  controls
                  src={recordedAudio.url}
                  className="w-full h-10"
                />
              </CardContent>
            </Card>
          )}

          {/* Full Real-time Transcript */}
          <Card className="shadow-xs border py-0 gap-0 overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20 pb-3">
              <CardTitle className="text-sm font-bold">
                Biên bản Hội thoại Trực tiếp (Live Transcripts)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
              {transcripts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Không có dữ liệu gỡ băng.
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
                    <span className="font-bold mr-1.5 text-[11px] uppercase text-muted-foreground">
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
