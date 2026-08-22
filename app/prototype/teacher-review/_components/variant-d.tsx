"use client";

import * as React from "react";
import { useState, useMemo, useRef, useCallback } from "react";
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
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  X,
  PanelRightOpen,
  PanelRightClose,
  CornerDownRight,
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
  MOCK_AI_CRITERIA_DETAIL,
  CRITERION_META,
  CRITERIA_ORDER,
  BAND_OPTIONS,
  calculateOverallBand,
  STATUS_LABELS,
  type AssessmentStatus,
  type Criterion,
  type AnnotationError,
} from "../_data/mock";

// ── Helpers ─────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<string, string> = {
  minor_slip: "Minor",
  systematic_error: "Systematic",
  impedes_communication: "Critical",
};

function BandDot({
  value,
  size = "sm",
}: {
  value: number;
  size?: "sm" | "lg";
}) {
  const color =
    value >= 7.0
      ? "bg-emerald-500"
      : value >= 5.5
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-sm",
        color
      )}
    >
      {value.toFixed(1)}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────

export function VariantD() {
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const annotationRefs = useRef<Record<string, HTMLElement | null>>({});
  const sidebarAnnotationRefs = useRef<Record<string, HTMLElement | null>>({});

  // Derived
  const overallBand = useMemo(
    () => calculateOverallBand(teacherScores),
    [teacherScores]
  );
  const unresolvedCount = MOCK_AI_ERRORS.filter(
    (e) => !resolvedErrors.has(e.errorId)
  ).length;

  // Handlers
  const handleResolve = useCallback((errorId: string) => {
    setResolvedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(errorId)) {
        next.delete(errorId);
      } else {
        next.add(errorId);
      }
      return next;
    });
  }, []);

  const handleApprove = useCallback(() => {
    if (status === "ai_proposal_available" || status === "teacher_assessed") {
      setStatus("approved");
    }
  }, [status]);

  const handlePublish = useCallback(() => {
    setStatus("published");
  }, []);

  const handleAnnotationClick = useCallback(
    (errorId: string) => {
      setActiveAnnotation((prev) => (prev === errorId ? null : errorId));
      if (!sidebarOpen) setSidebarOpen(true);

      // Scroll the sidebar comment into view
      requestAnimationFrame(() => {
        sidebarAnnotationRefs.current[errorId]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    },
    [sidebarOpen]
  );

  // ── Render essay with inline highlights ───────────────────────

  const renderedEssay = useMemo(() => {
    const text = MOCK_ESSAY;

    // Sort errors by offset to process in order
    const sorted = [...MOCK_AI_ERRORS].sort(
      (a, b) => a.offsetStart - b.offsetStart
    );

    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sorted.forEach((err) => {
      const start = Math.max(err.offsetStart, lastEnd);
      const end = err.offsetEnd;
      if (start >= end) return;

      // Text before this error
      if (start > lastEnd) {
        elements.push(text.slice(lastEnd, start));
      }

      const meta = CRITERION_META[err.criterion];
      const isResolved = resolvedErrors.has(err.errorId);
      const isActive = activeAnnotation === err.errorId;

      elements.push(
        <span
          key={err.errorId}
          ref={(el) => {
            annotationRefs.current[err.errorId] = el;
          }}
          onClick={() => handleAnnotationClick(err.errorId)}
          className={cn(
            "cursor-pointer relative transition-all duration-150",
            isResolved
              ? "opacity-50 line-through decoration-1"
              : cn(
                  "border-b-2",
                  meta.border,
                  isActive &&
                    cn(meta.bgLight, meta.bgDark, "rounded-sm px-0.5 -mx-0.5")
                )
          )}
        >
          {text.slice(start, end)}
          {!isResolved && (
            <span
              className={cn(
                "absolute -top-1 -right-2 flex h-3 w-3 items-center justify-center rounded-full text-[7px] font-bold text-white",
                `bg-${meta.color}-500`
              )}
            >
              <MessageSquare className="h-2 w-2" />
            </span>
          )}
        </span>
      );

      lastEnd = end;
    });

    // Remaining text
    if (lastEnd < text.length) {
      elements.push(text.slice(lastEnd));
    }

    // Split into paragraphs
    const paragraphs: React.ReactNode[] = [];
    let currentParagraph: React.ReactNode[] = [];

    elements.forEach((el, index) => {
      if (typeof el === "string") {
        const parts = el.split("\n\n");
        parts.forEach((part, pIndex) => {
          if (pIndex > 0) {
            paragraphs.push(
              <p key={`p-${paragraphs.length}`} className="mb-6 leading-[1.8]">
                {currentParagraph}
              </p>
            );
            currentParagraph = [];
          }
          if (part) {
            currentParagraph.push(
              <React.Fragment key={`t-${index}-${pIndex}`}>
                {part}
              </React.Fragment>
            );
          }
        });
      } else {
        currentParagraph.push(el);
      }
    });
    if (currentParagraph.length > 0) {
      paragraphs.push(
        <p key={`p-${paragraphs.length}`} className="mb-6 leading-[1.8]">
          {currentParagraph}
        </p>
      );
    }

    return paragraphs;
  }, [resolvedErrors, activeAnnotation, handleAnnotationClick]);

  // ── Status steps ──────────────────────────────────────────────

  const statusSteps: { key: AssessmentStatus; label: string }[] = [
    { key: "ai_proposal_available", label: "AI Reviewed" },
    { key: "teacher_assessed", label: "Assessed" },
    { key: "approved", label: "Approved" },
    { key: "published", label: "Published" },
  ];

  const currentStepIndex = statusSteps.findIndex((s) => s.key === status);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ── Document Area ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — Notion-style minimal */}
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/50 px-4">
          <div className="flex items-center gap-3">
            {/* Breadcrumb */}
            <span className="text-xs text-muted-foreground">
              {MOCK_STUDENT.class}
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-xs font-medium">{MOCK_HOMEWORK.title}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Status flow */}
            <div className="flex items-center gap-1 mr-2">
              {statusSteps.map((step, i) => {
                const isDone = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <React.Fragment key={step.key}>
                    {i > 0 && (
                      <div
                        className={cn(
                          "h-px w-4",
                          isDone ? "bg-primary" : "bg-border"
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
                        isCurrent
                          ? "bg-primary/10 text-primary font-medium"
                          : isDone
                            ? "text-muted-foreground"
                            : "text-muted-foreground/40"
                      )}
                    >
                      {step.label}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>

            <Separator orientation="vertical" className="h-4" />

            {/* Toggle sidebar */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </header>

        {/* Document body — Notion-like centered content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[720px] px-12 py-10">
            {/* Title block */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-1">
                {MOCK_STUDENT.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {MOCK_HOMEWORK.prompt}
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span>{MOCK_ESSAY_WORD_COUNT} words</span>
                <span>•</span>
                <span>{MOCK_HOMEWORK.taskType}</span>
                <span>•</span>
                <span>Due {MOCK_HOMEWORK.dueDate}</span>
              </div>
            </div>

            <Separator className="mb-8 opacity-50" />

            {/* Essay body */}
            <article className="text-[15px] text-foreground/90 selection:bg-primary/15">
              {renderedEssay}
            </article>

            {/* Bottom spacer for comfortable reading */}
            <div className="h-32" />
          </div>
        </main>

        {/* Bottom action bar — subtle */}
        <footer className="flex h-12 shrink-0 items-center justify-between border-t border-border/50 bg-background/80 px-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>
              AI Overall: <strong>{MOCK_AI_OVERALL.toFixed(1)}</strong>
            </span>
            <span className="mx-1">→</span>
            <span>
              Your Overall:{" "}
              <strong className="text-foreground">
                {overallBand.toFixed(1)}
              </strong>
            </span>
            {unresolvedCount > 0 && (
              <>
                <span className="mx-1">·</span>
                <span>
                  {unresolvedCount} unresolved{" "}
                  {unresolvedCount === 1 ? "comment" : "comments"}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleApprove}
              disabled={status === "approved" || status === "published"}
            >
              {status === "approved" || status === "published" ? (
                <Check className="mr-1 h-3 w-3" />
              ) : null}
              Approve
            </Button>

            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    variant="default"
                    size="sm"
                    disabled={status !== "approved"}
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
                    Kết quả band {overallBand.toFixed(1)} sẽ được gửi cho{" "}
                    {MOCK_STUDENT.name}. Hành động này không thể hoàn tác.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Hủy
                  </DialogClose>
                  <DialogClose render={<Button onClick={handlePublish} />}>
                    Công bố ngay
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </footer>
      </div>

      {/* ── Comment Sidebar ───────────────────────────────────── */}
      {sidebarOpen && (
        <aside className="flex w-[340px] shrink-0 flex-col border-l border-border/50 bg-muted/20">
          {/* Sidebar header */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/50 px-4">
            <span className="text-xs font-medium text-muted-foreground">
              Review
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── Scores section ───────────────────────────────── */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Scores
                </span>
                <BandDot value={overallBand} size="lg" />
              </div>

              <div className="space-y-2">
                {CRITERIA_ORDER.map((c) => {
                  const meta = CRITERION_META[c];
                  const aiScore = MOCK_AI_SCORES[c];
                  const teacherScore = teacherScores[c];
                  const changed = teacherScore !== aiScore;

                  return (
                    <div key={c} className="group flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          `bg-${meta.color}-500`
                        )}
                      />
                      <span className="flex-1 text-xs text-foreground/80 truncate">
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground mr-1">
                        {aiScore.toFixed(1)}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                      <Select
                        value={teacherScore.toString()}
                        onValueChange={(v) => {
                          if (v !== null)
                            setTeacherScores((prev) => ({
                              ...prev,
                              [c]: parseFloat(v),
                            }));
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-16 h-6 text-xs font-semibold justify-center",
                            changed &&
                              "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30"
                          )}
                          size="sm"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BAND_OPTIONS.map((score) => (
                            <SelectItem key={score} value={score.toString()}>
                              {score.toFixed(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator className="opacity-30" />

            {/* ── Feedback section ─────────────────────────────── */}
            <div className="px-4 py-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                General Feedback
              </span>
              <Textarea
                value={teacherFeedback}
                onChange={(e) => setTeacherFeedback(e.target.value)}
                placeholder="Add overall feedback for the student..."
                className="mt-2 min-h-[60px] resize-none border-none bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
              />
            </div>

            <Separator className="opacity-30" />

            {/* ── Comments / Annotations ───────────────────────── */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Comments ({MOCK_AI_ERRORS.length})
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {resolvedErrors.size} resolved
                </span>
              </div>

              <div className="space-y-1">
                {MOCK_AI_ERRORS.map((err) => {
                  const meta = CRITERION_META[err.criterion];
                  const isResolved = resolvedErrors.has(err.errorId);
                  const isActive = activeAnnotation === err.errorId;

                  return (
                    <div
                      key={err.errorId}
                      ref={(el) => {
                        sidebarAnnotationRefs.current[err.errorId] = el;
                      }}
                      onClick={() => handleAnnotationClick(err.errorId)}
                      className={cn(
                        "group cursor-pointer rounded-lg px-3 py-2.5 transition-all duration-100",
                        isActive
                          ? "bg-accent ring-1 ring-border"
                          : "hover:bg-accent/50",
                        isResolved && "opacity-50"
                      )}
                    >
                      {/* Comment header */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-medium text-muted-foreground">
                            AI · {meta.short}
                          </span>
                          <span
                            className={cn(
                              "inline-flex h-4 items-center rounded-full px-1.5 text-[9px] font-medium",
                              meta.bgLight,
                              meta.bgDark
                            )}
                          >
                            {err.category.split(" / ")[0]}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(err.errorId);
                          }}
                          className={cn(
                            "shrink-0 rounded-full p-0.5 transition-colors",
                            isResolved
                              ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400"
                              : "text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100"
                          )}
                          title={isResolved ? "Unresolve" : "Resolve"}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Quoted text */}
                      <div className="mb-1.5 flex items-start gap-1.5">
                        <div
                          className={cn(
                            "mt-0.5 h-full w-0.5 shrink-0 rounded-full",
                            `bg-${meta.color}-400`
                          )}
                          style={{ minHeight: "1rem" }}
                        />
                        <p className="text-[11px] italic text-muted-foreground line-clamp-1">
                          &ldquo;{err.originalQuote}&rdquo;
                        </p>
                      </div>

                      {/* Explanation */}
                      <p
                        className={cn(
                          "text-xs text-foreground/70 leading-relaxed",
                          !isActive && "line-clamp-2"
                        )}
                      >
                        {err.explanation}
                      </p>

                      {/* Suggestion — only when active */}
                      {isActive && err.suggestedCorrection && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-emerald-50/80 px-2 py-1.5 dark:bg-emerald-950/30">
                          <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                            {err.suggestedCorrection}
                          </span>
                        </div>
                      )}

                      {/* Severity badge — only when active */}
                      {isActive && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge
                            variant={
                              err.severity === "impedes_communication"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[9px] h-4"
                          >
                            {SEVERITY_LABEL[err.severity]}
                          </Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── AI Summary ───────────────────────────────────── */}
            <Separator className="opacity-30" />
            <div className="px-4 py-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                AI Examiner Summary
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {MOCK_AI_FEEDBACK.examiner_summary}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    Strengths
                  </span>
                  {MOCK_AI_FEEDBACK.strengths.slice(0, 3).map((s, i) => (
                    <p
                      key={i}
                      className="text-[10px] text-muted-foreground mt-0.5"
                    >
                      · {s}
                    </p>
                  ))}
                </div>
                <div>
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Improvements
                  </span>
                  {MOCK_AI_FEEDBACK.improvements.slice(0, 3).map((s, i) => (
                    <p
                      key={i}
                      className="text-[10px] text-muted-foreground mt-0.5"
                    >
                      · {s}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
