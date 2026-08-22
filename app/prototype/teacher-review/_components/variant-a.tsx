"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Check,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Eye,
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
  AssessmentStatus,
  Criterion,
} from "../_data/mock";

export function VariantA() {
  const [status, setStatus] = useState<AssessmentStatus>(
    "ai_proposal_available"
  );
  const [teacherScores, setTeacherScores] = useState<
    Partial<Record<Criterion, number>>
  >({});
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [expandedAIProposal, setExpandedAIProposal] = useState(true);
  const [expandedCriteria, setExpandedCriteria] = useState<
    Record<Criterion, boolean>
  >({
    TASK_ACHIEVEMENT: false,
    COHERENCE_COHESION: false,
    LEXICAL_RESOURCE: false,
    GRAMMATICAL_RANGE_ACCURACY: false,
  });
  const [selectedErrorId, setSelectedErrorId] = useState<string | null>(null);

  const isComplete = CRITERIA_ORDER.every(
    (c) => teacherScores[c] !== undefined
  );
  const overallBand = useMemo(() => {
    if (!isComplete) return null;
    return calculateOverallBand(teacherScores as Record<Criterion, number>);
  }, [teacherScores, isComplete]);

  const handleAcceptAI = () => {
    setTeacherScores(MOCK_AI_SCORES);
    setTeacherFeedback(MOCK_AI_FEEDBACK.examiner_summary);
  };

  const handleApprove = () => {
    if (isComplete) setStatus("approved");
  };

  const handlePublish = () => {
    setStatus("published");
  };

  const toggleExpandCriterion = (c: Criterion) => {
    setExpandedCriteria((prev) => ({ ...prev, [c]: !prev[c] }));
  };

  // Render essay with highlights
  const renderEssay = () => {
    let lastIndex = 0;
    const elements: React.ReactNode[] = [];

    // Sort errors by offsetStart
    const sortedErrors = [...MOCK_AI_ERRORS].sort(
      (a, b) => a.offsetStart - b.offsetStart
    );

    sortedErrors.forEach((err, i) => {
      // Find approximate match in text based on string rather than exact offset if offset is off,
      // but for mock data we assume offsets are generally ok or we can just do string replace.
      // Mock data offsets are given, so we use them safely:
      if (err.offsetStart > lastIndex) {
        elements.push(
          <span key={`text-${i}`}>
            {MOCK_ESSAY.substring(lastIndex, err.offsetStart)}
          </span>
        );
      }

      const isSelected = selectedErrorId === err.errorId;
      const meta = CRITERION_META[err.criterion];

      elements.push(
        <mark
          key={`err-${err.errorId}`}
          className={cn(
            "cursor-pointer rounded-sm px-0.5 transition-colors",
            meta.bgLight,
            isSelected ? "ring-2 ring-foreground" : "hover:brightness-95"
          )}
          onClick={() => setSelectedErrorId(err.errorId)}
        >
          {MOCK_ESSAY.substring(err.offsetStart, err.offsetEnd)}
        </mark>
      );
      lastIndex = err.offsetEnd;
    });

    if (lastIndex < MOCK_ESSAY.length) {
      elements.push(
        <span key="text-end">{MOCK_ESSAY.substring(lastIndex)}</span>
      );
    }

    // Split by newlines to render paragraphs
    const paragraphs: React.ReactNode[] = [];
    let currentParagraph: React.ReactNode[] = [];

    elements.forEach((el, index) => {
      if (React.isValidElement(el) && el.type === "span") {
        const children = (el.props as { children?: string }).children;
        if (typeof children === "string") {
          const parts = children.split("\n\n");
          parts.forEach((part: string, pIndex: number) => {
            if (pIndex > 0) {
              paragraphs.push(
                <p key={`p-${paragraphs.length}`} className="mb-4">
                  {currentParagraph}
                </p>
              );
              currentParagraph = [];
            }
            if (part) {
              currentParagraph.push(
                <span key={`text-${index}-${pIndex}`}>{part}</span>
              );
            }
          });
        }
      } else {
        currentParagraph.push(el);
      }
    });
    if (currentParagraph.length > 0) {
      paragraphs.push(
        <p key={`p-${paragraphs.length}`} className="mb-4">
          {currentParagraph}
        </p>
      );
    }

    return paragraphs;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* LEFT PANE */}
      <div className="flex w-[60%] flex-col border-r border-border">
        {/* Essay Content */}
        <div className="flex-1 overflow-y-auto p-6 text-sm/relaxed leading-loose">
          <div className="mx-auto max-w-3xl space-y-4">
            <h2 className="font-heading text-lg font-semibold">
              {MOCK_HOMEWORK.title}
            </h2>
            <div className="text-muted-foreground bg-muted p-4 rounded-md text-xs italic mb-6">
              {MOCK_HOMEWORK.prompt}
            </div>
            <div className="text-foreground">{renderEssay()}</div>
          </div>
        </div>

        <Separator />

        {/* Error List */}
        <div className="h-64 overflow-y-auto bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Detected Issues ({MOCK_AI_ERRORS.length})
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {MOCK_AI_ERRORS.map((err) => {
              const meta = CRITERION_META[err.criterion];
              const isSelected = selectedErrorId === err.errorId;
              return (
                <Card
                  key={err.errorId}
                  size="sm"
                  className={cn(
                    "cursor-pointer transition-colors hover:border-foreground/30",
                    isSelected
                      ? "border-foreground shadow-sm bg-accent/50"
                      : "bg-card"
                  )}
                  onClick={() => setSelectedErrorId(err.errorId)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-transparent font-bold",
                            meta.bgLight,
                            meta.border
                          )}
                        >
                          {meta.short}
                        </Badge>
                        <span className="text-xs font-medium">
                          {err.category}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] capitalize"
                      >
                        {err.severity.replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3 text-xs">
                    <div className="bg-destructive/10 text-destructive-foreground px-2 py-1 rounded-sm line-through mb-1 inline-block">
                      {err.originalQuote}
                    </div>
                    {err.suggestedCorrection && (
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-sm inline-block ml-2">
                        <Check className="size-3 inline mr-1" />
                        {err.suggestedCorrection}
                      </div>
                    )}
                    <p className="mt-2 text-muted-foreground">
                      {err.explanation}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANE */}
      <div className="flex w-[40%] flex-col bg-muted/10">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                  {MOCK_STUDENT.avatar}
                </div>
                <div>
                  <h2 className="font-semibold text-sm">{MOCK_STUDENT.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {MOCK_STUDENT.class}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge
                variant={status === "published" ? "default" : "outline"}
                className="capitalize"
              >
                {STATUS_LABELS[status]}
              </Badge>
              <div className="text-xs text-muted-foreground">
                <span
                  className={
                    MOCK_ESSAY_WORD_COUNT < MOCK_HOMEWORK.wordLimit.min
                      ? "text-destructive font-medium"
                      : ""
                  }
                >
                  {MOCK_ESSAY_WORD_COUNT} words
                </span>
                {" / "}
                {MOCK_HOMEWORK.wordLimit.min}-{MOCK_HOMEWORK.wordLimit.max}
              </div>
            </div>
          </div>

          <Separator />

          {/* AI Proposal */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader
              className="cursor-pointer pb-2 flex-row items-center justify-between"
              onClick={() => setExpandedAIProposal(!expandedAIProposal)}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <CardTitle className="text-sm text-primary">
                  AI Evaluation Proposal
                </CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-7 rounded-md bg-primary text-primary-foreground font-bold text-sm">
                  {MOCK_AI_OVERALL.toFixed(1)}
                </div>
                {expandedAIProposal ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>

            {expandedAIProposal && (
              <CardContent className="pt-2">
                <div className="flex gap-2 mb-4">
                  {CRITERIA_ORDER.map((c) => {
                    const meta = CRITERION_META[c];
                    return (
                      <Badge
                        key={c}
                        variant="outline"
                        className={cn(
                          meta.bgLight,
                          meta.border,
                          "border-transparent px-1.5"
                        )}
                      >
                        {meta.short}: {MOCK_AI_SCORES[c].toFixed(1)}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground bg-background rounded p-2 border shadow-sm">
                  {MOCK_AI_FEEDBACK.examiner_summary}
                </p>
              </CardContent>
            )}
          </Card>

          {/* Teacher Scoring */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Teacher Assessment</h3>
            <div className="flex flex-col gap-3">
              {CRITERIA_ORDER.map((c) => {
                const meta = CRITERION_META[c];
                const val = teacherScores[c];
                const isExpanded = expandedCriteria[c];

                return (
                  <Card
                    key={c}
                    size="sm"
                    className={cn(
                      "overflow-visible transition-colors",
                      val ? "border-primary/30 bg-primary/5" : ""
                    )}
                  >
                    <div className="p-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 flex-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            "w-10 justify-center font-bold border-transparent",
                            meta.bgLight,
                            meta.border
                          )}
                        >
                          {meta.short}
                        </Badge>
                        <span className="text-xs font-medium hidden sm:inline">
                          {meta.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Sparkles className="size-3" />
                          {MOCK_AI_SCORES[c].toFixed(1)}
                        </div>

                        <Select
                          value={val !== undefined ? val.toString() : ""}
                          onValueChange={(v) => {
                            if (v !== null)
                              setTeacherScores((prev) => ({
                                ...prev,
                                [c]: parseFloat(v),
                              }));
                          }}
                        >
                          <SelectTrigger
                            className="w-20 font-semibold"
                            size="sm"
                          >
                            <SelectValue placeholder="Score" />
                          </SelectTrigger>
                          <SelectContent>
                            {BAND_OPTIONS.map((score) => (
                              <SelectItem key={score} value={score.toString()}>
                                {score.toFixed(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => toggleExpandCriterion(c)}
                          className="text-muted-foreground shrink-0"
                        >
                          {isExpanded ? <ChevronUp /> : <ChevronDown />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 text-xs border-t border-border/50 bg-muted/20">
                        <div className="mt-2 text-muted-foreground mb-3">
                          {MOCK_AI_CRITERIA_DETAIL[c].justification}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="font-semibold text-emerald-600 mb-1 block">
                              Strengths
                            </span>
                            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                              {MOCK_AI_CRITERIA_DETAIL[c].strengths.map(
                                (s, i) => (
                                  <li key={i}>{s}</li>
                                )
                              )}
                            </ul>
                          </div>
                          <div>
                            <span className="font-semibold text-amber-600 mb-1 block">
                              Improvements
                            </span>
                            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                              {MOCK_AI_CRITERIA_DETAIL[c].improvements.map(
                                (s, i) => (
                                  <li key={i}>{s}</li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between bg-card border rounded-lg p-3">
              <span className="font-semibold text-sm">Overall Band</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-3" />
                  {MOCK_AI_OVERALL.toFixed(1)}
                </span>
                <div
                  className={cn(
                    "flex items-center justify-center size-9 rounded-md font-bold text-lg",
                    overallBand
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {overallBand ? overallBand.toFixed(1) : "-"}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* General Feedback */}
          <div>
            <h3 className="text-sm font-semibold mb-2">General Feedback</h3>
            <Textarea
              placeholder="Enter overall feedback for the student..."
              className="min-h-[120px]"
              value={teacherFeedback}
              onChange={(e) => setTeacherFeedback(e.target.value)}
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="border-t bg-card p-4 flex items-center gap-3 shadow-lg z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    onClick={handleAcceptAI}
                    className="gap-2"
                  />
                }
              >
                <Sparkles className="size-4" />
                Accept AI
              </TooltipTrigger>
              <TooltipContent>
                Copy all AI scores and summary to your assessment
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex-1" />

          <Button
            variant="secondary"
            onClick={handleApprove}
            disabled={
              !isComplete || status === "approved" || status === "published"
            }
          >
            {status === "approved" || status === "published" ? (
              <Check className="size-4 mr-1" />
            ) : null}
            Approve
          </Button>

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  variant="default"
                  disabled={status !== "approved"}
                  className="gap-2"
                />
              }
            >
              <Send className="size-4" />
              Publish
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish Assessment</DialogTitle>
                <DialogDescription>
                  Are you sure you want to publish this assessment? The student
                  will be notified and this action cannot be easily undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <DialogClose
                  render={<Button variant="default" onClick={handlePublish} />}
                >
                  Yes, Publish
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
