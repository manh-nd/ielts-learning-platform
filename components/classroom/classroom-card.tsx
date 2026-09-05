"use client";

import * as React from "react";
import { UsersIcon, CalendarIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { ClassroomWithMemberCount } from "@/modules/classroom/application/classroom-read-models";

export interface ClassroomCardProps {
  classroom: ClassroomWithMemberCount;
  isSelected?: boolean;
  onSelect?: (classroom: ClassroomWithMemberCount) => void;
  className?: string;
}

export function ClassroomCard({
  classroom,
  isSelected = false,
  onSelect,
  className,
}: ClassroomCardProps) {
  const formattedDate = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(classroom.createdAt));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(classroom);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`classroom-card-${classroom.id}`}
      aria-pressed={isSelected}
      onClick={() => onSelect?.(classroom)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex flex-col justify-between gap-3 rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
          : "border-border/60 bg-card hover:border-primary/40 hover:bg-accent/40",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0 flex-1">
          <h3
            data-testid="classroom-card-title"
            className={cn(
              "font-semibold text-sm leading-snug truncate",
              isSelected
                ? "text-primary"
                : "text-foreground group-hover:text-primary transition-colors"
            )}
          >
            {classroom.name}
          </h3>
          {classroom.description ? (
            <p
              className={cn(
                "text-xs line-clamp-2 leading-relaxed",
                isSelected ? "text-foreground/85" : "text-muted-foreground"
              )}
            >
              {classroom.description}
            </p>
          ) : (
            <p
              className={cn(
                "text-xs italic",
                isSelected ? "text-foreground/75" : "text-muted-foreground"
              )}
            >
              Chưa có mô tả
            </p>
          )}
        </div>
        <ChevronRightIcon
          className={cn(
            "size-4 shrink-0 transition-transform duration-150",
            isSelected
              ? "text-primary translate-x-0.5"
              : "text-muted-foreground/60 group-hover:translate-x-0.5 group-hover:text-muted-foreground"
          )}
        />
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <UsersIcon className="size-3.5 text-primary" />
          <Badge
            variant={classroom.memberCount > 0 ? "secondary" : "outline"}
            className="text-[11px] px-1.5 py-0 h-5"
          >
            {classroom.memberCount} học viên
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-foreground/80 font-medium">
          <CalendarIcon className="size-3" />
          <span>{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}
