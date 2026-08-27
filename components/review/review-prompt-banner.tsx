"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Award,
} from "lucide-react";

export interface ReviewPromptBannerProps {
  title: string;
  taskType: "TASK_1" | "TASK_2";
  targetBand: number;
  promptText: string;
  keyInstructions?: string[];
  onOpenDetailsModal?: () => void;
  defaultExpanded?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function ReviewPromptBanner({
  title,
  taskType,
  targetBand,
  promptText,
  keyInstructions = [],
  onOpenDetailsModal,
  defaultExpanded = false,
  className,
  "data-testid": testId = "review-prompt-banner",
}: ReviewPromptBannerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-xl border bg-card/80 backdrop-blur-xs p-3 sm:p-4 shadow-2xs space-y-2 transition-all",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant={taskType === "TASK_2" ? "default" : "secondary"}
            className="text-[9px] sm:text-[10px] py-0 px-1.5 shrink-0"
          >
            {taskType}
          </Badge>
          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5 truncate">
            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{title}</span>
          </span>
          <Badge
            variant="outline"
            className="text-[9px] sm:text-[10px] text-amber-800 border-amber-400 bg-amber-50/50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-950/40 shrink-0 gap-1 hidden sm:inline-flex"
          >
            <Award className="h-2.5 w-2.5" />
            <span>Mục tiêu: {targetBand.toFixed(1)}</span>
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenDetailsModal && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onOpenDetailsModal}
              className="text-[10px] sm:text-[11px] gap-1 text-primary hover:text-primary px-2"
            >
              <BookOpen className="h-3 w-3" />
              <span className="hidden sm:inline">Xem Rubric & Chi tiết</span>
              <span className="sm:hidden">Chi tiết</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground"
            aria-label={isExpanded ? "Thu gọn đề bài" : "Mở rộng đề bài"}
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Snippet text */}
      {!isExpanded ? (
        <p className="text-xs text-muted-foreground font-serif italic line-clamp-1 leading-relaxed">
          &ldquo;{promptText}&rdquo;
        </p>
      ) : (
        <div className="pt-2 border-t text-xs space-y-2">
          <p className="text-xs font-serif leading-relaxed text-foreground bg-muted/40 p-2.5 rounded-lg border">
            {promptText}
          </p>
          {keyInstructions.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground pt-0.5">
              {keyInstructions.map((ins, idx) => (
                <span key={idx} className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                  <span>{ins}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
