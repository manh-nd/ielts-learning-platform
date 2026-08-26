"use client";

import { useState } from "react";
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
              Đang phân tích & Chấm điểm phiên thi...
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Hệ thống AI đang gỡ băng, phân tích sóng âm (Pronunciation &
              Intonation), ngữ pháp và từ vựng theo 4 tiêu chí chuẩn khảo thí
              IELTS.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/30 px-3 py-1.5 rounded-md border">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Mô hình: Gemini 3.7 Flash Multimodal Audio Evaluator</span>
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

  const { overallScorecard, partEvaluations, trace } = evaluationResult;
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
          <Card className="shadow-xs border">
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
            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Điểm mạnh nổi bật (Key Strengths)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <ul className="space-y-1.5 list-disc pl-4 text-xs text-foreground/90">
                  {keyStrengths.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Priority Improvements */}
            <Card className="border-rose-500/30 bg-rose-500/5 shadow-xs">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Điểm cần cải thiện (Priority Improvements)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <ul className="space-y-1.5 list-disc pl-4 text-xs text-foreground/90">
                  {priorityImprovements.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Band 8.0+ Model Monologue (Shadow Reading Practice) */}
          {practiceMonologue && (
            <Card className="shadow-xs border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-background to-amber-500/5 overflow-hidden">
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
            <Card className="shadow-xs border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Lộ trình Luyện tập Khuyến nghị (Action Plan)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
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
            <Card key={index} className="shadow-xs border">
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
                  <span className="font-semibold text-muted-foreground block mb-1">
                    Nội dung câu trả lời (Transcript):
                  </span>
                  <p className="p-3 rounded-lg bg-muted/30 border font-serif text-foreground/90 italic leading-relaxed">
                    &ldquo;{partEval.candidateTranscript}&rdquo;
                  </p>
                </div>

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
                            <p className="text-[11px] text-muted-foreground">
                              {item.contextExample}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Grammar Corrections */}
                {partEval.grammarCorrections &&
                  partEval.grammarCorrections.length > 0 && (
                    <div>
                      <span className="font-semibold text-amber-800 dark:text-amber-300 block mb-1.5">
                        Sửa lỗi Ngữ pháp (Grammar Fixes):
                      </span>
                      <div className="space-y-2">
                        {partEval.grammarCorrections.map((item, i: number) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg border bg-amber-500/5 space-y-1"
                          >
                            <div className="text-rose-800 dark:text-rose-400">
                              ❌ {item.originalPhrase}
                            </div>
                            <div className="text-emerald-800 dark:text-emerald-400 font-medium">
                              ✓ {item.correctedPhrase}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {item.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Pronunciation Notes */}
                {partEval.pronunciationNotes &&
                  partEval.pronunciationNotes.length > 0 && (
                    <div>
                      <span className="font-semibold text-purple-800 dark:text-purple-300 block mb-1.5">
                        Lưu ý Phát âm (Phonetic & Stress Notes):
                      </span>
                      <div className="space-y-2">
                        {partEval.pronunciationNotes.map((item, i: number) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg border bg-purple-500/5 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-purple-700 dark:text-purple-300">
                                {item.word}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {item.expectedIpa}
                              </span>
                            </div>
                            <div className="text-rose-700 dark:text-rose-400">
                              {item.detectedIssue}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {item.recommendation}
                            </p>
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
            <Card className="shadow-xs border">
              <CardHeader className="p-4 border-b bg-muted/20 pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" />
                  <span>
                    File Ghi âm Buổi thi ({recordedAudio.durationSeconds}s)
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Nghe lại toàn bộ âm thanh câu trả lời của bạn trong phòng thi
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <audio
                  controls
                  src={recordedAudio.url}
                  className="w-full h-10"
                />
              </CardContent>
            </Card>
          )}

          {/* Full Real-time Transcript */}
          <Card className="shadow-xs border">
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
