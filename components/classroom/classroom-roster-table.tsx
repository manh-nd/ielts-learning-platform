"use client";

import * as React from "react";
import {
  UserPlusIcon,
  Trash2Icon,
  Loader2Icon,
  UsersIcon,
  MailIcon,
  CalendarIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { EditClassroomDialog } from "./edit-classroom-dialog";
import type {
  ClassroomWithMemberCount,
  ClassroomMemberDetail,
} from "@/modules/classroom/domain/classroom-types";

export interface ClassroomRosterTableProps {
  classroom: ClassroomWithMemberCount | null;
  members: ClassroomMemberDetail[];
  isLoading?: boolean;
  isEnrolling?: boolean;
  isRemoving?: string | null;
  onEnroll: (email: string) => Promise<void>;
  onRemove?: (learnerId: string) => Promise<void>;
  onUpdateClassroom?: (data: {
    name: string;
    description?: string | null;
  }) => Promise<void>;
  className?: string;
}

export function ClassroomRosterTable({
  classroom,
  members,
  isLoading = false,
  isEnrolling = false,
  isRemoving = null,
  onEnroll,
  onRemove,
  onUpdateClassroom,
  className,
}: ClassroomRosterTableProps) {
  const [emailInput, setEmailInput] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null
  );
  const [memberToRemove, setMemberToRemove] =
    React.useState<ClassroomMemberDetail | null>(null);
  const [isUpdatingClassroom, setIsUpdatingClassroom] = React.useState(false);

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmed = emailInput.trim();
    if (!trimmed) {
      setErrorMessage("Vui lòng nhập địa chỉ email học viên.");
      return;
    }

    try {
      await onEnroll(trimmed);
      setEmailInput("");
      setSuccessMessage(`Đã thêm thành công học viên ${trimmed} vào lớp.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message ||
          "Không thể thêm học viên. Vui lòng kiểm tra lại email."
      );
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove || !onRemove) return;
    try {
      await onRemove(memberToRemove.learnerId);
      setMemberToRemove(null);
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message || "Không thể xóa học viên khỏi lớp học."
      );
    }
  };

  if (!classroom) {
    return (
      <div
        data-testid="roster-no-selection"
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-12 text-center bg-card/50 min-h-[360px]",
          className
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
          <UsersIcon className="size-6" />
        </div>
        <h2 className="font-semibold text-sm text-foreground mb-1">
          Chưa chọn lớp học
        </h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          Vui lòng chọn một lớp học từ danh sách bên trái để quản lý danh sách
          học viên và sĩ số.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="classroom-roster-view"
      className={cn(
        "flex flex-col rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs",
        className
      )}
    >
      {/* Classroom Header */}
      <div className="border-b border-border/50 bg-muted/20 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2
                data-testid="roster-classroom-title"
                className="text-base font-bold text-foreground"
              >
                {classroom.name}
              </h2>
              <Badge variant="secondary" className="text-xs">
                {members.length} học viên
              </Badge>
            </div>
            {classroom.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {classroom.description}
              </p>
            )}
          </div>

          {onUpdateClassroom && (
            <div className="shrink-0">
              <EditClassroomDialog
                classroom={classroom}
                isSubmitting={isUpdatingClassroom}
                onSubmit={async (data) => {
                  setIsUpdatingClassroom(true);
                  try {
                    await onUpdateClassroom(data);
                    setSuccessMessage(
                      "Đã cập nhật thông tin lớp học thành công."
                    );
                    setTimeout(() => setSuccessMessage(null), 3000);
                  } finally {
                    setIsUpdatingClassroom(false);
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Inline Enrollment Toolbar */}
        <form
          onSubmit={handleEnrollSubmit}
          className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3 border-t border-border/40"
        >
          <div className="relative flex-1">
            <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              data-testid="enroll-learner-email-input"
              type="email"
              placeholder="Nhập email học viên đã có tài khoản (vd: student@example.com)..."
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={isEnrolling}
              className="pl-9 h-9 text-xs"
              required
            />
          </div>
          <Button
            type="submit"
            data-testid="enroll-learner-submit-btn"
            variant="default"
            size="sm"
            disabled={isEnrolling || !emailInput.trim()}
            className="gap-1.5 h-9 shrink-0"
          >
            {isEnrolling ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                <span>Đang thêm...</span>
              </>
            ) : (
              <>
                <UserPlusIcon className="size-4" />
                <span>Thêm học viên</span>
              </>
            )}
          </Button>
        </form>

        {/* Feedback Messages */}
        {errorMessage && (
          <Alert variant="destructive" className="mt-3 py-2 text-xs">
            <AlertCircleIcon className="size-4" />
            <AlertDescription
              data-testid="roster-error-message"
              className="text-destructive font-medium"
            >
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mt-3 py-2 text-xs border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
            <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
            <AlertDescription
              data-testid="roster-success-message"
              className="text-emerald-800 dark:text-emerald-200 font-medium"
            >
              {successMessage}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Roster Table Content */}
      <div className="relative min-h-[220px]">
        {isLoading ? (
          <div
            data-testid="roster-loading-indicator"
            className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-2"
          >
            <Loader2Icon className="size-6 animate-spin text-primary" />
            <span className="text-xs">Đang tải danh sách học viên...</span>
          </div>
        ) : members.length === 0 ? (
          <div
            data-testid="roster-empty-state"
            className="flex flex-col items-center justify-center p-12 text-center"
          >
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
              <UsersIcon className="size-5" />
            </div>
            <h3 className="font-semibold text-xs text-foreground mb-1">
              Lớp học chưa có học viên
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Sử dụng ô nhập email ở trên để ghi danh học viên vào lớp học này.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 bg-muted/15 text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Học viên</th>
                  <th className="py-2.5 px-4 font-medium">Email</th>
                  <th className="py-2.5 px-4 font-medium">Ngày tham gia</th>
                  <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {members.map((member) => {
                  if (!member) return null;

                  const initials = member.learnerName
                    ? member.learnerName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "HV";

                  const joinDate = new Intl.DateTimeFormat("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }).format(new Date(member.joinedAt));

                  const isBeingRemoved = isRemoving === member.learnerId;

                  return (
                    <tr
                      key={member.id}
                      data-testid={`roster-row-${member.learnerId}`}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-7">
                            <AvatarImage
                              src={member.learnerImage || undefined}
                              alt={member.learnerName}
                            />
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-foreground">
                            {member.learnerName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                        {member.learnerEmail}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="size-3 text-muted-foreground/70" />
                          <span>{joinDate}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0"
                        >
                          Hoạt động
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {onRemove && (
                          <Button
                            data-testid={`remove-member-btn-${member.learnerId}`}
                            variant="ghost"
                            size="icon-sm"
                            disabled={isBeingRemoved}
                            onClick={() => setMemberToRemove(member)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Xóa khỏi lớp học"
                          >
                            {isBeingRemoved ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2Icon className="size-3.5" />
                            )}
                            <span className="sr-only">
                              Xóa {member.learnerName} khỏi lớp
                            </span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shadcn AlertDialog for Member Removal Confirmation */}
      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent data-testid="remove-member-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="remove-member-dialog-title">
              Xóa học viên khỏi lớp học
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="remove-member-dialog-description">
              Bạn có chắc chắn muốn xóa học viên{" "}
              <strong>{memberToRemove?.learnerName}</strong> (
              {memberToRemove?.learnerEmail}) khỏi lớp học này? Hành động này sẽ
              hủy tư cách thành viên nhưng vẫn giữ nguyên tài khoản và lịch sử
              bài nộp của học viên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="remove-member-dialog-cancel">
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="remove-member-dialog-confirm"
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={isRemoving === memberToRemove?.learnerId}
            >
              {isRemoving === memberToRemove?.learnerId ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin mr-1.5" />
                  <span>Đang xóa...</span>
                </>
              ) : (
                <span>Xác nhận xóa</span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
