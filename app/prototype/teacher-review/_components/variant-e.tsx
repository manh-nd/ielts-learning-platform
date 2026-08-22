"use client";

import * as React from "react";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  Check,
  Send,
  Sparkles,
  CheckCircle2,
  X,
  CornerDownRight,
  Bot,
} from "lucide-react";

import {
  MOCK_STUDENT,
  MOCK_HOMEWORK,
  MOCK_ESSAY,
  MOCK_ESSAY_WORD_COUNT,
  MOCK_AI_SCORES,
  MOCK_AI_OVERALL,
  MOCK_AI_FEEDBACK,
  MOCK_AI_ERRORS,
  CRITERION_META,
  CRITERIA_ORDER,
  BAND_OPTIONS,
  calculateOverallBand,
  type AssessmentStatus,
  type Criterion,
} from "../_data/mock";

// ── Helpers ─────────────────────────────────────────────────────

function BandPill({ value }: { value: number }) {
  const color =
    value >= 7.0
      ? "text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:ring-emerald-800"
      : value >= 5.5
        ? "text-amber-700 bg-amber-50 ring-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:ring-amber-800"
        : "text-red-700 bg-red-50 ring-red-200 dark:text-red-300 dark:bg-red-950/40 dark:ring-red-800";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1",
        color
      )}
    >
      {value.toFixed(1)}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────

