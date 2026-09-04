"use client";

import {
  MicIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  ArchiveIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { HomeworkAssignmentRosterTable } from "./homework-assignment-roster-table";
import type {
  HomeworkAssignment,
  HomeworkAssignmentStudentRosterItem,
} from "@/modules/homework/domain/homework-types";

export interface HomeworkAssignmentDetailDialogProps {
  assignment: HomeworkAssignment | null;
  classroomName?: string;
  students?: HomeworkAssignmentStudentRosterItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isLoading?: boolean;
}

export function HomeworkAssignmentDetailDialog({
  assignment,
  classroomName,
  students = [],
  open,
  onOpenChange,
  isLoading = false,
}: HomeworkAssignmentDetailDialogProps) {
  if (!assignment) return null;

  const deadlineDate = new Date(assignment.submissionDeadline);
  const formattedDeadline = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(deadlineDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            {assignment.status === "published" && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                <CheckCircle2Icon className="size-3" />
                <span>Đã giao</span>
              </Badge>
            )}
            {assignment.status === "draft" && (
              <Badge
                variant="secondary"
                className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]"
              >
                <ClockIcon className="size-3" />
                <span>Bản nháp</span>
              </Badge>
            )}
            {assignment.status === "archived" && (
              <Badge
                variant="outline"
                className="text-muted-foreground gap-1 text-[11px]"
              >
                <ArchiveIcon className="size-3" />
                <span>Đã lưu trữ</span>
              </Badge>
            )}

            <span className="text-xs text-muted-foreground">
              {classroomName ? `Lớp: ${classroomName}` : ""}
            </span>
          </div>

          <DialogTitle className="text-base font-bold text-foreground">
            {assignment.title}
          </DialogTitle>

          <DialogDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarIcon className="size-3.5 text-primary" />
            <span>Hạn nộp bài: {formattedDeadline}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Instructions */}
          {assignment.instructions && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs flex flex-col gap-1">
              <span className="font-semibold text-foreground/90">
                Hướng dẫn làm bài:
              </span>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {assignment.instructions}
              </p>
            </div>
          )}

          {/* Prompts list */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <MicIcon className="size-3.5 text-primary" />
              <span>Nội dung đề bài ({assignment.prompts.length} câu hỏi)</span>
            </div>

            <div className="flex flex-col gap-2">
              {assignment.prompts.map((prompt, idx) => (
                <div
                  key={prompt.promptId || idx}
                  className="rounded-lg border border-border/70 p-3 bg-card/60 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold"
                    >
                      Part {prompt.partNumber}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      Câu hỏi {idx + 1}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    {prompt.text}
                  </p>

                  {prompt.partNumber === 2 && prompt.subPrompts && (
                    <div className="mt-1 rounded bg-muted/30 p-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground/80 block mb-0.5">
                        Gợi ý chi tiết:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {prompt.subPrompts.map((sub, sIdx) => (
                          <li key={sIdx}>{sub}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Student Submissions Roster */}
          <div className="border-t border-border/50 pt-4">
            <HomeworkAssignmentRosterTable
              students={students}
              isLoading={isLoading}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
