"use client";

import { useMemo, useCallback } from "react";
import {
  AssessmentScores,
  AssessmentMode,
  WritingCriterion,
  WRITING_CRITERIA_ORDER,
  CRITERION_META,
  calculateOverallBand,
  calculateRawAverage,
} from "./types";
import { CriteriaScoreSlider } from "./criteria-score-slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkles, CheckCheck, Award, Scale, FileCheck2 } from "lucide-react";

export interface AssessmentScorecardProps {
  scores: AssessmentScores;
  aiProposalScores?: AssessmentScores;
  mode?: AssessmentMode;
  taskType?: "TASK_1" | "TASK_2" | "SPEAKING";
  title?: string;
  examinerFeedback?: string;
  onScoresChange?: (newScores: AssessmentScores, overallBand: number) => void;
  onCriterionChange?: (criterion: WritingCriterion, score: number) => void;
  onAcceptAllAi?: () => void;
  onResetCriterionToAi?: (criterion: WritingCriterion) => void;
  showAiComparison?: boolean;
  showRubrics?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function AssessmentScorecard({
  scores,
  aiProposalScores,
  mode = "interactive",
  taskType = "TASK_2",
  title = "Bảng Đánh Giá & Chấm Điểm IELTS",
  examinerFeedback,
  onScoresChange,
  onCriterionChange,
  onAcceptAllAi,
  onResetCriterionToAi,
  showAiComparison = true,
  showRubrics = true,
  className,
  "data-testid": testId = "assessment-scorecard",
}: AssessmentScorecardProps) {
  const isInteractive = mode === "interactive";

  // Calculate Overall Band according to official IELTS rounding rules
  const currentOverall = useMemo(() => calculateOverallBand(scores), [scores]);
  const rawAverage = useMemo(() => calculateRawAverage(scores), [scores]);

  const aiOverall = useMemo(() => {
    return aiProposalScores ? calculateOverallBand(aiProposalScores) : null;
  }, [aiProposalScores]);

  const aiRawAverage = useMemo(() => {
    return aiProposalScores ? calculateRawAverage(aiProposalScores) : null;
  }, [aiProposalScores]);

  // Check differences between AI proposals and current teacher scores
  const diffs = useMemo(() => {
    if (!aiProposalScores) return [];
    return WRITING_CRITERIA_ORDER.map((crit) => {
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
  const overallDelta =
    aiOverall !== null ? Number((currentOverall - aiOverall).toFixed(1)) : 0;

  // Handlers
  const handleScoreChange = useCallback(
    (criterion: WritingCriterion, newScore: number) => {
      const updatedScores: AssessmentScores = {
        ...scores,
        [criterion]: newScore,
      };
      const newOverall = calculateOverallBand(updatedScores);
      onCriterionChange?.(criterion, newScore);
      onScoresChange?.(updatedScores, newOverall);
    },
    [scores, onCriterionChange, onScoresChange]
  );

  const handleResetToAI = useCallback(
    (criterion: WritingCriterion) => {
      if (!aiProposalScores) return;
      const aiScore = aiProposalScores[criterion];
      if (typeof aiScore === "number") {
        handleScoreChange(criterion, aiScore);
        onResetCriterionToAi?.(criterion);
      }
    },
    [aiProposalScores, handleScoreChange, onResetCriterionToAi]
  );

  const handleAcceptAllAI = useCallback(() => {
    if (!aiProposalScores) return;
    const newOverall = calculateOverallBand(aiProposalScores);
    onScoresChange?.(aiProposalScores, newOverall);
    onAcceptAllAi?.();
  }, [aiProposalScores, onScoresChange, onAcceptAllAi]);

  // Color helper for Band Scores
  const getBandBadgeColor = (val: number) => {
    if (val >= 7.5) return "bg-emerald-700 text-white dark:bg-emerald-600";
    if (val >= 6.5) return "bg-teal-700 text-white dark:bg-teal-600";
    if (val >= 5.5) return "bg-amber-700 text-white dark:bg-amber-600";
    return "bg-rose-700 text-white dark:bg-rose-600";
  };

  return (
    <Card
      className={cn(
        "rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all py-0 gap-0",
        className
      )}
      data-testid={testId}
    >
      {/* Top Banner: Header, Overall Band Badge, and Quick AI Actions */}
      <CardHeader className="p-5 sm:p-6 bg-gradient-to-r from-muted/40 via-muted/20 to-background border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-medium text-[11px] px-2">
                {taskType === "TASK_2"
                  ? "Writing Task 2"
                  : taskType === "TASK_1"
                    ? "Writing Task 1"
                    : "IELTS Speaking"}
              </Badge>
              {mode === "readonly" ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-muted/80 text-muted-foreground"
                >
                  <FileCheck2 className="mr-1 h-3 w-3" /> Báo cáo học viên
                </Badge>
              ) : (
                <Badge
                  variant="default"
                  className="text-[10px] bg-primary/90 text-primary-foreground"
                >
                  <Scale className="mr-1 h-3 w-3" /> Teacher Grading Mode
                </Badge>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quy tắc làm tròn IELTS: Điểm trung bình cộng 4 tiêu chí được làm
              tròn theo chuẩn Khảo thí Quốc tế.
            </p>
          </div>

          {/* Big Overall Band Score Display Card */}
          <div
            className="flex items-center gap-3.5 bg-background/80 backdrop-blur-sm border rounded-xl p-3 shadow-2xs shrink-0"
            data-testid="overall-score-container"
          >
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Overall Band Score
              </span>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="text-[11px] font-mono text-muted-foreground/80">
                  (tb {rawAverage.toFixed(3)})
                </span>
                <span className="text-xs font-semibold">→</span>
              </div>
            </div>

            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl font-extrabold text-xl shadow-md transition-transform transform active:scale-95",
                getBandBadgeColor(currentOverall)
              )}
              data-testid="overall-band-badge"
            >
              {currentOverall.toFixed(1)}
            </div>
          </div>
        </div>

        {/* AI Proposal Comparison & Quick Bulk Action Row */}
        {showAiComparison && aiProposalScores && (
          <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>
                  AI Overall:{" "}
                  <strong
                    className="text-foreground"
                    data-testid="ai-overall-text"
                  >
                    {aiOverall?.toFixed(1)}
                  </strong>
                </span>
                <span className="text-muted-foreground/60 text-[10px]">
                  (tb {aiRawAverage?.toFixed(3)})
                </span>
              </div>

              {overallDelta !== 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] h-5 px-1.5 font-mono font-bold",
                    overallDelta > 0
                      ? "border-emerald-600 text-emerald-800 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-950/40"
                      : "border-rose-600 text-rose-800 bg-rose-50 dark:text-rose-300 dark:border-rose-700 dark:bg-rose-950/40"
                  )}
                  data-testid="overall-delta-badge"
                >
                  {overallDelta > 0 ? `+${overallDelta}` : overallDelta}
                </Badge>
              )}
            </div>

            {/* Quick Actions in Interactive Mode */}
            {isInteractive && hasAnyDifferences && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAcceptAllAI}
                  className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 hover:border-primary"
                  data-testid="accept-all-ai-btn"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Chấp nhận toàn bộ AI (
                  {diffs.filter((d) => d.hasChanged).length})
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      {/* 4 Criteria Scoring Sliders */}
      <CardContent className="p-5 sm:p-6 space-y-4">
        {WRITING_CRITERIA_ORDER.map((criterion) => {
          const score = scores[criterion] ?? 0;
          const aiScore = aiProposalScores
            ? aiProposalScores[criterion]
            : undefined;

          return (
            <CriteriaScoreSlider
              key={criterion}
              criterion={criterion}
              score={score}
              aiProposalScore={aiScore}
              editable={isInteractive}
              onChange={(newVal) => handleScoreChange(criterion, newVal)}
              onResetToAI={() => handleResetToAI(criterion)}
              showRubricTrigger={showRubrics}
              showAiComparison={showAiComparison}
              data-testid={`scorecard-slider-${CRITERION_META[criterion].short.toLowerCase()}`}
            />
          );
        })}

        {/* Examiner Feedback text block if provided */}
        {examinerFeedback && (
          <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-xs">
            <h5 className="font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-primary" /> Nhận xét tổng quan của
              Giáo viên:
            </h5>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {examinerFeedback}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
