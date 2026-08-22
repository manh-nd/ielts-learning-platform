"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Check,
  CheckCircle2,
  Trash2,
  X,
  Bot,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import { CRITERION_META, SEVERITY_META, type ReviewAnnotation } from "./types";

export interface DiagnosticPopoverProps {
  annotation: ReviewAnnotation | null;
  position: { top: number; left: number } | null;
  open: boolean;
  onClose: () => void;
  onApplyCorrection?: (errorId: string) => void;
  onToggleResolved?: (errorId: string) => void;
  onDelete?: (errorId: string) => void;
  editable?: boolean;
  className?: string;
}

export function DiagnosticPopover({
  annotation,
  position,
  open,
  onClose,
  onApplyCorrection,
  onToggleResolved,
  onDelete,
  editable = true,
  className,
}: DiagnosticPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !annotation || !position) {
    return null;
  }

  const criterionMeta = CRITERION_META[annotation.criterion];
  const severityMeta =
    SEVERITY_META[annotation.severity] || SEVERITY_META.minor_slip;
  const isAI = annotation.source === "ai";
  const hasCorrection = Boolean(
    annotation.suggestedCorrection &&
    annotation.suggestedCorrection.trim().length > 0
  );

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Chẩn đoán lỗi ${annotation.errorId}`}
      data-testid={`diagnostic-popover-${annotation.errorId}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className={cn(
        "absolute z-50 w-84 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-150",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold shadow-xs",
              criterionMeta.badgeBg
            )}
            data-testid="diagnostic-criterion-badge"
          >
            {criterionMeta.short} · {criterionMeta.label}
          </span>

          <Badge
            variant={severityMeta.badgeVariant}
            className="text-[11px] font-normal"
          >
            {severityMeta.label}
          </Badge>

          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
              isAI
                ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
            )}
          >
            {isAI ? (
              <>
                <Bot className="h-3 w-3" /> Đề xuất AI
              </>
            ) : (
              <>
                <UserCheck className="h-3 w-3" /> Giáo viên
              </>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Đóng chẩn đoán"
          data-testid="close-diagnostic-btn"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category & Status */}
      {annotation.category && (
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            {annotation.category}
          </span>
          {annotation.isResolved && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
              data-testid="resolved-badge"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Đã sửa
            </span>
          )}
        </div>
      )}

      {/* Explanation */}
      <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
        <p data-testid="diagnostic-explanation">{annotation.explanation}</p>
      </div>

      {/* Suggested Correction Section */}
      {hasCorrection && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-medium text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Gợi ý thay thế:
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            {annotation.originalQuote && (
              <>
                <span className="line-through text-muted-foreground truncate max-w-[110px]">
                  {annotation.originalQuote}
                </span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
              </>
            )}
            <span
              className="font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded"
              data-testid="suggested-correction-text"
            >
              {annotation.suggestedCorrection}
            </span>
          </div>

          {editable && onApplyCorrection && !annotation.isResolved && (
            <Button
              type="button"
              size="sm"
              onClick={() => onApplyCorrection(annotation.errorId)}
              className="mt-2.5 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-7 gap-1.5 shadow-xs"
              data-testid={`apply-correction-btn-${annotation.errorId}`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Áp dụng gợi ý (1-Click)
            </Button>
          )}
        </div>
      )}

      {/* Action Toolbar */}
      {editable && (
        <div className="mt-3.5 flex items-center justify-between border-t pt-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            {onToggleResolved && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggleResolved(annotation.errorId)}
                className={cn(
                  "h-7 px-2 text-xs font-normal",
                  annotation.isResolved
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                )}
                data-testid={`toggle-resolve-btn-${annotation.errorId}`}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                {annotation.isResolved ? "Bỏ đánh dấu" : "Đã sửa xong"}
              </Button>
            )}
          </div>

          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(annotation.errorId)}
              className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 font-normal"
              data-testid={`delete-annotation-btn-${annotation.errorId}`}
              title="Bác bỏ hoặc gỡ lỗi này"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {isAI ? "Bác bỏ" : "Xóa"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