export function VariantE() {
  // State
  const [status, setStatus] = useState<AssessmentStatus>(
    "ai_proposal_available"
  );
  const [teacherScores, setTeacherScores] = useState<Record<Criterion, number>>(
    {
      ...MOCK_AI_SCORES,
    }
  );
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [resolvedErrors, setResolvedErrors] = useState<Set<string>>(new Set());
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
  const [commentPositions, setCommentPositions] = useState<
    Record<string, number>
  >({});

  const pageRef = useRef<HTMLDivElement>(null);
  const annotationRefs = useRef<Record<string, HTMLElement | null>>({});

  // Derived
  const overallBand = useMemo(
    () => calculateOverallBand(teacherScores),
    [teacherScores]
  );

  // Calculate comment positions relative to their inline highlights
  const recalcPositions = useCallback(() => {
    if (!pageRef.current) return;
    const pageRect = pageRef.current.getBoundingClientRect();
    const positions: Record<string, number> = {};
    let lastBottom = 0;

    const sorted = [...MOCK_AI_ERRORS].sort(
      (a, b) => a.offsetStart - b.offsetStart
    );

    sorted.forEach((err) => {
      const el = annotationRefs.current[err.errorId];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const top = rect.top - pageRect.top;
      // Prevent overlap: each card needs ~80px minimum
      const adjusted = Math.max(top, lastBottom + 6);
      positions[err.errorId] = adjusted;
      lastBottom = adjusted + 78;
    });

    setCommentPositions(positions);
  }, []);

  useEffect(() => {
    recalcPositions();
    const observer = new ResizeObserver(recalcPositions);
    if (pageRef.current) observer.observe(pageRef.current);
    window.addEventListener("scroll", recalcPositions, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", recalcPositions, true);
    };
  }, [recalcPositions, resolvedErrors]);

  // Handlers
  const handleResolve = useCallback((errorId: string) => {
    setResolvedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(errorId)) next.delete(errorId);
      else next.add(errorId);
      return next;
    });
  }, []);

  const handleApprove = useCallback(() => {
    if (status !== "approved" && status !== "published") setStatus("approved");
  }, [status]);

  const handlePublish = useCallback(() => setStatus("published"), []);

  // ── Render essay with highlights ──────────────────────────────

  const renderedEssay = useMemo(() => {
    const text = MOCK_ESSAY;
    const sorted = [...MOCK_AI_ERRORS].sort(
      (a, b) => a.offsetStart - b.offsetStart
    );

    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sorted.forEach((err) => {
      const start = Math.max(err.offsetStart, lastEnd);
      const end = err.offsetEnd;
      if (start >= end) return;

      if (start > lastEnd) elements.push(text.slice(lastEnd, start));

      const isResolved = resolvedErrors.has(err.errorId);
      const isActive = activeAnnotation === err.errorId;

      elements.push(
        <span
          key={err.errorId}
          ref={(el) => {
            annotationRefs.current[err.errorId] = el;
          }}
          onClick={() =>
            setActiveAnnotation((p) => (p === err.errorId ? null : err.errorId))
          }
          className={cn(
            "cursor-pointer transition-colors duration-100",
            isResolved
              ? "bg-transparent"
              : isActive
                ? "bg-yellow-200/80 dark:bg-yellow-700/40"
                : "bg-yellow-100/70 dark:bg-yellow-800/25 hover:bg-yellow-200/80 dark:hover:bg-yellow-700/40"
          )}
        >
          {text.slice(start, end)}
        </span>
      );
      lastEnd = end;
    });

    if (lastEnd < text.length) elements.push(text.slice(lastEnd));

    // Split into paragraphs
    const paragraphs: React.ReactNode[] = [];
    let current: React.ReactNode[] = [];

    elements.forEach((el, index) => {
      if (typeof el === "string") {
        const parts = el.split("\n\n");
        parts.forEach((part, pIndex) => {
          if (pIndex > 0) {
            paragraphs.push(
              <p
                key={`p-${paragraphs.length}`}
                className="mb-5 text-[14.5px] leading-[1.75] text-neutral-800 dark:text-neutral-200"
              >
                {current}
              </p>
            );
            current = [];
          }
          if (part)
            current.push(
              <React.Fragment key={`t-${index}-${pIndex}`}>
                {part}
              </React.Fragment>
            );
        });
      } else {
        current.push(el);
      }
    });

    if (current.length > 0) {
      paragraphs.push(
        <p
          key={`p-${paragraphs.length}`}
          className="mb-5 text-[14.5px] leading-[1.75] text-neutral-800 dark:text-neutral-200"
        >
          {current}
        </p>
      );
    }

    return paragraphs;
  }, [resolvedErrors, activeAnnotation]);

  // Sort errors for margin rendering
  const sortedErrors = useMemo(
    () => [...MOCK_AI_ERRORS].sort((a, b) => a.offsetStart - b.offsetStart),
    []
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-neutral-100 dark:bg-neutral-900">
      {/* ── Google Docs-style toolbar ──────────────────────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
              <path d="M14 2v6h6" opacity="0.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {MOCK_HOMEWORK.title} — {MOCK_STUDENT.name}
            </h1>
            <p className="text-[10px] text-neutral-500">
              {MOCK_STUDENT.class} · {MOCK_ESSAY_WORD_COUNT} words ·{" "}
              {MOCK_HOMEWORK.taskType}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Score toolbar pills */}
          <div className="flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-1 py-0.5 dark:border-neutral-700 dark:bg-neutral-800">
            {CRITERIA_ORDER.map((c) => {
              const meta = CRITERION_META[c];
              return (
                <div key={c} className="flex items-center gap-1 px-1.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      `bg-${meta.color}-500`
                    )}
                  />
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {meta.short}
                  </span>
                  <Select
                    value={teacherScores[c].toString()}
                    onValueChange={(v) => {
                      if (v !== null)
                        setTeacherScores((prev) => ({
                          ...prev,
                          [c]: parseFloat(v),
                        }));
                    }}
                  >
                    <SelectTrigger className="h-5 w-12 border-none bg-transparent p-0 text-[11px] font-semibold shadow-none focus-visible:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BAND_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s.toString()}>
                          {s.toFixed(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            <Separator orientation="vertical" className="h-4 mx-1" />
            <div className="flex items-center gap-1 px-1.5">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                Overall
              </span>
              <BandPill value={overallBand} />
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleApprove}
            disabled={status === "approved" || status === "published"}
            className="text-xs"
          >
            {status === "approved" || status === "published" ? (
              <Check className="mr-1 h-3 w-3 text-emerald-600" />
            ) : null}
            {status === "approved" || status === "published"
              ? "Approved"
              : "Approve"}
          </Button>

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  disabled={status !== "approved"}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
                />
              }
            >
              <Send className="mr-1 h-3 w-3" />
              Publish
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Công bố kết quả?</DialogTitle>
                <DialogDescription>
                  Band {overallBand.toFixed(1)} sẽ được gửi cho{" "}
                  {MOCK_STUDENT.name}. Không thể hoàn tác.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Hủy
                </DialogClose>
                <DialogClose render={<Button onClick={handlePublish} />}>
                  Công bố
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* ── Canvas area (page on grey background) ────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative mx-auto max-w-[1100px] py-8">
          {/* The "page" */}
          <div className="relative flex">
            {/* Page content */}
            <div
              ref={pageRef}
              className="relative mx-auto w-[680px] shrink-0 rounded-sm bg-white px-16 py-12 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:bg-neutral-950 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.05)]"
            >
              {/* Task prompt */}
              <div className="mb-6 rounded-md bg-neutral-50 px-4 py-3 dark:bg-neutral-900">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                  PROMPT
                </p>
                <p className="text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed italic">
                  {MOCK_HOMEWORK.prompt}
                </p>
              </div>

              <Separator className="mb-6 opacity-30" />

              {/* Essay body */}
              <article className="selection:bg-blue-100 dark:selection:bg-blue-900/40">
                {renderedEssay}
              </article>

              {/* General feedback area */}
              <div className="mt-8 border-t border-dashed border-neutral-200 pt-6 dark:border-neutral-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                    <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300">
                      T
                    </span>
                  </div>
                  <span className="text-xs font-medium text-neutral-500">
                    Teacher Feedback
                  </span>
                </div>
                <Textarea
                  value={teacherFeedback}
                  onChange={(e) => setTeacherFeedback(e.target.value)}
                  placeholder="Write overall feedback for the student…"
                  className="min-h-[80px] resize-none border-none bg-transparent p-0 text-[13px] leading-relaxed text-neutral-700 shadow-none focus-visible:ring-0 placeholder:text-neutral-400 dark:text-neutral-300 dark:placeholder:text-neutral-600"
                />
              </div>

              {/* AI summary */}
              <div className="mt-6 rounded-md bg-blue-50/60 px-4 py-3 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                    AI Examiner Summary
                  </span>
                </div>
                <p className="text-[12px] text-blue-900/70 dark:text-blue-200/70 leading-relaxed">
                  {MOCK_AI_FEEDBACK.examiner_summary}
                </p>
              </div>
            </div>

            {/* ── Right margin: Comment cards ─────────────── */}
            <div className="relative w-[280px] shrink-0 ml-3">
              {sortedErrors.map((err) => {
                const meta = CRITERION_META[err.criterion];
                const isResolved = resolvedErrors.has(err.errorId);
                const isActive = activeAnnotation === err.errorId;
                const top = commentPositions[err.errorId];

                if (top === undefined) return null;

                return (
                  <div
                    key={err.errorId}
                    className={cn(
                      "absolute left-0 right-0 transition-all duration-200",
                      isResolved && !isActive && "opacity-40"
                    )}
                    style={{ top }}
                  >
                    {/* Connecting line */}
                    <div
                      className={cn(
                        "absolute -left-3 top-3 h-px w-3",
                        isActive
                          ? "bg-blue-400"
                          : "bg-neutral-300 dark:bg-neutral-700"
                      )}
                    />

                    {/* Comment card */}
                    <div
                      onClick={() =>
                        setActiveAnnotation((p) =>
                          p === err.errorId ? null : err.errorId
                        )
                      }
                      className={cn(
                        "group cursor-pointer rounded-lg border px-3 py-2 transition-all duration-100",
                        isActive
                          ? "border-blue-300 bg-white shadow-sm dark:border-blue-700 dark:bg-neutral-950"
                          : "border-transparent bg-white/80 hover:border-neutral-200 hover:shadow-sm dark:bg-neutral-950/80 dark:hover:border-neutral-700"
                      )}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
                            <Bot className="h-3 w-3 text-violet-700 dark:text-violet-300" />
                          </div>
                          <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                            AI
                          </span>
                          <span
                            className={cn(
                              "rounded px-1 py-px text-[9px] font-medium",
                              meta.bgLight,
                              meta.bgDark
                            )}
                          >
                            {meta.short}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(err.errorId);
                          }}
                          className={cn(
                            "rounded-full p-0.5 transition-all",
                            isResolved
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400",
                            !isResolved &&
                              !isActive &&
                              "opacity-0 group-hover:opacity-100"
                          )}
                          title={isResolved ? "Unresolve" : "Resolve"}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Quote */}
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-1 line-clamp-1 italic">
                        &ldquo;{err.originalQuote}&rdquo;
                      </p>

                      {/* Body */}
                      <p
                        className={cn(
                          "text-[12px] text-neutral-700 dark:text-neutral-300 leading-relaxed",
                          !isActive && "line-clamp-2"
                        )}
                      >
                        {err.explanation}
                      </p>

                      {/* Expanded: suggestion */}
                      {isActive && err.suggestedCorrection && (
                        <div className="mt-2 flex items-start gap-1.5 rounded bg-emerald-50 px-2 py-1.5 dark:bg-emerald-950/30">
                          <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            {err.suggestedCorrection}
                          </span>
                        </div>
                      )}

                      {/* Expanded: actions */}
                      {isActive && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-[10px] h-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolve(err.errorId);
                            }}
                          >
                            {isResolved ? "Reopen" : "Resolve"}
                          </Button>
                          <Badge variant="secondary" className="text-[9px] h-4">
                            {err.category.split(" / ")[0]}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom spacer */}
          <div className="h-24" />
        </div>
      </div>
    </div>
  );
}
