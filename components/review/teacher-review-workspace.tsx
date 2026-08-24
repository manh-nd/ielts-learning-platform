"use client";

import React, { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Criterion,
  ReviewAnnotation,
  FeedbackDiffItem,
  calculateOverallBand,
} from "./types";
import { WritingCriterion } from "@/components/assessment/types";
import { TeacherReviewAnnotator } from "./teacher-review-annotator";
import { AssessmentScorecard } from "@/components/assessment/assessment-scorecard";
import { FeedbackDiffViewer } from "./feedback-diff-viewer";
import {
  ReviewHeader,
  ReviewStudentInfo,
  AssessmentStatus,
} from "./review-header";
import { ReviewPromptBanner } from "./review-prompt-banner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import {
  CheckCircle2,
  Sparkles,
  Award,
  MessageSquare,
  TrendingUp,
  FileText,
} from "lucide-react";

export interface WorkspacePromptInfo {
  id: string;
  title: string;
  taskType: "TASK_1" | "TASK_2";
  targetBand: number;
  wordCountMin: number;
  wordCountMax: number;
  promptText: string;
  keyInstructions?: string[];
}

export interface TeacherReviewWorkspaceProps {
  student: ReviewStudentInfo;
  prompt: WorkspacePromptInfo;
  initialEssayHtml: string;
  initialEssayPlainText: string;
  aiScores: Record<Criterion, number>;
  initialAnnotations: ReviewAnnotation[];
  initialExaminerSummary?: string;
  initialStrengths?: string[];
  initialImprovements?: string[];
  initialStatus?: AssessmentStatus;
  onOpenPromptDetails?: () => void;
  onPublishClick?: () => void;
  className?: string;
  centerHeaderContent?: React.ReactNode;
  "data-testid"?: string;
}

