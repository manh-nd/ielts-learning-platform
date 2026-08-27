"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  CRITERION_META,
  CRITERIA_ORDER,
  calculateOverallBand,
  type AssessmentScores,
  type FeedbackDiffItem,
  type FeedbackDiffResolution,
} from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bot,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Edit3,
  ArrowRight,
  Sparkles,
  PieChart,
} from "lucide-react";

export interface FeedbackDiffViewerProps {
  aiScores: AssessmentScores;
  teacherScores: AssessmentScores;
  diffItems: FeedbackDiffItem[];
  className?: string;
  "data-testid"?: string;
}

const RESOLUTION_META: Record<
  FeedbackDiffResolution,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
    borderClass: string;
  }
> = {
  accepted: {
    label: "Chấp nhận gợi ý",
    icon: CheckCircle2,
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    borderClass: "border-emerald-200 dark:border-emerald-900/50",
  },
  rejected: {
    label: "Bác bỏ gợi ý",
    icon: XCircle,
    badgeClass:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    borderClass: "border-rose-200 dark:border-rose-900/50",
  },
  modified: {
    label: "Điều chỉnh chẩn đoán",
    icon: Edit3,
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-900/50",
  },
  teacher_added: {
    label: "Giáo viên thêm mới",
    icon: PlusCircle,
    badgeClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-900/50",
  },
};

