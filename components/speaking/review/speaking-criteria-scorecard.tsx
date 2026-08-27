"use client";

import { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { calculateIeltsOverallBand } from "@/lib/gemini/speaking-schema";
import { Sparkles, Award, RotateCcw, Clock, Cpu } from "lucide-react";

export type SpeakingCriterionKey =
  | "fluencyAndCoherence"
  | "lexicalResource"
  | "grammaticalRangeAndAccuracy"
  | "pronunciation";

export interface SpeakingCriteriaScores {
  fluencyAndCoherence: number;
  lexicalResource: number;
  grammaticalRangeAndAccuracy: number;
  pronunciation: number;
}

export interface SpeakingCriterionMeta {
  key: SpeakingCriterionKey;
  label: string;
  short: string;
  vietnameseLabel: string;
  color: "emerald" | "blue" | "amber" | "purple";
  bgLight: string;
  border: string;
  text: string;
  badgeBg: string;
}

export const SPEAKING_CRITERIA_META: Record<
  SpeakingCriterionKey,
  SpeakingCriterionMeta
> = {
  fluencyAndCoherence: {
    key: "fluencyAndCoherence",
    label: "Fluency & Coherence",
    short: "FC",
    vietnameseLabel: "Độ trôi chảy & Mạch lạc",
    color: "emerald",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    badgeBg: "bg-emerald-700 text-white",
  },
  lexicalResource: {
    key: "lexicalResource",
    label: "Lexical Resource",
    short: "LR",
    vietnameseLabel: "Vốn từ vựng & Độ chuẩn xác",
    color: "blue",
    bgLight: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    badgeBg: "bg-blue-700 text-white",
  },
  grammaticalRangeAndAccuracy: {
    key: "grammaticalRangeAndAccuracy",
    label: "Grammatical Range & Accuracy",
    short: "GRA",
    vietnameseLabel: "Ngữ pháp & Cấu trúc đa dạng",
    color: "amber",
    bgLight: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-700 text-white",
  },
  pronunciation: {
    key: "pronunciation",
    label: "Pronunciation",
    short: "PR",
    vietnameseLabel: "Phát âm & Ngữ điệu sóng âm",
    color: "purple",
    bgLight: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-500",
    text: "text-purple-700 dark:text-purple-300",
    badgeBg: "bg-purple-700 text-white",
  },
};

export const SPEAKING_CRITERIA_ORDER: SpeakingCriterionKey[] = [
  "fluencyAndCoherence",
  "lexicalResource",
  "grammaticalRangeAndAccuracy",
  "pronunciation",
];

export interface SpeakingScorecardTraceInfo {
  modelUsed: string;
  isFallback: boolean;
  fallbackReason?: string | null;
  durationMs: number;
  tokensUsed?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
}

export interface SpeakingCriteriaScorecardProps {
  scores: SpeakingCriteriaScores;
  aiProposalScores?: SpeakingCriteriaScores;
  traceMetadata?: SpeakingScorecardTraceInfo;
  editable?: boolean;
  onScoresChange?: (
    newScores: SpeakingCriteriaScores,
    overallBand: number
  ) => void;
  onCriterionChange?: (criterion: SpeakingCriterionKey, score: number) => void;
  onAcceptAllAi?: () => void;
  onResetCriterionToAi?: (criterion: SpeakingCriterionKey) => void;
  className?: string;
  "data-testid"?: string;
}

export function SpeakingCriteriaScorecard({
  scores,
  aiProposalScores,
  traceMetadata,
  editable = true,
  onScoresChange,
  onCriterionChange,
  onAcceptAllAi,
  onResetCriterionToAi,
  className,
  "data-testid": testId = "speaking-criteria-scorecard",
}: SpeakingCriteriaScorecardProps) {
  // Compute Overall Band according to official IELTS rounding rules
  const overallBand = useMemo(() => {
    return calculateIeltsOverallBand(
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

  const aiOverallBand = useMemo(() => {
    if (!aiProposalScores) return null;
    return calculateIeltsOverallBand(
      aiProposalScores.fluencyAndCoherence,
      aiProposalScores.lexicalResource,
      aiProposalScores.grammaticalRangeAndAccuracy,
      aiProposalScores.pronunciation
    );
  }, [aiProposalScores]);

  const diffs = useMemo(() => {
    if (!aiProposalScores) return [];
    return SPEAKING_CRITERIA_ORDER.map((crit) => {
      const teacherScore = scores[crit] ?? 0;
      const aiScore = aiProposalScores[crit] ?? 0;
      const delta = Number((teacherScore - aiScore).toFixed(1));
      return {
        criterion: crit,
        aiScore,
        teacherScore,
        delta,
        hasChanged: teacherScore !== aiScore,
      };
    });
  }, [scores, aiProposalScores]);

  const hasAnyDifferences = diffs.some((d) => d.hasChanged);

  const handleSliderChange = useCallback(
    (criterion: SpeakingCriterionKey, val: number[]) => {
      const newScore = val[0];
      const updated: SpeakingCriteriaScores = {
        ...scores,
        [criterion]: newScore,
      };
      const newOverall = calculateIeltsOverallBand(
        updated.fluencyAndCoherence,
        updated.lexicalResource,
        updated.grammaticalRangeAndAccuracy,
        updated.pronunciation
      );
      onCriterionChange?.(criterion, newScore);
      onScoresChange?.(updated, newOverall);
    },
    [scores, onCriterionChange, onScoresChange]
  );

  return (
    <Card
      className={cn(
        "border shadow-sm bg-card transition-colors duration-200 py-0 gap-0 overflow-hidden",
        className
      )}
      data-testid={testId}
    >
      <CardHeader className="p-4 sm:p-6 border-b bg-muted/20 space-y-3">
        {/* Top: Title & Icon */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-base text-foreground tracking-tight leading-tight">
              Bảng Điểm 4 Tiêu Chí IELTS Speaking
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chuẩn hóa điểm số theo tiêu chuẩn khảo thí IELTS
            </p>
          </div>
        </div>

        {/* AI Model Trace Badges Row */}
        {traceMetadata && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <Badge
              variant="outline"
              className={cn(
                "gap-1 py-0.5 px-2 font-mono text-[11px] rounded-md font-medium",
                traceMetadata.isFallback
                  ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300"
                  : "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300"
              )}
            >
              <Cpu className="h-3 w-3" />
              <span>{traceMetadata.modelUsed}</span>
              {traceMetadata.isFallback && (
                <span className="font-sans text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300">
                  (Fallback)
                </span>
              )}
            </Badge>
            <Badge
              variant="secondary"
              className="gap-1 py-0.5 px-2 text-[11px] font-mono text-foreground/80 font-medium rounded-md"
            >
              <Clock className="h-3 w-3" />
              <span>{(traceMetadata.durationMs / 1000).toFixed(1)}s</span>
            </Badge>
            {traceMetadata.tokensUsed && (
              <span className="text-[11px] text-muted-foreground font-mono ml-auto">
                {traceMetadata.tokensUsed.totalTokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        )}

        {/* Overall Band Hero Highlight */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-muted-foreground">
              Overall Band Score (IELTS)
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

          {aiProposalScores && (
            <div className="flex flex-col items-end gap-1">
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block">
                  AI Đề xuất:
                </span>
                <span className="text-sm font-bold text-foreground font-mono">
                  Band {aiOverallBand?.toFixed(1)}
                </span>
              </div>
              {hasAnyDifferences && onAcceptAllAi && editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAcceptAllAi}
                  className="h-7 px-2.5 gap-1 text-[11px] font-medium border-primary/30 hover:bg-primary/10 mt-0.5"
                  data-testid="accept-all-ai-button"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span>Áp dụng điểm AI</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {SPEAKING_CRITERIA_ORDER.map((criterionKey) => {
          const meta = SPEAKING_CRITERIA_META[criterionKey];
          const currentScore = scores[criterionKey] ?? 0;
          const aiScore = aiProposalScores?.[criterionKey];
          const hasDiff = aiScore !== undefined && currentScore !== aiScore;
          const delta = aiScore !== undefined ? currentScore - aiScore : 0;

          return (
            <div
              key={criterionKey}
              className={cn(
                "p-4 rounded-xl border transition-all duration-150",
                meta.bgLight,
                hasDiff ? "border-primary/40 shadow-xs" : "border-border/60"
              )}
              data-testid={`criterion-block-${criterionKey}`}
            >
              {/* Header of Criterion */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={cn("px-2 py-0.5 font-bold", meta.badgeBg)}>
                    {meta.short}
                  </Badge>
                  <div>
                    <span className="font-semibold text-sm text-foreground">
                      {meta.label}
                    </span>
                    <span className="text-xs text-foreground/80 ml-2 hidden sm:inline">
                      ({meta.vietnameseLabel})
                    </span>
                  </div>
                </div>

                {/* Score and AI Comparison */}
                <div className="flex items-center gap-2">
                  {aiScore !== undefined && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-foreground/80 font-mono">
                        AI: {aiScore.toFixed(1)}
                      </span>
                      {hasDiff && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 py-0 text-[10px] font-mono",
                            delta > 0
                              ? "text-emerald-800 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "text-rose-800 border-rose-400 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300"
                          )}
                        >
                          {delta > 0
                            ? `+${delta.toFixed(1)}`
                            : delta.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                  )}

                  <span
                    className={cn("text-lg font-bold font-mono", meta.text)}
                    data-testid={`score-value-${criterionKey}`}
                  >
                    {currentScore.toFixed(1)}
                  </span>

                  {hasDiff && onResetCriterionToAi && editable && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onResetCriterionToAi(criterionKey)}
                      aria-label="Khôi phục về điểm AI"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Khôi phục về điểm AI"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Slider for Interactive adjustment */}
              {editable ? (
                <div className="pt-1 px-1">
                  <Slider
                    min={0}
                    max={9}
                    step={0.5}
                    aria-label={`Điểm tiêu chí ${meta.label}`}
                    value={[currentScore]}
                    onValueChange={(val) =>
                      handleSliderChange(
                        criterionKey,
                        Array.isArray(val) ? [...val] : [val]
                      )
                    }
                    data-testid={`slider-${criterionKey}`}
                  />
                  <div className="flex justify-between text-[10px] text-foreground/80 font-medium mt-1.5 font-mono px-0.5">
                    <span>Band 0.0</span>
                    <span>5.0</span>
                    <span>6.0</span>
                    <span>7.0</span>
                    <span>8.0</span>
                    <span>9.0</span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
