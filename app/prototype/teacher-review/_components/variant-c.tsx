"use client";

import * as React from "react";
import {
  Check,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RotateCcw,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

import {
  Criterion,
  CRITERION_META,
  CRITERIA_ORDER,
  BAND_OPTIONS,
  calculateOverallBand,
  AssessmentStatus,
  STATUS_FLOW,
  STATUS_LABELS,
  MOCK_STUDENT,
  MOCK_HOMEWORK,
  MOCK_ESSAY,
  MOCK_ESSAY_WORD_COUNT,
  MOCK_AI_SCORES,
  MOCK_AI_FEEDBACK,
  MOCK_AI_ERRORS,
  MOCK_AI_CRITERIA_DETAIL,
} from "../_data/mock";

export function VariantC() {
  const [status, setStatus] = React.useState<AssessmentStatus>(
    "ai_proposal_available"
  );
  const [essayCollapsed, setEssayCollapsed] = React.useState(false);

  const [teacherScores, setTeacherScores] = React.useState<
    Record<Criterion, number>
  >({ ...MOCK_AI_SCORES });
  const [cardExpanded, setCardExpanded] = React.useState<
    Record<Criterion, boolean>
  >({
    TASK_ACHIEVEMENT: false,
    COHERENCE_COHESION: false,
    LEXICAL_RESOURCE: false,
    GRAMMATICAL_RANGE_ACCURACY: false,
  });
  const [teacherNotes, setTeacherNotes] = React.useState<
    Record<Criterion, string>
  >({
    TASK_ACHIEVEMENT: "",
    COHERENCE_COHESION: "",
    LEXICAL_RESOURCE: "",
    GRAMMATICAL_RANGE_ACCURACY: "",
  });
  const [generalFeedback, setGeneralFeedback] = React.useState(
    MOCK_AI_FEEDBACK.examiner_summary
  );

  const handleScoreChange = (c: Criterion, val: string) => {
    setTeacherScores((prev) => ({ ...prev, [c]: parseFloat(val) }));
    if (status === "ai_proposal_available" || status === "created") {
      setStatus("teacher_assessed");
    }
  };

  const acceptAllAi = () => {
    setTeacherScores({ ...MOCK_AI_SCORES });
    if (status === "ai_proposal_available" || status === "created") {
      setStatus("teacher_assessed");
    }
  };

  const toggleCard = (c: Criterion) => {
    setCardExpanded((prev) => ({ ...prev, [c]: !prev[c] }));
  };

  const overallBand = calculateOverallBand(teacherScores);
  const formulaStr = `(${teacherScores.TASK_ACHIEVEMENT} + ${teacherScores.COHERENCE_COHESION} + ${teacherScores.LEXICAL_RESOURCE} + ${teacherScores.GRAMMATICAL_RANGE_ACCURACY}) / 4 = ${((teacherScores.TASK_ACHIEVEMENT + teacherScores.COHERENCE_COHESION + teacherScores.LEXICAL_RESOURCE + teacherScores.GRAMMATICAL_RANGE_ACCURACY) / 4).toFixed(3)} → ${overallBand.toFixed(1)}`;

  const renderHighlightedEssay = () => {
    return (
      <div className="whitespace-pre-wrap leading-relaxed text-sm">
        {MOCK_ESSAY}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 overflow-hidden">
        {/* Band 1: Essay & Context */}
        <div
          className={cn(
            "flex flex-col border-b bg-background shrink-0 transition-all duration-300",
            essayCollapsed ? "max-h-16" : "max-h-[40vh]"
          )}
        >
          {/* Sticky Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 sticky top-0 bg-background z-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold">
                  {MOCK_STUDENT.avatar}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-none">
                    {MOCK_STUDENT.name}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {MOCK_HOMEWORK.title}
                  </span>
                </div>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <Badge
                variant="outline"
                className={cn(
                  status === "ai_proposal_available"
                    ? "border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                    : status === "teacher_assessed"
                      ? "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      : status === "approved"
                        ? "border-green-200 bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"
                        : status === "published"
                          ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                          : ""
                )}
              >
                {STATUS_LABELS[status]}
              </Badge>
              {essayCollapsed && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground ml-4 animate-in fade-in">
                  <span>{MOCK_ESSAY_WORD_COUNT} words</span>
                  <span>•</span>
                  <span>{MOCK_HOMEWORK.taskType}</span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEssayCollapsed(!essayCollapsed)}
            >
              {essayCollapsed ? (
                <>
                  <Eye className="mr-2 h-4 w-4" /> Hiện bài làm
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" /> Ẩn bài làm
                </>
              )}
            </Button>
          </div>

          {/* Essay Content */}
          {!essayCollapsed && (
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
              <div className="max-w-4xl mx-auto">
                <div className="prose prose-sm dark:prose-invert">
                  {renderHighlightedEssay()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Band 2: Criterion Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* 2x2 Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {CRITERIA_ORDER.map((c) => {
                const meta = CRITERION_META[c];
                const aiScore = MOCK_AI_SCORES[c];
                const tScore = teacherScores[c];
                const isOverridden = tScore !== aiScore;
                const details = MOCK_AI_CRITERIA_DETAIL[c];
                const cErrors = MOCK_AI_ERRORS.filter((e) => e.criterion === c);
                const isExpanded = cardExpanded[c];

                return (
                  <Card
                    key={c}
                    className={cn(
                      "flex flex-col border-l-4 shadow-sm",
                      meta.border
                    )}
                  >
                    <CardHeader className="pb-3 border-b border-border/50 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              meta.bgLight,
                              meta.bgDark,
                              "border-transparent font-bold"
                            )}
                          >
                            {meta.short}
                          </Badge>
                          <CardTitle className="text-base">
                            {meta.label}
                          </CardTitle>
                        </div>
                        <Button
                          variant={isOverridden ? "outline" : "ghost"}
                          size="xs"
                          onClick={() =>
                            setTeacherScores((p) => ({ ...p, [c]: aiScore }))
                          }
                          className={cn(
                            isOverridden
                              ? "text-amber-600 border-amber-200"
                              : "text-muted-foreground"
                          )}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          {isOverridden ? "Restore AI" : "AI Accepted"}
                        </Button>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between bg-white dark:bg-slate-950 p-3 rounded-lg border">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            AI
                          </span>
                          <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-lg text-slate-500">
                            {aiScore.toFixed(1)}
                          </div>
                        </div>

                        <ArrowRight className="text-muted-foreground/40 shrink-0" />

                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                            Teacher
                          </span>
                          <Select
                            value={tScore.toString()}
                            onValueChange={(val) => {
                              if (val !== null) handleScoreChange(c, val);
                            }}
                          >
                            <SelectTrigger
                              className={cn(
                                "w-20 h-10 text-lg font-bold justify-center",
                                isOverridden
                                  ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                                  : "bg-primary text-primary-foreground"
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BAND_OPTIONS.map((b) => (
                                <SelectItem key={b} value={b.toString()}>
                                  {b.toFixed(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between"
                          onClick={() => toggleCard(c)}
                        >
                          <span className="text-xs font-medium">
                            Chi tiết AI & Ghi chú ({cErrors.length} lỗi)
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>

                        {isExpanded && (
                          <div className="text-sm space-y-4 animate-in slide-in-from-top-2 fade-in">
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-md">
                              <div className="flex items-start gap-2 text-muted-foreground">
                                <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-purple-500" />
                                <p>{details.justification}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                                  Strengths
                                </span>
                                <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
                                  {details.strengths.map((s, i) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                                  To Improve
                                </span>
                                <ul className="text-xs space-y-1 list-disc pl-4 text-muted-foreground">
                                  {details.improvements.map((s, i) => (
                                    <li key={i}>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {cErrors.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-xs font-semibold">
                                  Errors Detected
                                </span>
                                <div className="space-y-2">
                                  {cErrors.map((err) => (
                                    <div
                                      key={err.errorId}
                                      className="flex flex-col gap-1 text-xs p-2 rounded bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30"
                                    >
                                      <div className="font-medium text-red-800 dark:text-red-300">
                                        "{err.originalQuote}"
                                      </div>
                                      <div className="text-muted-foreground">
                                        {err.explanation}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-1.5 pt-2 border-t">
                              <span className="text-xs font-semibold">
                                Teacher Notes (Internal)
                              </span>
                              <Textarea
                                placeholder="Ghi chú thêm cho tiêu chí này..."
                                value={teacherNotes[c]}
                                onChange={(e) =>
                                  setTeacherNotes((p) => ({
                                    ...p,
                                    [c]: e.target.value,
                                  }))
                                }
                                className="min-h-16 text-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Overall & General Feedback */}
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-black rounded-xl border shadow-sm min-w-[200px]">
                    <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Overall Band
                    </span>
                    <div className="text-5xl font-black text-primary mb-2">
                      {overallBand.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                      {formulaStr}
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <span className="text-sm font-semibold">
                      General Feedback
                    </span>
                    <Textarea
                      value={generalFeedback}
                      onChange={(e) => setGeneralFeedback(e.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="h-8"></div>
          </div>
        </div>

        {/* Band 3: Action Bar */}
        <div className="border-t bg-background p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 w-1/3">
            <div className="flex items-center gap-2">
              {STATUS_FLOW.map((s, i) => {
                const isActive = s === status;
                const isPast = STATUS_FLOW.indexOf(status) >= i;
                return (
                  <div key={s} className="flex items-center">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-full transition-colors",
                              isActive
                                ? "bg-primary ring-2 ring-primary/20 ring-offset-2 dark:ring-offset-background"
                                : isPast
                                  ? "bg-primary"
                                  : "bg-muted"
                            )}
                          />
                        }
                      />
                      <TooltipContent>{STATUS_LABELS[s]}</TooltipContent>
                    </Tooltip>
                    {i < STATUS_FLOW.length - 1 && (
                      <div
                        className={cn(
                          "h-px w-4 mx-1",
                          isPast ? "bg-primary" : "bg-muted"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-center w-1/3">
            {status === "ai_proposal_available" && (
              <span className="text-xs text-muted-foreground animate-pulse">
                Vui lòng rà soát điểm AI
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 w-1/3">
            <Button variant="ghost" onClick={acceptAllAi}>
              Accept All AI
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={
                      status === "approved" || status === "published"
                        ? "outline"
                        : "default"
                    }
                    onClick={() => setStatus("approved")}
                    disabled={status === "approved" || status === "published"}
                  />
                }
              >
                <Check className="mr-2 h-4 w-4" /> Approve
              </TooltipTrigger>
              <TooltipContent>
                Lưu kết quả nhưng chưa gửi cho học viên
              </TooltipContent>
            </Tooltip>

            <Dialog>
              <DialogTrigger
                render={
                  <Button variant="outline" disabled={status !== "approved"} />
                }
              >
                <Send className="mr-2 h-4 w-4" /> Publish
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Xác nhận công bố kết quả</DialogTitle>
                  <DialogDescription>
                    Bạn sắp gửi kết quả {overallBand.toFixed(1)} cho học viên{" "}
                    {MOCK_STUDENT.name}. Học viên sẽ nhận được thông báo ngay
                    lập tức.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <DialogClose render={<Button variant="outline" />}>
                    Hủy
                  </DialogClose>
                  <DialogClose
                    render={<Button onClick={() => setStatus("published")} />}
                  >
                    Công bố ngay
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
