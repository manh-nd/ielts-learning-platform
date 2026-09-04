import { Badge } from "@/components/ui/badge";
import { CheckCircle2Icon, ClockIcon, ArchiveIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeworkAssignmentStatus } from "@/modules/homework/domain/homework-types";

export interface HomeworkAssignmentStatusBadgeProps {
  status: HomeworkAssignmentStatus;
  className?: string;
  showIcon?: boolean;
}

export function HomeworkAssignmentStatusBadge({
  status,
  className,
  showIcon = true,
}: HomeworkAssignmentStatusBadgeProps) {
  switch (status) {
    case "published":
      return (
        <Badge
          className={cn(
            "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 gap-1 text-[11px] font-semibold",
            className
          )}
        >
          {showIcon && (
            <CheckCircle2Icon className="size-3 text-emerald-700 dark:text-emerald-300" />
          )}
          <span>Đã giao</span>
        </Badge>
      );

    case "draft":
      return (
        <Badge
          variant="secondary"
          className={cn(
            "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800 gap-1 text-[11px] font-semibold",
            className
          )}
        >
          {showIcon && (
            <ClockIcon className="size-3 text-amber-700 dark:text-amber-300" />
          )}
          <span>Bản nháp</span>
        </Badge>
      );

    case "archived":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-700 gap-1 text-[11px] font-semibold",
            className
          )}
        >
          {showIcon && <ArchiveIcon className="size-3" />}
          <span>Đã lưu trữ</span>
        </Badge>
      );

    default:
      return null;
  }
}
