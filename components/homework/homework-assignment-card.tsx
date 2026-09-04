"use client";

import {
  CalendarIcon,
  ClockIcon,
  MicIcon,
  SendIcon,
  ArchiveIcon,
  Trash2Icon,
  ChevronRightIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HomeworkAssignment } from "@/modules/homework/domain/homework-types";

export interface HomeworkAssignmentCardProps {
  assignment: HomeworkAssignment;
  className?: string;
  onViewDetails?: (assignment: HomeworkAssignment) => void;
  onPublish?: (assignmentId: string) => Promise<void> | void;
  onArchive?: (assignmentId: string) => Promise<void> | void;
  onDeleteDraft?: (assignmentId: string) => Promise<void> | void;
  isActionLoading?: boolean;
}

export function HomeworkAssignmentCard({
  assignment,
  className,
  onViewDetails,
  onPublish,
  onArchive,
  onDeleteDraft,
  isActionLoading = false,
}: HomeworkAssignmentCardProps) {
  const deadlineDate = new Date(assignment.submissionDeadline);
  const now = new Date();
  const isPastDeadline = deadlineDate.getTime() < now.getTime();

  // Part numbers breakdown
  const partNumbers = Array.from(
    new Set(assignment.prompts.map((p) => `Part ${p.partNumber}`))
  ).join(", ");

  const formatDeadline = (d: Date) => {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  };

  return (
    <Card
      data-testid={`assignment-card-${assignment.id}`}
      className={cn(
        "p-4 transition-all duration-150 hover:shadow-xs border-border/80 flex flex-col justify-between gap-3.5 bg-card",
        assignment.status === "archived" && "border-dashed bg-muted/30",
        className
      )}
    >
      {/* Top Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {assignment.status === "published" && (
              <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 gap-1 text-[11px] font-semibold">
                <CheckCircle2Icon className="size-3 text-emerald-700 dark:text-emerald-300" />
                <span>Đã giao</span>
              </Badge>
            )}

            {assignment.status === "draft" && (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800 gap-1 text-[11px] font-semibold"
              >
                <ClockIcon className="size-3 text-amber-700 dark:text-amber-300" />
                <span>Bản nháp</span>
              </Badge>
            )}

            {assignment.status === "archived" && (
              <Badge
                variant="outline"
                className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-700 gap-1 text-[11px] font-semibold"
              >
                <ArchiveIcon className="size-3" />
                <span>Đã lưu trữ</span>
              </Badge>
            )}

            <Badge
              variant="outline"
              className="text-[10px] text-foreground/80 font-mono border-border"
            >
              {assignment.prompts.length} câu hỏi ({partNumbers})
            </Badge>
          </div>

          {/* Submission Deadline Indicator */}
          <div
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md",
              isPastDeadline
                ? "text-rose-900 bg-rose-100 dark:text-rose-200 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900"
                : "text-foreground/80 bg-muted border border-border/50"
            )}
          >
            {isPastDeadline ? (
              <AlertTriangleIcon className="size-3 text-rose-700 dark:text-rose-300" />
            ) : (
              <CalendarIcon className="size-3 text-muted-foreground" />
            )}
            <span>
              {isPastDeadline ? "Đã qua hạn: " : "Hạn: "}
              {formatDeadline(deadlineDate)}
            </span>
          </div>
        </div>

        {/* Title & Instructions */}
        <div>
          <h4 className="text-sm font-semibold text-foreground tracking-tight line-clamp-1">
            {assignment.title}
          </h4>
          {assignment.instructions && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {assignment.instructions}
            </p>
          )}
        </div>
      </div>

      {/* Prompts list preview */}
      <div className="flex flex-col gap-1.5 rounded-lg bg-muted/30 p-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
          <MicIcon className="size-3 text-primary" />
          <span>Danh sách câu hỏi:</span>
        </div>
        <div className="space-y-1">
          {assignment.prompts.map((prompt, idx) => (
            <div
              key={prompt.promptId || idx}
              className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
            >
              <span className="font-semibold text-foreground shrink-0">
                P{prompt.partNumber}.
              </span>
              <span className="line-clamp-1">{prompt.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Card Actions */}
      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2.5">
        <div className="flex items-center gap-1.5">
          {assignment.status === "draft" && onPublish && (
            <Button
              variant="outline"
              size="sm"
              disabled={isActionLoading}
              onClick={() => onPublish(assignment.id)}
              className="h-7 text-xs gap-1 text-emerald-900 dark:text-emerald-200 border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 font-semibold"
            >
              <SendIcon className="size-3 text-emerald-700 dark:text-emerald-300" />
              <span>Giao bài</span>
            </Button>
          )}

          {assignment.status === "draft" && onDeleteDraft && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isActionLoading}
              onClick={() => onDeleteDraft(assignment.id)}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2Icon className="size-3" />
              <span>Xóa nháp</span>
            </Button>
          )}

          {assignment.status === "published" && onArchive && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isActionLoading}
              onClick={() => onArchive(assignment.id)}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <ArchiveIcon className="size-3" />
              <span>Lưu trữ</span>
            </Button>
          )}
        </div>

        {onViewDetails && (
          <Button
            variant="default"
            size="sm"
            data-testid={`view-assignment-details-${assignment.id}`}
            onClick={() => onViewDetails(assignment)}
            className="h-7 text-xs gap-1"
          >
            <span>Chi tiết & Nộp bài</span>
            <ChevronRightIcon className="size-3" />
          </Button>
        )}
      </div>
    </Card>
  );
}
