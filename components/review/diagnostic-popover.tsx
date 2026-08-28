"use client";

import React, { useEffect, useRef, useState } from "react";
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
  Edit3,
  Save,
  Tag,
} from "lucide-react";
import {
  CRITERION_META,
  SEVERITY_META,
  CATEGORY_PRESETS,
  type ReviewAnnotation,
  type ErrorSeverity,
} from "./types";

interface DiagnosticPopoverFormProps {
  annotation: ReviewAnnotation;
  onSave: (updated: ReviewAnnotation) => void;
  onCancel: () => void;
}

function DiagnosticPopoverForm({
  annotation,
  onSave,
  onCancel,
}: DiagnosticPopoverFormProps) {
  const explanationInputRef = useRef<HTMLTextAreaElement>(null);
  const [draftCategory, setDraftCategory] = useState<string>(
    annotation.category || ""
  );
  const [draftExplanation, setDraftExplanation] = useState<string>(
    annotation.explanation || ""
  );
  const [draftSuggestedCorrection, setDraftSuggestedCorrection] =
    useState<string>(annotation.suggestedCorrection || "");
  const [draftSeverity, setDraftSeverity] = useState<ErrorSeverity>(
    annotation.severity || "minor_slip"
  );

  const categoryPresets = CATEGORY_PRESETS[annotation.criterion] || [];

  const handleSave = () => {
    const updated: ReviewAnnotation = {
      ...annotation,
      category: draftCategory.trim() || undefined,
      explanation: draftExplanation.trim(),
      suggestedCorrection: draftSuggestedCorrection.trim() || undefined,
      severity: draftSeverity,
      source: "teacher",
    };
    onSave(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="mt-3 space-y-3" onKeyDown={handleKeyDown}>
      {/* Severity Selector */}
      <div>
        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
          Mức độ nghiêm trọng:
        </label>
        <div className="grid grid-cols-3 gap-1 text-xs">
          {(
            [
              "minor_slip",
              "systematic_error",
              "impedes_communication",
            ] as ErrorSeverity[]
          ).map((sev) => {
            const isSelected = draftSeverity === sev;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setDraftSeverity(sev)}
                className={cn(
                  "rounded border px-1.5 py-1 text-[11px] font-medium transition-colors text-center",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
              >
                {sev === "minor_slip"
                  ? "Lỗi nhẹ"
                  : sev === "systematic_error"
                    ? "Lỗi lặp lại"
                    : "Nghiêm trọng"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Presets Chips */}
      <div>
        <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1">
          <Tag className="h-3 w-3" /> Danh mục lỗi (Chọn nhanh hoặc gõ):
        </label>
        <div className="flex flex-wrap gap-1 mb-1.5 max-h-20 overflow-y-auto">
          {categoryPresets.map((preset) => {
            const isSelected = draftCategory === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setDraftCategory(preset)}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] transition-colors border text-left",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-background hover:bg-muted text-muted-foreground border-border"
                )}
                data-testid={`preset-chip-${preset.slice(0, 10)}`}
              >
                {preset}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={draftCategory}
          onChange={(e) => setDraftCategory(e.target.value)}
          placeholder="Hoặc tự gõ danh mục lỗi..."
          className="w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid="annotation-category-input"
        />
      </div>

      {/* Suggested Correction Input */}
      <div>
        <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1">
          <Sparkles className="h-3 w-3 text-emerald-500" />
          Từ / Cụm từ gợi ý sửa (Tùy chọn):
        </label>
        <input
          type="text"
          value={draftSuggestedCorrection}
          onChange={(e) => setDraftSuggestedCorrection(e.target.value)}
          placeholder="Ví dụ: more impactful in reducing"
          className="w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          data-testid="annotation-correction-input"
        />
      </div>

      {/* Explanation Textarea */}
      <div>
        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
          Lời nhận xét / Hướng dẫn của giáo viên:
        </label>
        <textarea
          ref={explanationInputRef}
          autoFocus
          rows={3}
          value={draftExplanation}
          onChange={(e) => setDraftExplanation(e.target.value)}
          placeholder="Nhập giải thích chẩn đoán, hướng dẫn cách sửa lỗi cho học sinh... (Ctrl + Enter để lưu)"
          className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed"
          data-testid="annotation-explanation-textarea"
        />
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-between border-t pt-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 px-2.5 text-xs text-muted-foreground"
        >
          Hủy
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-1 shadow-xs"
          data-testid="save-annotation-btn"
        >
          <Save className="h-3.5 w-3.5" />
          Lưu nhận xét (Ctrl+Enter)
        </Button>
      </div>
    </div>
  );
}

export interface DiagnosticPopoverProps {
  annotation: ReviewAnnotation | null;
  position: { top: number; left: number } | null;
  open: boolean;
  isCreateMode?: boolean;
  onClose: () => void;
  onApplyCorrection?: (errorId: string) => void;
  onToggleResolved?: (errorId: string) => void;
  onDelete?: (errorId: string) => void;
  onSaveAnnotation?: (updatedAnnotation: ReviewAnnotation) => void;
  editable?: boolean;
  className?: string;
}

export function DiagnosticPopover({
  annotation,
  position,
  open,
  isCreateMode = false,
  onClose,
  onApplyCorrection,
  onToggleResolved,
  onDelete,
  onSaveAnnotation,
  editable = true,
  className,
}: DiagnosticPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState<boolean>(isCreateMode);

  // Close on outside click or Escape
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
  const showEditForm = isEditing || isCreateMode;

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
        "absolute z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-4 text-popover-foreground shadow-2xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-150",
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

          {!showEditForm ? (
            <>
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
            </>
          ) : (
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Edit3 className="h-3 w-3" />
              {isCreateMode ? "Thêm nhận xét mới" : "Chỉnh sửa chẩn đoán"}
            </span>
          )}
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

      {/* Quote Context (Always shown) */}
      {annotation.originalQuote && (
        <div className="mt-2.5 rounded bg-muted/40 px-2.5 py-1.5 text-xs font-mono text-muted-foreground flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground shrink-0">
            Trích đoạn:
          </span>
          <span className="font-semibold text-foreground truncate">
            &quot;{annotation.originalQuote}&quot;
          </span>
        </div>
      )}

      {/* ── MODE 1: EDIT / CREATE FORM ────────────────────────── */}
      {showEditForm ? (
        <DiagnosticPopoverForm
          key={`${annotation.errorId}-${isCreateMode ? "create" : "edit"}`}
          annotation={annotation}
          onSave={(updated) => {
            onSaveAnnotation?.(updated);
            setIsEditing(false);
          }}
          onCancel={() => {
            if (isCreateMode) {
              onClose();
            } else {
              setIsEditing(false);
            }
          }}
        />
      ) : (
        /* ── MODE 2: VIEW DIAGNOSTIC MODE ────────────────────── */
        <>
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
                  className="mt-2.5 w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-7 gap-1.5 shadow-xs"
                  data-testid={`apply-correction-btn-${annotation.errorId}`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Apply gợi ý
                </Button>
              )}
            </div>
          )}

          {/* Action Toolbar */}
          {editable && (
            <div className="mt-4 flex items-center justify-between border-t pt-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                {/* Edit Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-7 px-2 text-xs font-normal gap-1"
                  data-testid={`edit-annotation-btn-${annotation.errorId}`}
                >
                  <Edit3 className="h-3 w-3" />
                  Sửa
                </Button>

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
        </>
      )}
    </div>
  );
}
