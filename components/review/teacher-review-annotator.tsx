"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { BubbleMenuPlugin } from "@tiptap/extension-bubble-menu";
import { cn } from "@/lib/utils";
import {
  CriterionAnnotationMark,
  type CriterionAnnotationAttributes,
} from "./extensions/criterion-annotation";
import { DiagnosticPopover } from "./diagnostic-popover";
import {
  CRITERION_META,
  CRITERIA_ORDER,
  type Criterion,
  type ReviewAnnotation,
} from "./types";
import { Button } from "@/components/ui/button";
import {
  Filter,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Undo2,
  Redo2,
} from "lucide-react";

export interface TeacherReviewAnnotatorProps {
  initialContent?: string;
  initialAnnotations?: ReviewAnnotation[];
  editable?: boolean;
  activeFilter?: Criterion | "ALL";
  showFilterBar?: boolean;
  showStatsBar?: boolean;
  minHeight?: string;
  className?: string;
  onContentChange?: (html: string, text: string) => void;
  onAnnotationsChange?: (annotations: ReviewAnnotation[]) => void;
  onApplyCorrection?: (
    errorId: string,
    updatedAnnotation: ReviewAnnotation
  ) => void;
  "data-testid"?: string;
}

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function TeacherReviewAnnotator({
  initialContent = "",
  initialAnnotations = [],
  editable = true,
  activeFilter: controlledFilter,
  showFilterBar = true,
  showStatsBar = true,
  minHeight = "min-h-[420px]",
  className,
  onContentChange,
  onAnnotationsChange,
  onApplyCorrection,
  "data-testid": testId = "teacher-review-annotator",
}: TeacherReviewAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleMenuRef = useRef<HTMLDivElement>(null);

  const [annotations, setAnnotations] =
    useState<ReviewAnnotation[]>(initialAnnotations);
  const [internalFilter, setInternalFilter] = useState<Criterion | "ALL">(
    "ALL"
  );
  const activeFilter = controlledFilter ?? internalFilter;

  const [activeErrorId, setActiveErrorId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState<boolean>(false);
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const isMounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const activeAnnotation =
    annotations.find((a) => a.errorId === activeErrorId) ?? null;

  // Editor initialization
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    content: initialContent,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      CharacterCount.configure(),
      Placeholder.configure({
        placeholder: "Nội dung bài làm của học sinh...",
      }),
      CriterionAnnotationMark,
    ],
    editorProps: {
      attributes: {
        class: cn(
          "tiptap prose prose-neutral dark:prose-invert max-w-none focus:outline-none text-base leading-relaxed p-6 selection:bg-primary/20",
          minHeight
        ),
        "data-testid": "tiptap-editor-content",
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        const markEl =
          target.closest("mark.criterion-mark") ||
          target.closest("mark[data-error-id]");
        if (markEl && containerRef.current) {
          const errorId = markEl.getAttribute("data-error-id");
          if (errorId) {
            const rect = markEl.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();

            setPopoverPosition({
              top: rect.bottom - containerRect.top + 8,
              left: Math.max(
                12,
                Math.min(
                  rect.left - containerRect.left,
                  containerRect.width - 390
                )
              ),
            });
            setIsCreateMode(false);
            setActiveErrorId(errorId);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      onContentChange?.(html, text);
    },
  });

  // Apply filter class to container or individual marks
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const allMarks = container.querySelectorAll("mark.criterion-mark");
    allMarks.forEach((el) => {
      const markCrit = el.getAttribute("data-criterion");
      if (activeFilter === "ALL") {
        el.classList.remove("is-filtered-out");
      } else {
        if (markCrit === activeFilter) {
          el.classList.remove("is-filtered-out");
        } else {
          el.classList.add("is-filtered-out");
        }
      }
    });

    if (activeFilter !== "ALL") {
      container.classList.add("filter-active");
    } else {
      container.classList.remove("filter-active");
    }
  }, [activeFilter, annotations, editor]);

  // Setup Bubble Menu for Teacher manual annotations
  useEffect(() => {
    if (!editor || !bubbleMenuRef.current || !editable) return;

    const plugin = BubbleMenuPlugin({
      pluginKey: "teacherBubbleMenuPlugin",
      editor,
      element: bubbleMenuRef.current,
      shouldShow: ({ state, from, to }) => {
        const { doc, selection } = state;
        const { empty } = selection;
        const isEmptyDoc =
          doc.textContent.trim().length === 0 ||
          (doc.firstChild?.isText && doc.firstChild.text?.trim().length === 0);

        if (empty || isEmptyDoc || from === to || !editor.isEditable) {
          return false;
        }
        return true;
      },
      options: {
        placement: "top",
        offset: 8,
      },
    });

    editor.registerPlugin(plugin);

    return () => {
      editor.unregisterPlugin("teacherBubbleMenuPlugin");
    };
  }, [editor, editable]);

  // Handler: 1-Click Apply Correction
  const handleApplyCorrection = useCallback(
    (errorId: string) => {
      if (!editor) return;

      editor.commands.applyAnnotationCorrection(errorId);

      const target = annotations.find((a) => a.errorId === errorId);
      const updatedList = annotations.map((a) =>
        a.errorId === errorId ? { ...a, isResolved: true } : a
      );

      setAnnotations(updatedList);
      onAnnotationsChange?.(updatedList);

      if (target) {
        onApplyCorrection?.(errorId, { ...target, isResolved: true });
      }

      setActiveErrorId(null);
      setPopoverPosition(null);
    },
    [editor, annotations, onAnnotationsChange, onApplyCorrection]
  );

  // Handler: Toggle Resolved
  const handleToggleResolved = useCallback(
    (errorId: string) => {
      if (!editor) return;

      const target = annotations.find((a) => a.errorId === errorId);
      const nextResolved = target ? !target.isResolved : true;

      editor.commands.toggleAnnotationResolved(errorId, nextResolved);

      const updatedList = annotations.map((a) =>
        a.errorId === errorId ? { ...a, isResolved: nextResolved } : a
      );

      setAnnotations(updatedList);
      onAnnotationsChange?.(updatedList);
    },
    [editor, annotations, onAnnotationsChange]
  );

  // Handler: Delete/Dismiss Annotation
  const handleDeleteAnnotation = useCallback(
    (errorId: string) => {
      if (!editor) return;

      editor.commands.unsetCriterionAnnotation(errorId);

      const updatedList = annotations.filter((a) => a.errorId !== errorId);
      setAnnotations(updatedList);
      onAnnotationsChange?.(updatedList);

      setActiveErrorId(null);
      setPopoverPosition(null);
    },
    [editor, annotations, onAnnotationsChange]
  );

  // Handler: Teacher creates annotation from BubbleMenu
  const handleCreateAnnotation = useCallback(
    (criterion: Criterion) => {
      if (!editor) return;

      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, " ");
      const newErrorId = `teacher-err-${Date.now()}`;

      const newAnnotation: ReviewAnnotation = {
        errorId: newErrorId,
        criterion,
        category: "",
        severity: "minor_slip",
        explanation: "",
        suggestedCorrection: "",
        originalQuote: selectedText,
        source: "teacher",
        isResolved: false,
        createdAt: new Date().toISOString(),
      };

      const attrs: CriterionAnnotationAttributes = {
        errorId: newErrorId,
        criterion,
        category: "",
        severity: "minor_slip",
        explanation: "",
        suggestedCorrection: "",
        source: "teacher",
        isResolved: false,
      };

      editor.chain().focus().setCriterionAnnotation(attrs).run();

      const updatedList = [...annotations, newAnnotation];
      setAnnotations(updatedList);
      onAnnotationsChange?.(updatedList);

      // Calculate popover position from selection coordinates
      const startPos = editor.view.coordsAtPos(from);
      const endPos = editor.view.coordsAtPos(to);
      const containerRect = containerRef.current?.getBoundingClientRect() || {
        top: 0,
        left: 0,
        width: 600,
      };

      setPopoverPosition({
        top: endPos.bottom - containerRect.top + 8,
        left: Math.max(
          12,
          Math.min(
            startPos.left - containerRect.left,
            containerRect.width - 390
          )
        ),
      });
      setActiveErrorId(newErrorId);
      setIsCreateMode(true);
    },
    [editor, annotations, onAnnotationsChange]
  );

  // Handler: Save / Update Annotation from Popover (Create or Edit Mode)
  const handleSaveAnnotation = useCallback(
    (updated: ReviewAnnotation) => {
      if (!editor) return;

      editor.commands.updateCriterionAnnotation(updated.errorId, {
        category: updated.category,
        explanation: updated.explanation,
        suggestedCorrection: updated.suggestedCorrection,
        severity: updated.severity,
        source: updated.source,
      });

      const updatedList = annotations.map((a) =>
        a.errorId === updated.errorId ? updated : a
      );
      setAnnotations(updatedList);
      onAnnotationsChange?.(updatedList);
      setIsCreateMode(false);
    },
    [editor, annotations, onAnnotationsChange]
  );

  // Stats calculation
  const totalCount = annotations.length;
  const resolvedCount = annotations.filter((a) => a.isResolved).length;
  const unresolvedCount = totalCount - resolvedCount;
  const countsByCriterion = CRITERIA_ORDER.reduce(
    (acc, crit) => {
      acc[crit] = annotations.filter((a) => a.criterion === crit).length;
      return acc;
    },
    {} as Record<Criterion, number>
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-xl border bg-background text-foreground shadow-xs transition-all duration-200",
        className
      )}
      data-testid={testId}
    >
      {/* Top Filter Bar */}
      {showFilterBar && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 font-medium text-muted-foreground mr-1">
              <Filter className="h-3.5 w-3.5" /> Lọc tiêu chí:
            </span>

            <Button
              type="button"
              variant={activeFilter === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setInternalFilter("ALL")}
              className="h-6 px-2 text-xs rounded-full"
              data-testid="filter-all-btn"
            >
              Tất cả ({totalCount})
            </Button>

            {CRITERIA_ORDER.map((crit) => {
              const meta = CRITERION_META[crit];
              const count = countsByCriterion[crit] || 0;
              const isSelected = activeFilter === crit;

              return (
                <Button
                  key={crit}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInternalFilter(crit)}
                  className={cn(
                    "h-6 px-2 text-xs rounded-full transition-all",
                    isSelected
                      ? meta.badgeBg
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  data-testid={`filter-${meta.short.toLowerCase()}-btn`}
                >
                  <span
                    className={cn(
                      "mr-1 inline-block h-1.5 w-1.5 rounded-full",
                      crit === "TASK_ACHIEVEMENT" && "bg-emerald-500",
                      crit === "COHERENCE_COHESION" && "bg-amber-500",
                      crit === "LEXICAL_RESOURCE" && "bg-blue-500",
                      crit === "GRAMMATICAL_RANGE_ACCURACY" && "bg-rose-500"
                    )}
                  />
                  {meta.short} ({count})
                </Button>
              );
            })}
          </div>

          {/* Quick Undo / Redo */}
          {editable && editor && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Hoàn tác (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Làm lại (Ctrl+Y)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Floating Bubble Menu when Teacher selects text */}
      {editable && isMounted && (
        <div
          ref={bubbleMenuRef}
          data-testid="teacher-bubble-menu"
          style={{ visibility: "hidden", position: "absolute" }}
          className="z-50 flex items-center gap-1 rounded-lg border bg-popover/95 p-1.5 text-popover-foreground shadow-lg backdrop-blur-sm"
        >
          <span className="text-[10px] font-medium text-muted-foreground px-1.5 flex items-center gap-1 border-r mr-0.5">
            <PlusCircle className="h-3 w-3" /> Gắn lỗi:
          </span>

          {CRITERIA_ORDER.map((crit) => {
            const meta = CRITERION_META[crit];
            return (
              <button
                key={crit}
                type="button"
                onClick={() => handleCreateAnnotation(crit)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium transition-colors hover:brightness-110 shadow-2xs",
                  meta.badgeBg
                )}
                data-testid={`bubble-add-${meta.short.toLowerCase()}-btn`}
                title={`Gán lỗi tiêu chí ${meta.label}`}
              >
                +{meta.short}
              </button>
            );
          })}
        </div>
      )}

      {/* Tiptap Editor Content */}
      <EditorContent editor={editor} />

      {/* Diagnostic Popover */}
      <DiagnosticPopover
        open={Boolean(activeErrorId && popoverPosition)}
        annotation={activeAnnotation}
        position={popoverPosition}
        isCreateMode={isCreateMode}
        onClose={() => {
          setActiveErrorId(null);
          setPopoverPosition(null);
          setIsCreateMode(false);
        }}
        onApplyCorrection={handleApplyCorrection}
        onToggleResolved={handleToggleResolved}
        onDelete={handleDeleteAnnotation}
        onSaveAnnotation={handleSaveAnnotation}
        editable={editable}
      />

      {/* Bottom Summary Bar */}
      {showStatsBar && (
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              Tổng: <strong className="text-foreground">{totalCount}</strong> đề
              xuất
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Đã sửa:{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {resolvedCount}
              </strong>
            </span>
            {unresolvedCount > 0 && (
              <span className="text-muted-foreground">
                (Chưa sửa: {unresolvedCount})
              </span>
            )}
          </div>

          <div className="text-[11px]">
            {editor?.storage.characterCount
              ? `${editor.storage.characterCount.words()} từ · ${editor.storage.characterCount.characters()} ký tự`
              : null}
          </div>
        </div>
      )}
    </div>
  );
}