export function TeacherReviewWorkspace({
  student,
  prompt,
  initialEssayHtml,
  initialEssayPlainText,
  aiScores,
  initialAnnotations,
  initialExaminerSummary = "",
  initialStrengths = [],
  initialImprovements = [],
  initialStatus = "ai_proposal_available",
  onOpenPromptDetails,
  onPublishClick,
  className,
  centerHeaderContent,
  "data-testid": testId = "teacher-review-workspace",
}: TeacherReviewWorkspaceProps) {
  // State
  const [status, setStatus] = useState<AssessmentStatus>(initialStatus);
  const [teacherScores, setTeacherScores] = useState<Record<Criterion, number>>(
    {
      ...aiScores,
    }
  );
  const [annotations, setAnnotations] =
    useState<ReviewAnnotation[]>(initialAnnotations);
  const [wordCount, setWordCount] = useState<number>(
    initialEssayPlainText.split(/\s+/).filter(Boolean).length
  );
  const [teacherSummary, setTeacherSummary] = useState<string>(
    initialExaminerSummary
  );
  const [strengths] = useState<string[]>(initialStrengths);
  const [improvements] = useState<string[]>(initialImprovements);

  // Active right tabs (Desktop) and mobile view mode
  const [activeRightTab, setActiveRightTab] = useState<string>("scorecard");
  const [mobileViewMode, setMobileViewMode] = useState<
    "essay" | "scorecard" | "diff" | "summary"
  >("essay");

  // Calculations
  const teacherOverall = useMemo(
    () => calculateOverallBand(teacherScores),
    [teacherScores]
  );
  const aiOverall = useMemo(() => calculateOverallBand(aiScores), [aiScores]);
  const overallDelta = Number((teacherOverall - aiOverall).toFixed(1));

  // Dynamic feedback diff generator
  const diffItems = useMemo<FeedbackDiffItem[]>(() => {
    const diffs: FeedbackDiffItem[] = [];

    // Check AI annotations (excluding teacher-authored ones)
    initialAnnotations
      .filter((a) => a.source !== "teacher")
      .forEach((aiAnn) => {
        const current = annotations.find((a) => a.errorId === aiAnn.errorId);
        if (!current) {
          diffs.push({
            errorId: aiAnn.errorId,
            criterion: aiAnn.criterion,
            originalQuote: aiAnn.originalQuote || "",
            aiSuggestedCorrection: aiAnn.suggestedCorrection,
            teacherFinalText: "[Đã loại bỏ đề xuất này]",
            explanation: aiAnn.explanation,
            resolution: "rejected",
            teacherNote: "Giáo viên xác định không phải lỗi nghiêm trọng.",
          });
        } else if (current.isResolved) {
          diffs.push({
            errorId: aiAnn.errorId,
            criterion: aiAnn.criterion,
            originalQuote: aiAnn.originalQuote || "",
            aiSuggestedCorrection: aiAnn.suggestedCorrection,
            teacherFinalText: current.suggestedCorrection || "",
            explanation: current.explanation,
            resolution: "accepted",
            teacherNote: "Đã chấp nhận và áp dụng gợi ý sửa của AI.",
          });
        } else if (
          current.suggestedCorrection !== aiAnn.suggestedCorrection ||
          current.explanation !== aiAnn.explanation ||
          current.severity !== aiAnn.severity
        ) {
          diffs.push({
            errorId: aiAnn.errorId,
            criterion: aiAnn.criterion,
            originalQuote: aiAnn.originalQuote || "",
            aiSuggestedCorrection: aiAnn.suggestedCorrection,
            teacherFinalText: current.suggestedCorrection || "",
            explanation: current.explanation,
            resolution: "modified",
            teacherNote: "Giáo viên đã sửa lại đề xuất chẩn đoán.",
          });
        } else {
          diffs.push({
            errorId: aiAnn.errorId,
            criterion: aiAnn.criterion,
            originalQuote: aiAnn.originalQuote || "",
            aiSuggestedCorrection: aiAnn.suggestedCorrection,
            teacherFinalText: aiAnn.suggestedCorrection,
            explanation: aiAnn.explanation,
            resolution: "accepted",
            teacherNote: "Giữ nguyên đề xuất của AI.",
          });
        }
      });

    // Check teacher-added annotations
    annotations
      .filter((a) => a.source === "teacher")
      .forEach((tAnn) => {
        diffs.push({
          errorId: tAnn.errorId,
          criterion: tAnn.criterion,
          originalQuote: tAnn.originalQuote || "",
          aiSuggestedCorrection: undefined,
          teacherFinalText: tAnn.suggestedCorrection,
          explanation: tAnn.explanation,
          resolution: "teacher_added",
          teacherNote: `Giáo viên bổ sung nhận xét thủ công (${tAnn.category || "Tuỳ chỉnh"}).`,
        });
      });

    return diffs;
  }, [initialAnnotations, annotations]);

  const acceptedCorrectionsCount = useMemo(
    () => annotations.filter((a) => a.isResolved).length,
    [annotations]
  );

  const modifiedDiffsCount = useMemo(
    () =>
      diffItems.filter(
        (d) => d.resolution === "modified" || d.resolution === "teacher_added"
      ).length,
    [diffItems]
  );

  // Handlers
  const handleQuickApproveAi = useCallback(() => {
    setTeacherScores({ ...aiScores });
    setStatus("approved");
  }, [aiScores]);

  const handleScorecardScoresChange = useCallback(
    (newScores: Record<WritingCriterion, number>) => {
      setTeacherScores(newScores as Record<Criterion, number>);
      if (status === "ai_proposal_available") {
        setStatus("in_review");
      }
    },
    [status]
  );

  const handleApplyCorrection = useCallback(
    (errorId: string, updatedAnnotation: ReviewAnnotation) => {
      setAnnotations((prev) =>
        prev.map((a) => (a.errorId === errorId ? updatedAnnotation : a))
      );
      if (status === "ai_proposal_available") {
        setStatus("in_review");
      }
    },
    [status]
  );

  const handleAnnotationsChange = useCallback(
    (newAnnotations: ReviewAnnotation[]) => {
      setAnnotations(newAnnotations);
      if (status === "ai_proposal_available") {
        setStatus("in_review");
      }
    },
    [status]
  );

  return (
    <div
      data-testid={testId}
      className={cn(
        "flex flex-col min-h-screen bg-background text-foreground",
        className
      )}
    >
      {/* ── Top Header ────────────────────────────────────────── */}
      <ReviewHeader
        student={student}
        taskType={prompt.taskType}
        wordCount={wordCount}
        status={status}
        centerChildren={centerHeaderContent}
        onQuickApproveAi={handleQuickApproveAi}
        onApproveInternal={() => setStatus("approved")}
        onPublishClick={onPublishClick}
        onReopenClick={() => setStatus("in_review")}
      />

      {/* ── Mobile Viewport Mode Switcher (< 1024px) ───────────── */}
      <div className="lg:hidden px-3.5 pt-3 pb-1 border-b bg-muted/40">
        <div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-lg text-xs">
          <button
            onClick={() => setMobileViewMode("essay")}
            className={cn(
              "py-1.5 px-2 rounded-md font-medium text-center transition-all truncate text-[11px]",
              mobileViewMode === "essay"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Bài làm ({annotations.length})
          </button>
          <button
            onClick={() => setMobileViewMode("scorecard")}
            className={cn(
              "py-1.5 px-2 rounded-md font-medium text-center transition-all truncate text-[11px]",
              mobileViewMode === "scorecard"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Bảng điểm{" "}
            {overallDelta !== 0 &&
              `(${overallDelta > 0 ? `+${overallDelta}` : overallDelta})`}
          </button>
          <button
            onClick={() => setMobileViewMode("diff")}
            className={cn(
              "py-1.5 px-2 rounded-md font-medium text-center transition-all truncate text-[11px]",
              mobileViewMode === "diff"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Diff {modifiedDiffsCount > 0 && `(${modifiedDiffsCount})`}
          </button>
          <button
            onClick={() => setMobileViewMode("summary")}
            className={cn(
              "py-1.5 px-2 rounded-md font-medium text-center transition-all truncate text-[11px]",
              mobileViewMode === "summary"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Nhận xét
          </button>
        </div>
      </div>

      {/* ── Main Workspace Body ───────────────────────────────── */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3.5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* ── ESSAY & ANNOTATOR COLUMN (Visible on desktop or when mobileViewMode === 'essay') ── */}
        <section
          className={cn(
            "lg:col-span-7 flex flex-col gap-3.5 sm:gap-4",
            mobileViewMode !== "essay" && "hidden lg:flex"
          )}
        >
          {/* Collapsible Prompt Banner */}
          <ReviewPromptBanner
            title={prompt.title}
            taskType={prompt.taskType}
            targetBand={prompt.targetBand}
            promptText={prompt.promptText}
            keyInstructions={prompt.keyInstructions}
            onOpenDetailsModal={onOpenPromptDetails}
          />

          {/* Annotator Card */}
          <div className="flex-1 rounded-xl border bg-card shadow-xs overflow-hidden flex flex-col">
            <div className="border-b px-3.5 py-2 sm:px-4 sm:py-2.5 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Bài làm & Gán Lỗi
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {annotations.length} lỗi
                </Badge>
                {acceptedCorrectionsCount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40"
                  >
                    {acceptedCorrectionsCount} đã sửa
                  </Badge>
                )}
              </div>
              <div className="text-[10px] sm:text-[11px] text-muted-foreground hidden sm:block">
                Bôi chọn văn bản để gán (+TA, +CC, +LR, +GRA)
              </div>
            </div>

            <div className="p-3 sm:p-4 flex-1">
              <TeacherReviewAnnotator
                key={prompt.id}
                initialContent={initialEssayHtml}
                initialAnnotations={annotations}
                editable={status !== "published"}
                showFilterBar={true}
                showStatsBar={true}
                minHeight="min-h-[420px]"
                onContentChange={(_html, text) => {
                  setWordCount(text.split(/\s+/).filter(Boolean).length);
                }}
                onAnnotationsChange={handleAnnotationsChange}
                onApplyCorrection={handleApplyCorrection}
              />
            </div>
          </div>
        </section>

        {/* ── SCORECARD / DIFF / SUMMARY COLUMN (Visible on desktop or matching mobile mode) ── */}
        <section
          className={cn(
            "lg:col-span-5 flex flex-col gap-4",
            mobileViewMode === "essay" && "hidden lg:flex"
          )}
        >
          {/* Desktop Tabs Header (Hidden on Mobile, as mobile has top bar) */}
          <Tabs
            value={activeRightTab}
            onValueChange={setActiveRightTab}
            className="w-full flex flex-col flex-1"
          >
            <div className="hidden lg:block">
              <TabsList className="grid grid-cols-3 w-full h-10 p-1 bg-muted/60">
                <TabsTrigger value="scorecard" className="text-xs gap-1.5">
                  <Award className="h-3.5 w-3.5" />
                  <span>Bảng điểm</span>
                  {overallDelta !== 0 && (
                    <span className="ml-1 text-[10px] font-mono px-1 rounded bg-background border font-semibold">
                      {overallDelta > 0 ? `+${overallDelta}` : overallDelta}
                    </span>
                  )}
                </TabsTrigger>

                <TabsTrigger value="diff" className="text-xs gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Feedback Diff</span>
                  {modifiedDiffsCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1 text-[9px] font-bold"
                    >
                      {modifiedDiffsCount}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger value="summary" className="text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Nhận xét</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: AssessmentScorecard */}
            <div
              className={cn(
                "mt-0 lg:mt-3 space-y-4",
                mobileViewMode !== "scorecard" && "hidden lg:block",
                activeRightTab !== "scorecard" && "lg:hidden"
              )}
            >
              <AssessmentScorecard
                scores={teacherScores}
                aiProposalScores={aiScores}
                mode={status === "published" ? "readonly" : "interactive"}
                taskType={prompt.taskType}
                title={`Đánh giá Tiêu chí IELTS ${prompt.taskType}`}
                examinerFeedback={teacherSummary}
                onScoresChange={handleScorecardScoresChange}
                onAcceptAllAi={handleQuickApproveAi}
                onResetCriterionToAi={(crit) => {
                  setTeacherScores((prev) => ({
                    ...prev,
                    [crit]: aiScores[crit],
                  }));
                }}
                showAiComparison={true}
                showRubrics={true}
              />
            </div>

            {/* TAB 2: FeedbackDiffViewer */}
            <div
              className={cn(
                "mt-0 lg:mt-3 space-y-4",
                mobileViewMode !== "diff" && "hidden lg:block",
                activeRightTab !== "diff" && "lg:hidden"
              )}
            >
              <FeedbackDiffViewer
                aiScores={aiScores}
                teacherScores={teacherScores}
                diffItems={diffItems}
              />
            </div>

            {/* TAB 3: Summary */}
            <div
              className={cn(
                "mt-0 lg:mt-3 space-y-4",
                mobileViewMode !== "summary" && "hidden lg:block",
                activeRightTab !== "summary" && "lg:hidden"
              )}
            >
              <Card className="shadow-2xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold">
                      Nhận xét Tổng quát của Giám khảo
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      Gửi kèm kết quả
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Lời đánh giá tổng quan (Overall Feedback)
                    </label>
                    <Textarea
                      rows={4}
                      value={teacherSummary}
                      onChange={(e) => setTeacherSummary(e.target.value)}
                      disabled={status === "published"}
                      placeholder="Nhập lời nhận xét tổng quan cho bài làm của học viên..."
                      className="text-xs leading-relaxed"
                    />
                  </div>

                  <Separator />

                  {/* Strengths */}
                  <div className="space-y-2">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Điểm mạnh nổi bật (Strengths)
                    </span>
                    <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                      {strengths.map((st, i) => (
                        <li key={i} className="leading-relaxed">
                          <span className="text-foreground">{st}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator />

                  {/* Improvements */}
                  <div className="space-y-2">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                      Điểm cần khắc phục (Actionable Advice)
                    </span>
                    <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                      {improvements.map((im, i) => (
                        <li key={i} className="leading-relaxed">
                          <span className="text-foreground">{im}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Tabs>
        </section>
      </main>
    </div>
  );
}