export function FeedbackDiffViewer({
  aiScores,
  teacherScores,
  diffItems = [],
  className,
  "data-testid": testId = "feedback-diff-viewer",
}: FeedbackDiffViewerProps) {
  const [selectedTab, setSelectedTab] = useState<
    "ALL" | FeedbackDiffResolution
  >("ALL");

  const aiOverall = useMemo(() => calculateOverallBand(aiScores), [aiScores]);
  const teacherOverall = useMemo(
    () => calculateOverallBand(teacherScores),
    [teacherScores]
  );
  const overallDelta = teacherOverall - aiOverall;

  // Filter diff items
  const filteredItems = useMemo(() => {
    if (selectedTab === "ALL") return diffItems;
    return diffItems.filter((item) => item.resolution === selectedTab);
  }, [diffItems, selectedTab]);

  // Statistics
  const stats = useMemo(() => {
    const accepted = diffItems.filter(
      (i) => i.resolution === "accepted"
    ).length;
    const rejected = diffItems.filter(
      (i) => i.resolution === "rejected"
    ).length;
    const modified = diffItems.filter(
      (i) => i.resolution === "modified"
    ).length;
    const teacherAdded = diffItems.filter(
      (i) => i.resolution === "teacher_added"
    ).length;
    const totalAI = accepted + rejected + modified;
    const agreementRate =
      totalAI > 0 ? Math.round((accepted / totalAI) * 100) : 100;

    return {
      accepted,
      rejected,
      modified,
      teacherAdded,
      totalAI,
      agreementRate,
    };
  }, [diffItems]);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-xs p-6 space-y-6",
        className
      )}
      data-testid={testId}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            So sánh Đánh giá AI vs Quyết định của Giáo viên
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bản ghi nhận đối chiếu dữ liệu (`EvaluationFeedback`) phục vụ tinh
            chỉnh mô hình và kiểm toán chất lượng.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={
              stats.agreementRate >= 80
                ? "secondary"
                : stats.agreementRate >= 50
                  ? "outline"
                  : "destructive"
            }
            className="text-xs"
            data-testid="agreement-rate-badge"
          >
            Độ đồng thuận: {stats.agreementRate}%
          </Badge>
        </div>
      </div>

      {/* Band Scores Delta Grid */}
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Biến động Điểm Band (Score Delta)
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 4 Criteria Scores */}
          {CRITERIA_ORDER.map((crit) => {
            const meta = CRITERION_META[crit];
            const aiScore = aiScores[crit] ?? 0;
            const teacherScore = teacherScores[crit] ?? 0;
            const delta = teacherScore - aiScore;

            return (
              <div
                key={crit}
                className="rounded-lg border bg-background p-3 flex flex-col justify-between shadow-2xs"
                data-testid={`score-card-${meta.short.toLowerCase()}`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium text-foreground">
                    {meta.short}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.2 rounded flex items-center gap-0.5",
                      delta > 0
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : delta < 0
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                          : "bg-muted text-foreground/80 font-medium"
                    )}
                  >
                    {delta > 0 ? (
                      <>
                        <TrendingUp className="h-2.5 w-2.5" /> +
                        {delta.toFixed(1)}
                      </>
                    ) : delta < 0 ? (
                      <>
                        <TrendingDown className="h-2.5 w-2.5" />{" "}
                        {delta.toFixed(1)}
                      </>
                    ) : (
                      <>
                        <Minus className="h-2.5 w-2.5" /> 0.0
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Bot className="h-3 w-3" />
                    <span>AI:</span>
                    <strong className="text-foreground">
                      {aiScore.toFixed(1)}
                    </strong>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                  <div className="flex items-center gap-1 text-foreground font-semibold">
                    <UserCheck className="h-3 w-3 text-primary" />
                    <span>GV:</span>
                    <strong className="text-primary text-sm">
                      {teacherScore.toFixed(1)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Overall Band Score */}
          <div
            className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-col justify-between shadow-2xs col-span-2 sm:col-span-1"
            data-testid="score-card-overall"
          >
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-foreground">Overall Band</span>
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5",
                  overallDelta > 0
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : overallDelta < 0
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                      : "bg-muted text-foreground/80 font-medium"
                )}
              >
                {overallDelta > 0 ? (
                  <>
                    <TrendingUp className="h-2.5 w-2.5" /> +
                    {overallDelta.toFixed(1)}
                  </>
                ) : overallDelta < 0 ? (
                  <>
                    <TrendingDown className="h-2.5 w-2.5" />{" "}
                    {overallDelta.toFixed(1)}
                  </>
                ) : (
                  <>
                    <Minus className="h-2.5 w-2.5" /> 0.0
                  </>
                )}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1 border-t text-xs">
              <div className="flex items-center gap-1 text-foreground/80">
                <Bot className="h-3 w-3" />
                <span>AI:</span>
                <strong className="text-foreground">
                  {aiOverall.toFixed(1)}
                </strong>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
              <div className="flex items-center gap-1 font-bold text-primary">
                <UserCheck className="h-3 w-3" />
                <span>GV:</span>
                <strong className="text-base">
                  {teacherOverall.toFixed(1)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/40 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">Tổng lỗi AI phát hiện</span>
          <span className="text-sm font-semibold text-foreground">
            {stats.totalAI} lỗi
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">Đã chấp nhận (Accepted)</span>
          <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {stats.accepted} ({stats.agreementRate}%)
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">Bác bỏ (Rejected)</span>
          <span className="text-sm font-semibold text-rose-800 dark:text-rose-300">
            {stats.rejected}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground">Giáo viên bổ sung</span>
          <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            +{stats.teacherAdded} lỗi
          </span>
        </div>
      </div>

      {/* Error Resolution Breakdown Tabs & List */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <PieChart className="h-3.5 w-3.5" /> Chi tiết Xử lý Lỗi (
            {diffItems.length})
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant={selectedTab === "ALL" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTab("ALL")}
              className="h-6 px-2 text-xs rounded-full"
            >
              Tất cả ({diffItems.length})
            </Button>
            <Button
              type="button"
              variant={selectedTab === "accepted" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTab("accepted")}
              className="h-6 px-2 text-xs rounded-full"
            >
              Chấp nhận ({stats.accepted})
            </Button>
            <Button
              type="button"
              variant={selectedTab === "rejected" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTab("rejected")}
              className="h-6 px-2 text-xs rounded-full"
            >
              Bác bỏ ({stats.rejected})
            </Button>
            <Button
              type="button"
              variant={selectedTab === "teacher_added" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTab("teacher_added")}
              className="h-6 px-2 text-xs rounded-full"
            >
              GV thêm ({stats.teacherAdded})
            </Button>
          </div>
        </div>

        {/* List of Diff Items */}
        <div className="space-y-2.5" data-testid="diff-items-list">
          {filteredItems.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground border rounded-lg border-dashed">
              Không có lỗi nào thuộc danh mục này.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const critMeta = CRITERION_META[item.criterion];
              const resMeta = RESOLUTION_META[item.resolution];
              const ResIcon = resMeta.icon;

              return (
                <div
                  key={`${item.errorId}-${item.resolution}-${index}`}
                  className={cn(
                    "rounded-lg border bg-background p-3 text-xs transition-all space-y-2",
                    resMeta.borderClass
                  )}
                  data-testid={`diff-item-${item.errorId}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-semibold",
                          critMeta.badgeBg
                        )}
                      >
                        {critMeta.short} · {critMeta.label}
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium",
                          resMeta.badgeClass
                        )}
                      >
                        <ResIcon className="h-3 w-3" />
                        {resMeta.label}
                      </span>
                    </div>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">
                    {item.explanation}
                  </p>

                  {/* Quote and Revision Diff */}
                  <div className="flex flex-wrap items-center gap-2 rounded bg-muted/30 p-2 font-mono text-[11px]">
                    <span className="text-muted-foreground">Nguyên văn:</span>
                    <span className="line-through text-foreground/80 font-medium">
                      &quot;{item.originalQuote}&quot;
                    </span>

                    {item.aiSuggestedCorrection && (
                      <>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-purple-700 dark:text-purple-300 font-medium">
                          AI: &quot;{item.aiSuggestedCorrection}&quot;
                        </span>
                      </>
                    )}

                    {item.teacherFinalText && (
                      <>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100/60 dark:bg-emerald-950/60 px-1 rounded">
                          GV chốt: &quot;{item.teacherFinalText}&quot;
                        </span>
                      </>
                    )}
                  </div>

                  {item.teacherNote && (
                    <div className="text-[11px] text-muted-foreground italic">
                      Ghi chú GV: {item.teacherNote}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
