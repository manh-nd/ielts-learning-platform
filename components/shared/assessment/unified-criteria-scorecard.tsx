"use client";

import { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Sparkles, Award, RotateCcw, Clock, Cpu } from "lucide-react";

export type SkillPreset = "speaking" | "writing";

export interface CriterionDefinition {
  key: string;
  label: string;
  short: string;
  vietnameseLabel: string;
  color: "emerald" | "blue" | "amber" | "purple" | "rose";
  badgeBg: string;
  text: string;
  border: string;
  bgLight: string;
}

export const PRESET_SPEAKING_CRITERIA: CriterionDefinition[] = [
  {
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
  {
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
  {
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
  {
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
];

export const PRESET_WRITING_CRITERIA: CriterionDefinition[] = [
  {
    key: "taskAchievement",
    label: "Task Achievement / Task Response",
    short: "TA",
    vietnameseLabel: "Đáp ứng yêu cầu đề bài",
    color: "emerald",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
    badgeBg: "bg-emerald-700 text-white",
  },
  {
    key: "coherenceAndCohesion",
    label: "Coherence & Cohesion",
    short: "CC",
    vietnameseLabel: "Độ mạch lạc & Liên kết",
    color: "amber",
    bgLight: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-700 text-white",
  },
  {
    key: "lexicalResource",
    label: "Lexical Resource",
    short: "LR",
    vietnameseLabel: "Vốn từ vựng học thuật",
    color: "blue",
    bgLight: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    badgeBg: "bg-blue-700 text-white",
  },
  {
    key: "grammaticalRangeAndAccuracy",
    label: "Grammatical Range & Accuracy",
    short: "GRA",
    vietnameseLabel: "Độ đa dạng & Chính xác ngữ pháp",
    color: "purple",
    bgLight: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-500",
    text: "text-purple-700 dark:text-purple-300",
    badgeBg: "bg-purple-700 text-white",
  },
];

export interface UnifiedScorecardTraceInfo {
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

export interface UnifiedCriteriaScorecardProps {
  preset?: SkillPreset;
  criteria?: CriterionDefinition[];
  scores: Record<string, number>;
  aiProposalScores?: Record<string, number>;
  traceMetadata?: UnifiedScorecardTraceInfo;
  editable?: boolean;
  showCefrBadge?: boolean;
  title?: string;
  onScoresChange?: (
    newScores: Record<string, number>,
    overallBand: number
  ) => void;
  onCriterionChange?: (criterionKey: string, score: number) => void;
  onAcceptAllAi?: () => void;
  onResetCriterionToAi?: (criterionKey: string) => void;
  className?: string;
  "data-testid"?: string;
}

export function roundIeltsBandScore(avg: number): number {
  const floor = Math.floor(avg);
  const frac = avg - floor;
  if (frac < 0.25) return floor;
  if (frac < 0.75) return floor + 0.5;
  return floor + 1.0;
}

function getCefrBadge(band: number): { label: string; badgeClass: string } {
  if (band >= 8.5)
    return {
      label: "CEFR: C2 (Mastery)",
      badgeClass: "bg-purple-700 text-white",
    };
  if (band >= 7.0)
    return {
      label: "CEFR: C1 (Effective Operational)",
      badgeClass: "bg-blue-700 text-white",
    };
  if (band >= 5.5)
    return {
      label: "CEFR: B2 (Vantage)",
      badgeClass: "bg-emerald-700 text-white",
    };
  if (band >= 4.0)
    return {
      label: "CEFR: B1 (Threshold)",
      badgeClass: "bg-amber-800 text-white",
    };
  return { label: "CEFR: A2 (Waystage)", badgeClass: "bg-rose-700 text-white" };
}

export function UnifiedCriteriaScorecard({
  preset = "speaking",
  criteria: customCriteria,
  scores,
  aiProposalScores,
  traceMetadata,
  editable = false,
  showCefrBadge = true,
  title,
  onScoresChange,
  onCriterionChange,
  onAcceptAllAi,
  onResetCriterionToAi,
  className,
  "data-testid": testId = "unified-criteria-scorecard",
}: UnifiedCriteriaScorecardProps) {
  const criteriaList = useMemo(() => {
    if (customCriteria && customCriteria.length > 0) return customCriteria;
    return preset === "writing"
      ? PRESET_WRITING_CRITERIA
      : PRESET_SPEAKING_CRITERIA;
  }, [customCriteria, preset]);

  // Calculate Overall Band score
  const { overallBand, rawAverage } = useMemo(() => {
    const values = criteriaList.map((c) => scores[c.key] ?? 6.0);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = values.length > 0 ? sum / values.length : 6.0;
    return {
      overallBand: roundIeltsBandScore(avg),
      rawAverage: Math.round(avg * 100) / 100,
    };
  }, [criteriaList, scores]);

  const cefr = useMemo(() => getCefrBadge(overallBand), [overallBand]);

  // Check if scores differ from AI proposal
  const hasAiDelta = useMemo(() => {
    if (!aiProposalScores) return false;
    return criteriaList.some(
      (c) => (scores[c.key] ?? 0) !== (aiProposalScores[c.key] ?? 0)
    );
  }, [criteriaList, scores, aiProposalScores]);

  const handleScoreChange = useCallback(
    (criterionKey: string, newScore: number) => {
      const nextScores = { ...scores, [criterionKey]: newScore };
      onCriterionChange?.(criterionKey, newScore);

      const values = criteriaList.map((c) => nextScores[c.key] ?? 6.0);
      const sum = values.reduce((acc, v) => acc + v, 0);
      const nextOverall = roundIeltsBandScore(
        values.length > 0 ? sum / values.length : 6.0
      );
      onScoresChange?.(nextScores, nextOverall);
    },
    [scores, criteriaList, onCriterionChange, onScoresChange]
  );

  const displayTitle =
    title ||
    (preset === "writing"
      ? "Bảng Điểm 4 Tiêu Chí IELTS Writing"
      : "Bảng Điểm 4 Tiêu Chí IELTS Speaking");

  return (
    <Card
      data-testid={testId}
      className={cn("border shadow-xs overflow-hidden py-0 gap-0", className)}
    >
      {/* Top Banner: Title & Overall Band */}
      <CardHeader className="p-4 border-b bg-muted/20 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {displayTitle}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Điểm trung bình cộng:{" "}
            <span className="font-mono font-semibold">{rawAverage}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {showCefrBadge && (
            <Badge
              className={cn("text-xs font-mono font-bold", cefr.badgeClass)}
            >
              {cefr.label}
            </Badge>
          )}
          <div className="flex items-baseline gap-1 bg-primary text-primary-foreground px-3 py-1 rounded-lg font-mono">
            <span className="text-xs">Overall:</span>
            <span
              className="text-xl font-extrabold"
              data-testid="overall-band-score"
            >
              {overallBand.toFixed(1)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Quick Actions Bar (Accept all AI) */}
        {editable && aiProposalScores && hasAiDelta && (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Điểm chấm đang có sự khác biệt so với đề xuất AI</span>
            </div>
            {onAcceptAllAi && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAcceptAllAi}
                className="h-7 text-xs px-2.5 gap-1 cursor-pointer bg-background"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Chấp nhận toàn bộ AI</span>
              </Button>
            )}
          </div>
        )}

        {/* 4 Criteria Scoring Sliders */}
        <div className="space-y-3">
          {criteriaList.map((crit) => {
            const currentScore = scores[crit.key] ?? 6.0;
            const aiScore = aiProposalScores?.[crit.key];
            const delta = aiScore !== undefined ? currentScore - aiScore : 0;

            return (
              <div
                key={crit.key}
                className={cn(
                  "p-3 rounded-lg border transition-all space-y-2",
                  crit.bgLight,
                  crit.border
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[11px] font-mono font-bold",
                        crit.badgeBg
                      )}
                    >
                      {crit.short}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {crit.label}
                    </span>
                    <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium hidden sm:inline">
                      ({crit.vietnameseLabel})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* AI Comparison indicator */}
                    {aiScore !== undefined && delta !== 0 && (
                      <span
                        className={cn(
                          "text-[11px] font-mono font-bold px-1.5 py-0.2 rounded",
                          delta > 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        )}
                        title={`Đề xuất AI: Band ${aiScore.toFixed(1)}`}
                      >
                        {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}{" "}
                        vs AI
                      </span>
                    )}

                    {/* Current Score Badge */}
                    <Badge
                      variant="outline"
                      className="font-mono text-xs font-bold bg-background"
                    >
                      Band {currentScore.toFixed(1)}
                    </Badge>

                    {/* Reset single criterion button */}
                    {editable &&
                      onResetCriterionToAi &&
                      aiScore !== undefined &&
                      delta !== 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onResetCriterionToAi(crit.key)}
                          title={`Đặt lại về điểm AI (${aiScore.toFixed(1)})`}
                          className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </Button>
                      )}
                  </div>
                </div>

                {/* Score Slider (if editable) */}
                {editable ? (
                  <div className="pt-1">
                    <Slider
                      value={[currentScore]}
                      min={1.0}
                      max={9.0}
                      step={0.5}
                      onValueChange={(val) => {
                        const numericVal = Array.isArray(val)
                          ? val[0]
                          : typeof val === "number"
                            ? val
                            : 6.0;
                        handleScoreChange(crit.key, numericVal);
                      }}
                      className="cursor-pointer"
                      aria-label={`${crit.label} score`}
                    />
                    <div className="flex justify-between text-[10px] text-slate-700 dark:text-slate-300 font-mono font-medium pt-1">
                      <span>1.0</span>
                      <span>5.0</span>
                      <span>9.0</span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* AI Evaluation Trace Telemetry (if available) */}
        {traceMetadata && (
          <div className="p-2.5 rounded-lg bg-muted/40 border text-[11px] font-mono text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-primary" />
              <span>Mô hình: {traceMetadata.modelUsed}</span>
              {traceMetadata.isFallback && (
                <Badge variant="destructive" className="text-[9px] h-4">
                  Fallback
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {traceMetadata.durationMs}ms
              </span>
              {traceMetadata.tokensUsed && (
                <span>Tokens: {traceMetadata.tokensUsed.totalTokens}</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
