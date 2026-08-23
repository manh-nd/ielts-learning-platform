"use client";

import React, { useMemo } from "react";
import { IeltsTaskType, SaveStatus } from "./types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface WritingStatsBarProps {
  taskType: IeltsTaskType;
  wordCount: number;
  paragraphCount?: number;
  sentenceCount?: number;
  minWords?: number;
  targetWordsMax?: number;
  saveStatus?: SaveStatus;
  lastSaved?: Date | null;
  isSubmitting?: boolean;
  onSubmit: () => void;
  className?: string;
}

export function WritingStatsBar({
  taskType,
  wordCount,
  paragraphCount = 1,
  sentenceCount = 0,
  minWords = taskType === "TASK_2" ? 250 : 150,
  targetWordsMax = taskType === "TASK_2" ? 350 : 220,
  saveStatus = "idle",
  lastSaved,
  isSubmitting = false,
  onSubmit,
  className,
}: WritingStatsBarProps) {
  const wordProgressPercent = Math.min(
    100,
    Math.round((wordCount / minWords) * 100)
  );

  const wordCountBadge = useMemo(() => {
    if (wordCount === 0) {
      return {
        label: `Mục tiêu: ${minWords} từ`,
        color: "bg-muted text-muted-foreground border-border",
        status: "empty",
      };
    }
    if (wordCount < minWords) {
      const remaining = minWords - wordCount;
      return {
        label: `${wordCount} / ${minWords} từ (Thiếu ${remaining} từ)`,
        color:
          "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700",
        status: "underlength",
      };
    }
    if (wordCount <= targetWordsMax) {
      return {
        label: `${wordCount} từ (Độ dài chuẩn IELTS)`,
        color:
          "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700",
        status: "optimal",
      };
    }
    return {
      label: `${wordCount} từ (Độ dài mở rộng)`,
      color:
        "bg-blue-50 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700",
      status: "extended",
    };
  }, [wordCount, minWords, targetWordsMax]);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs",
        className
      )}
      data-testid="writing-stats-bar"
    >
      {/* Left: Word count badge and progress */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "px-3 py-1 rounded-md border font-semibold flex items-center gap-1.5 transition-colors",
            wordCountBadge.color
          )}
          data-testid="word-count-badge"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{wordCountBadge.label}</span>
        </div>

        <div className="w-28 flex items-center gap-2">
          <Progress
            value={wordProgressPercent}
            className="h-2 flex-1"
            data-testid="word-count-progress"
          />
          <span className="text-[10px] text-muted-foreground font-mono">
            {wordProgressPercent}%
          </span>
        </div>

        {/* Text Analytics: Paragraphs & Sentences */}
        <div
          className="hidden md:flex items-center gap-3 pl-3 border-l text-muted-foreground"
          data-testid="text-analytics"
        >
          <div className="flex items-center gap-1" title="Số đoạn văn">
            <BarChart2 className="h-3.5 w-3.5" />
            <span>
              <strong>{paragraphCount}</strong> đoạn
            </span>
          </div>
          <div className="flex items-center gap-1" title="Số câu">
            <span>
              <strong>{sentenceCount}</strong> câu
            </span>
          </div>
        </div>
      </div>

      {/* Right: Auto-save status and Submit action */}
      <div className="flex items-center gap-4">
        {/* Auto-save Status */}
        <div
          className="flex items-center gap-1.5 text-muted-foreground"
          data-testid="autosave-status"
        >
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Đang lưu nháp...</span>
            </>
          )}
          {(saveStatus === "saved" || (saveStatus === "idle" && lastSaved)) && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>
                Đã lưu nháp{" "}
                {lastSaved
                  ? lastSaved.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : ""}
              </span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive font-medium">Lưu nháp lỗi</span>
            </>
          )}
        </div>

        {/* Submit Button */}
        <Button
          onClick={onSubmit}
          disabled={wordCount < 10 || isSubmitting}
          className="gap-2 h-9 px-4 font-semibold shadow-sm"
          data-testid="submit-essay-btn"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang nộp bài...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Nộp bài chấm AI</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
