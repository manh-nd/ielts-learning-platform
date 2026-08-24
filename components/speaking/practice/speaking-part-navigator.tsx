"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  SpeakingSuiteStep,
  SpeakingTestConfig,
  RecordedAnswerItem,
} from "./types";

export interface SpeakingPartNavigatorProps {
  currentStep: SpeakingSuiteStep;
  onStepChange: (step: SpeakingSuiteStep) => void;
  config: SpeakingTestConfig;
  answers: Record<string, RecordedAnswerItem>;
  className?: string;
  isRecording?: boolean;
}

export function SpeakingPartNavigator({
  currentStep,
  onStepChange,
  config,
  answers,
  className,
  isRecording = false,
}: SpeakingPartNavigatorProps) {
  const part1CompletedCount = config.part1Questions.filter(
    (q) => !!answers[q.id]
  ).length;
  const isPart1Complete =
    config.part1Questions.length > 0 &&
    part1CompletedCount === config.part1Questions.length;

  const isPart2Complete = !!answers[config.part2Question.id];

  const part3CompletedCount = config.part3Questions.filter(
    (q) => !!answers[q.id]
  ).length;
  const isPart3Complete =
    config.part3Questions.length > 0 &&
    part3CompletedCount === config.part3Questions.length;

  const totalQuestions =
    config.part1Questions.length + 1 + config.part3Questions.length;
  const totalCompleted =
    part1CompletedCount + (isPart2Complete ? 1 : 0) + part3CompletedCount;

  const steps: {
    id: SpeakingSuiteStep;
    label: string;
    sublabel: string;
    isComplete: boolean;
    badgeText: string;
  }[] = [
    {
      id: "part1",
      label: "Part 1",
      sublabel: "Phỏng vấn & Đời sống",
      isComplete: isPart1Complete,
      badgeText: `${part1CompletedCount}/${config.part1Questions.length}`,
    },
    {
      id: "part2",
      label: "Part 2",
      sublabel: "Cue Card (2 Phút)",
      isComplete: isPart2Complete,
      badgeText: isPart2Complete ? "1/1" : "0/1",
    },
    {
      id: "part3",
      label: "Part 3",
      sublabel: "Thảo luận Chuyên sâu",
      isComplete: isPart3Complete,
      badgeText: `${part3CompletedCount}/${config.part3Questions.length}`,
    },
    {
      id: "summary",
      label: "Tổng kết",
      sublabel: "Xem lại & Nộp bài",
      isComplete: totalCompleted === totalQuestions,
      badgeText: `${totalCompleted}/${totalQuestions}`,
    },
  ];

  return (
    <div
      data-testid="speaking-part-navigator"
      className={cn(
        "w-full bg-card border rounded-xl p-2 sm:p-3 shadow-sm",
        className
      )}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {steps.map((step) => {
          const isActive = currentStep === step.id;

          return (
            <button
              key={step.id}
              type="button"
              disabled={isRecording}
              onClick={() => onStepChange(step.id)}
              className={cn(
                "flex items-center justify-between p-2.5 rounded-lg border text-left transition-all",
                isActive
                  ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                  : "border-transparent bg-muted/40 hover:bg-muted/70 text-muted-foreground",
                isRecording && "cursor-not-allowed opacity-60"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
                    step.isComplete
                      ? "bg-emerald-700 text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-foreground/20 text-muted-foreground"
                  )}
                >
                  {step.isComplete ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span>
                      {step.id === "summary"
                        ? "✓"
                        : step.id.replace("part", "")}
                    </span>
                  )}
                </div>

                <div className="truncate">
                  <div
                    className={cn(
                      "text-xs font-semibold truncate",
                      isActive
                        ? "text-foreground font-bold"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </div>
                  <div className="text-[10px] text-foreground/80 font-medium truncate hidden sm:block">
                    {step.sublabel}
                  </div>
                </div>
              </div>

              <Badge
                variant={step.isComplete ? "default" : "secondary"}
                className={cn(
                  "text-[10px] font-mono h-5 px-1.5 shrink-0 ml-1.5",
                  step.isComplete &&
                    "bg-emerald-700 hover:bg-emerald-800 text-white"
                )}
              >
                {step.badgeText}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
