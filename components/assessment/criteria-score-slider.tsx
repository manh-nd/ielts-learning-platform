"use client";

import { useState, useId, useMemo, useCallback, memo } from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { Criterion, CRITERION_META } from "./types";
import {
  getBandDescriptor,
  IELTS_BAND_DESCRIPTORS,
} from "./band-descriptors-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Minus, Plus, BookOpen, Sparkles, RotateCcw, Info } from "lucide-react";

export interface CriteriaScoreSliderProps {
  criterion: Criterion;
  score: number;
  aiProposalScore?: number;
  editable?: boolean;
  onChange?: (newScore: number) => void;
  onResetToAI?: () => void;
  min?: number;
  max?: number;
  step?: number;
  showRubricTrigger?: boolean;
  showAiComparison?: boolean;
  className?: string;
  "data-testid"?: string;
}

function CriteriaScoreSliderBase({
  criterion,
  score,
  aiProposalScore,
  editable = true,
  onChange,
  onResetToAI,
  min = 0.0,
  max = 9.0,
  step = 0.5,
  showRubricTrigger = true,
  showAiComparison = true,
  className,
  "data-testid": testId,
}: CriteriaScoreSliderProps) {
  const meta = CRITERION_META[criterion];
  const [isRubricDialogOpen, setIsRubricDialogOpen] = useState(false);
  const [isDescriptorPopoverOpen, setIsDescriptorPopoverOpen] = useState(false);
  const sliderId = useId();

  const currentDescriptor = useMemo(
    () => getBandDescriptor(criterion, score),
    [criterion, score]
  );

  const hasAiDelta =
    typeof aiProposalScore === "number" && aiProposalScore !== score;
  const delta =
    typeof aiProposalScore === "number"
      ? Number((score - aiProposalScore).toFixed(1))
      : 0;

  const handleStepChange = useCallback(
    (deltaVal: number) => {
      if (!editable || !onChange) return;
      const nextScore = Math.min(
        max,
        Math.max(min, Number((score + deltaVal).toFixed(1)))
      );
      onChange(nextScore);
    },
    [editable, onChange, max, min, score]
  );

  const handleSliderValueChange = useCallback(
    (val: number | readonly number[]) => {
      if (!editable || !onChange) return;
      const numericVal = Array.isArray(val) ? val[0] : val;
      if (typeof numericVal === "number") {
        onChange(Number(numericVal.toFixed(1)));
      }
    },
    [editable, onChange]
  );

  return (
    <div
      className={cn(
        "group/slider rounded-xl border bg-card p-4 transition-colors shadow-2xs hover:shadow-xs",
        className
      )}
      data-testid={
        testId || `criteria-score-slider-${meta.short.toLowerCase()}`
      }
    >
      {/* Top Header: Title, Category Color Indicator, Rubric Info, and Score Badges */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-bold text-xs shadow-2xs",
              meta.badgeBg
            )}
            title={meta.label}
          >
            {meta.short}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-semibold text-foreground truncate">
                {meta.label}
              </h4>
              {showRubricTrigger && (
                <Popover
                  open={isDescriptorPopoverOpen}
                  onOpenChange={setIsDescriptorPopoverOpen}
                >
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Mô tả Band ${score.toFixed(1)} cho ${meta.label}`}
                        className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5 rounded"
                        data-testid={`rubric-popover-trigger-${meta.short.toLowerCase()}`}
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                  {isDescriptorPopoverOpen && (
                    <PopoverContent
                      side="top"
                      align="start"
                      className="w-80 p-4 shadow-lg border bg-popover text-popover-foreground z-50 font-sans"
                      data-testid={`rubric-popover-content-${meta.short.toLowerCase()}`}
                    >
                      <PopoverHeader className="pb-1.5 border-b mb-2">
                        <div className="flex items-center justify-between">
                          <PopoverTitle className="text-xs font-bold flex items-center gap-1.5">
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold text-white",
                                meta.badgeBg
                              )}
                            >
                              {meta.short} {score.toFixed(1)}
                            </span>
                            <span>Band Descriptors</span>
                          </PopoverTitle>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDescriptorPopoverOpen(false);
                              setIsRubricDialogOpen(true);
                            }}
                            className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1"
                            data-testid={`open-full-rubric-from-popover-${meta.short.toLowerCase()}`}
                          >
                            <BookOpen className="h-3 w-3" /> Ma trận full
                          </button>
                        </div>
                        <PopoverDescription className="text-[11px] font-medium text-foreground mt-1">
                          {currentDescriptor.summary}
                        </PopoverDescription>
                      </PopoverHeader>
                      <div className="text-[11px] text-muted-foreground leading-relaxed">
                        <p className="italic mb-2">
                          {currentDescriptor.detail}
                        </p>
                        {currentDescriptor.bulletPoints && (
                          <ul className="list-disc list-inside space-y-1 text-[10.5px]">
                            {currentDescriptor.bulletPoints.map((bp, i) => (
                              <li key={i}>{bp}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </PopoverContent>
                  )}
                </Popover>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate hidden sm:block">
              {meta.vietnameseLabel}
            </p>
          </div>
        </div>

        {/* Right side: AI proposal badge & Current Score Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {showAiComparison && typeof aiProposalScore === "number" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border transition-colors",
                        hasAiDelta
                          ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200"
                          : "bg-muted text-foreground/80 border-border/60"
                      )}
                      data-testid={`ai-proposal-score-${meta.short.toLowerCase()}`}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>AI: {aiProposalScore.toFixed(1)}</span>
                    </div>
                  }
                />
                <TooltipContent side="top">
                  <span className="text-[11px]">
                    Điểm AI đề xuất ban đầu:{" "}
                    <strong>{aiProposalScore.toFixed(1)}</strong>
                  </span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Delta Indicator & Reset Button */}
          {hasAiDelta && editable && onResetToAI && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onResetToAI}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      data-testid={`reset-to-ai-btn-${meta.short.toLowerCase()}`}
                      aria-label="Khôi phục điểm theo AI đề xuất"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  }
                />
                <TooltipContent side="top">
                  <span>Khôi phục về {aiProposalScore?.toFixed(1)}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Delta Tag */}
          {hasAiDelta && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] h-5 px-1 font-mono font-bold",
                delta > 0
                  ? "border-emerald-600 text-emerald-800 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-950/40"
                  : "border-rose-600 text-rose-800 bg-rose-50 dark:text-rose-300 dark:border-rose-700 dark:bg-rose-950/40"
              )}
              data-testid={`delta-badge-${meta.short.toLowerCase()}`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </Badge>
          )}

          {/* Current Score Pill */}
          <div
            className={cn(
              "flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold shadow-2xs transition-colors",
              meta.badgeBg
            )}
            data-testid={`current-score-badge-${meta.short.toLowerCase()}`}
          >
            {score.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Main Slider Track & Controls */}
      <div className="flex items-center gap-3">
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleStepChange(-step)}
            disabled={score <= min}
            className="h-7 w-7 p-0 rounded-lg shrink-0 disabled:opacity-30"
            data-testid={`stepper-minus-${meta.short.toLowerCase()}`}
            aria-label={`Giảm điểm ${meta.label} 0.5`}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
        )}

        <div className="relative flex-1">
          <SliderPrimitive.Root
            id={sliderId}
            disabled={!editable}
            value={[score]}
            onValueChange={handleSliderValueChange}
            min={min}
            max={max}
            step={step}
            thumbAlignment="edge"
            className="relative flex w-full touch-none items-center select-none py-1.5"
            data-testid={`slider-root-${meta.short.toLowerCase()}`}
          >
            <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-60">
              <SliderPrimitive.Track className="relative h-2 grow overflow-hidden rounded-full bg-muted select-none">
                <SliderPrimitive.Indicator
                  className={cn(
                    "h-full select-none",
                    criterion === "TASK_ACHIEVEMENT" && "bg-emerald-500",
                    criterion === "COHERENCE_COHESION" && "bg-amber-500",
                    criterion === "LEXICAL_RESOURCE" && "bg-blue-500",
                    criterion === "GRAMMATICAL_RANGE_ACCURACY" && "bg-rose-500"
                  )}
                />
              </SliderPrimitive.Track>
              <SliderPrimitive.Thumb
                data-slot="slider-thumb"
                className={cn(
                  "relative block h-4 w-4 shrink-0 rounded-full border-2 border-background bg-foreground shadow-md ring-ring/30 select-none transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
                  criterion === "TASK_ACHIEVEMENT" &&
                    "hover:bg-emerald-600 focus-visible:ring-emerald-500",
                  criterion === "COHERENCE_COHESION" &&
                    "hover:bg-amber-600 focus-visible:ring-amber-500",
                  criterion === "LEXICAL_RESOURCE" &&
                    "hover:bg-blue-600 focus-visible:ring-blue-500",
                  criterion === "GRAMMATICAL_RANGE_ACCURACY" &&
                    "hover:bg-rose-600 focus-visible:ring-rose-500"
                )}
                aria-label={`Điểm tiêu chí ${meta.label}`}
                data-testid={`slider-thumb-${meta.short.toLowerCase()}`}
              />
            </SliderPrimitive.Control>
          </SliderPrimitive.Root>

          {/* Scale markers: 0.0, 3.0, 6.0, 9.0 */}
          <div className="flex justify-between text-[9px] font-mono text-muted-foreground font-medium px-0.5 mt-0.5">
            <span>0.0</span>
            <span>3.0</span>
            <span>6.0</span>
            <span>9.0</span>
          </div>
        </div>

        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleStepChange(step)}
            disabled={score >= max}
            className="h-7 w-7 p-0 rounded-lg shrink-0 disabled:opacity-30"
            data-testid={`stepper-plus-${meta.short.toLowerCase()}`}
            aria-label={`Tăng điểm ${meta.label} 0.5`}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Full Band Descriptors Matrix Dialog (Lazy mounted only when opened) */}
      <Dialog open={isRubricDialogOpen} onOpenChange={setIsRubricDialogOpen}>
        {isRubricDialogOpen && (
          <DialogContent
            className="max-w-2xl max-h-[85vh] overflow-y-auto font-sans"
            data-testid={`full-rubric-dialog-${meta.short.toLowerCase()}`}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Bảng Ma Trận IELTS Band Descriptors — {meta.label}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Tiêu chuẩn chấm điểm chính thức của Hội đồng Khảo thí IELTS cho
                tiêu chí {meta.vietnameseLabel}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 py-2">
              {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((b) => {
                const item = IELTS_BAND_DESCRIPTORS[criterion][b];
                if (!item) return null;
                const isCurrentSelection = Math.floor(score) === b;

                return (
                  <div
                    key={b}
                    className={cn(
                      "p-3 rounded-lg border text-xs transition-colors",
                      isCurrentSelection
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/60 bg-muted/20 hover:bg-muted/40"
                    )}
                    data-testid={`rubric-band-row-${b}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold text-white",
                            b >= 7
                              ? "bg-emerald-700"
                              : b >= 5
                                ? "bg-amber-700"
                                : "bg-rose-700"
                          )}
                        >
                          {b}.0
                        </span>
                        <span className="text-foreground">{item.summary}</span>
                      </span>
                      {isCurrentSelection && (
                        <Badge variant="default" className="text-[10px] h-4">
                          Đang chọn ({score.toFixed(1)})
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[11px] italic mb-1.5 leading-relaxed">
                      {item.detail}
                    </p>
                    {item.bulletPoints && (
                      <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-muted-foreground">
                        {item.bulletPoints.map((pt, idx) => (
                          <li key={idx}>{pt}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <DialogClose render={<Button variant="outline" size="sm" />}>
                Đóng
              </DialogClose>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

export const CriteriaScoreSlider = memo(CriteriaScoreSliderBase);
