"use client";

import * as React from "react";
import Link from "next/link";
import {
  UsersIcon,
  SearchIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileEditIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  HomeworkAssignmentStudentRosterItem,
  HomeworkSubmissionStatus,
} from "@/modules/homework/domain/homework-types";

export interface HomeworkAssignmentRosterTableProps {
  students: HomeworkAssignmentStudentRosterItem[];
  className?: string;
  isLoading?: boolean;
}

export function HomeworkAssignmentRosterTable({
  students,
  className,
  isLoading = false,
}: HomeworkAssignmentRosterTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredStudents = React.useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.learnerName.toLowerCase().includes(q) ||
        s.learnerEmail.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const renderStatusBadge = (status: HomeworkSubmissionStatus) => {
    switch (status) {
      case "published":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
            <CheckCircle2Icon className="size-3" />
            <span>Đã duyệt</span>
          </Badge>
        );
      case "in_review":
      case "under_review":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]">
            <FileEditIcon className="size-3" />
            <span>Đang chấm</span>
          </Badge>
        );
      case "submitted":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 text-[11px]">
            <ClockIcon className="size-3" />
            <span>Đã nộp bài</span>
          </Badge>
        );
      case "not_submitted":
      default:
        return (
          <Badge
            variant="outline"
            className="text-muted-foreground gap-1 text-[11px]"
          >
            <span>Chưa nộp</span>
          </Badge>
        );
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      data-testid="homework-assignment-roster-table"
      className={cn("flex flex-col gap-3", className)}
    >
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersIcon className="size-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">
            Sĩ số bài nộp ({students.length} học viên)
          </h3>
        </div>

        <div className="relative w-full sm:w-56">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Roster Table */}
      <div className="rounded-lg border border-border/80 bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Đang tải dữ liệu sĩ số nộp bài...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
            <UsersIcon className="size-6 text-muted-foreground/60" />
            <span>
              {searchQuery
                ? "Không tìm thấy học viên phù hợp."
                : "Chưa có học viên nào trong danh sách lớp học."}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground text-[11px] font-semibold uppercase">
                <tr>
                  <th className="py-2 px-3">Học viên</th>
                  <th className="py-2 px-3">Trạng thái nộp bài</th>
                  <th className="py-2 px-3">Thời gian nộp</th>
                  <th className="py-2 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.learnerId}
                    data-testid={`student-row-${student.learnerId}`}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-7">
                          {student.learnerImage && (
                            <AvatarImage
                              src={student.learnerImage}
                              alt={student.learnerName}
                            />
                          )}
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {getInitials(student.learnerName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {student.learnerName}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {student.learnerEmail}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {renderStatusBadge(student.submissionStatus)}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground text-[11px]">
                      {student.submittedAt
                        ? new Intl.DateTimeFormat("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }).format(new Date(student.submittedAt))
                        : "Chưa có lượt nộp"}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {student.submissionId ? (
                        <Link
                          href={`/teacher/submissions/${student.submissionId}`}
                          className={cn(
                            buttonVariants({
                              variant:
                                student.submissionStatus === "published"
                                  ? "outline"
                                  : "default",
                              size: "sm",
                            }),
                            "h-7 text-[11px] px-2.5 gap-1 inline-flex items-center"
                          )}
                        >
                          <FileEditIcon className="size-3" />
                          <span>
                            {student.submissionStatus === "published"
                              ? "Xem bài chấm"
                              : student.submissionStatus === "in_review" ||
                                  student.submissionStatus === "under_review"
                                ? "Tiếp tục chấm"
                                : "Chấm bài"}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
