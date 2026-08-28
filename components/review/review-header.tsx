"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CheckCircle2,
  Sparkles,
  Send,
  ShieldCheck,
  CheckCheck,
  RotateCcw,
} from "lucide-react";

export type AssessmentStatus =
  | "created"
  | "ai_proposal_available"
  | "in_review"
  | "teacher_assessed"
  | "approved"
  | "published";

export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  created: "Chờ chấm",
  ai_proposal_available: "AI Đã Đề Xuất",
  teacher_assessed: "Đã chấm",
  in_review: "Đang Chấm",
  approved: "Đã Duyệt Nội Bộ",
  published: "Đã Công Bố Cho Học Viên",
};

export interface ReviewStudentInfo {
  name: string;
  avatar: string;
  class: string;
  submissionAttempt: number;
  submittedAt: string;
}

export interface ReviewHeaderProps {
  student: ReviewStudentInfo;
  taskType: "TASK_1" | "TASK_2";
  wordCount: number;
  status: AssessmentStatus;
  onQuickApproveAi?: () => void;
  onApproveInternal?: () => void;
  onPublishClick?: () => void;
  onReopenClick?: () => void;
  className?: string;
  centerChildren?: React.ReactNode;
  "data-testid"?: string;
}

export function ReviewHeader({
  student,
  taskType,
  wordCount,
  status,
  onQuickApproveAi,
  onApproveInternal,
  onPublishClick,
  onReopenClick,
  className,
  centerChildren,
  "data-testid": testId = "review-header",
}: ReviewHeaderProps) {
  const isPublished = status === "published";
  const isApproved = status === "approved";

  return (
    <header
      data-testid={testId}
      className={cn(
        "sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md px-4 py-2.5 sm:px-6 sm:py-3",
        className
      )}
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between max-w-[1600px] mx-auto">
        {/* ── Row 1 (Mobile) / Left (Desktop): Student Identity ── */}
        <div className="flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {student.avatar}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-xs sm:text-sm leading-tight truncate">
                  {student.name}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] sm:text-[10px] py-0 px-1.5 font-normal shrink-0"
                >
                  {student.class}
                </Badge>
                <Badge
                  variant={taskType === "TASK_2" ? "default" : "secondary"}
                  className="text-[9px] sm:text-[10px] py-0 px-1.5 shrink-0"
                >
                  {taskType}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground pt-0.5">
                <span className="truncate">Nộp: {student.submittedAt}</span>
                <span>•</span>
                <span className="shrink-0">
                  Lần #{student.submissionAttempt}
                </span>
                <span>•</span>
                <span className="shrink-0 font-medium text-foreground">
                  {wordCount} từ
                </span>
              </div>
            </div>
          </div>

          {/* Status Badge on Mobile right corner */}
          <div className="lg:hidden shrink-0">
            <Badge
              variant={
                isPublished ? "default" : isApproved ? "secondary" : "outline"
              }
              className={cn(
                "gap-1 py-0.5 px-2 text-[10px] font-medium",
                isPublished && "bg-emerald-700 text-white",
                isApproved &&
                  "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200",
                status === "in_review" &&
                  "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200"
              )}
            >
              {isPublished ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : isApproved ? (
                <ShieldCheck className="h-3 w-3 text-purple-600" />
              ) : (
                <Sparkles className="h-3 w-3 text-amber-500" />
              )}
              {isPublished
                ? "Đã Công Bố"
                : isApproved
                  ? "Đã Duyệt"
                  : status === "in_review"
                    ? "Đang Chấm"
                    : "AI Đã Đề Xuất"}
            </Badge>
          </div>
        </div>

        {/* ── Row 2 (Mobile) / Center (Desktop): Optional Center Controls ── */}
        {centerChildren && (
          <div className="flex items-center justify-start lg:justify-center overflow-x-auto py-0.5">
            {centerChildren}
          </div>
        )}

        {/* ── Row 3 (Mobile) / Right (Desktop): Actions & Desktop Status ── */}
        <div className="flex items-center justify-between lg:justify-end gap-2 pt-1 lg:pt-0 border-t lg:border-t-0 border-border/60">
          {/* Status Badge (Desktop Only) */}
          <Badge
            variant={
              isPublished ? "default" : isApproved ? "secondary" : "outline"
            }
            className={cn(
              "hidden lg:inline-flex gap-1 py-1 px-2.5 text-xs font-medium shrink-0",
              isPublished && "bg-emerald-700 text-white",
              isApproved &&
                "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200",
              status === "in_review" &&
                "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200"
            )}
          >
            {isPublished ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : isApproved ? (
              <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            )}
            {STATUS_LABELS[status]}
          </Badge>

          {/* Action Buttons Group */}
          <div className="flex items-center gap-1.5 w-full lg:w-auto justify-end">
            {!isPublished && !isApproved && (
              <Button
                variant="outline"
                size="xs"
                onClick={onQuickApproveAi}
                className="text-[11px] sm:text-xs gap-1 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:hover:bg-emerald-950/50 shrink-0"
              >
                <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Apply đề xuất AI</span>
              </Button>
            )}

            {!isPublished && !isApproved && (
              <Button
                variant="secondary"
                size="xs"
                onClick={onApproveInternal}
                className="text-[11px] sm:text-xs gap-1 shrink-0"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Duyệt nội bộ</span>
              </Button>
            )}

            {!isPublished ? (
              <Button
                variant="default"
                size="xs"
                onClick={onPublishClick}
                className="text-[11px] sm:text-xs gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-medium shrink-0 ml-auto lg:ml-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Công bố kết quả</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="xs"
                onClick={onReopenClick}
                className="text-[11px] sm:text-xs gap-1 text-muted-foreground shrink-0"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Mở lại để sửa</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
