"use client";

import * as React from "react";
import {
  BookOpenIcon,
  PlusIcon,
  CheckCircle2Icon,
  ClockIcon,
  ArchiveIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HomeworkAssignmentCard } from "./homework-assignment-card";
import { HomeworkAssignmentCreationDialog } from "./homework-assignment-creation-dialog";
import { HomeworkAssignmentDetailDialog } from "./homework-assignment-detail-dialog";
import type {
  HomeworkAssignment,
  HomeworkAssignmentDetail,
  CreateHomeworkAssignmentInput,
  HomeworkAssignmentStatus,
} from "@/modules/homework/domain/homework-types";

export interface HomeworkAssignmentListProps {
  classroomId: string;
  classroomName: string;
  assignments?: HomeworkAssignment[];
  isLoading?: boolean;
  className?: string;
  onCreateAssignment?: (data: CreateHomeworkAssignmentInput) => Promise<void>;
  onPublishAssignment?: (assignmentId: string) => Promise<void> | void;
  onArchiveAssignment?: (assignmentId: string) => Promise<void> | void;
  onDeleteDraftAssignment?: (assignmentId: string) => Promise<void> | void;
  onFetchAssignmentDetails?: (
    assignmentId: string
  ) => Promise<HomeworkAssignmentDetail>;
}

export function HomeworkAssignmentList({
  classroomId,
  classroomName,
  assignments = [],
  isLoading = false,
  className,
  onCreateAssignment,
  onPublishAssignment,
  onArchiveAssignment,
  onDeleteDraftAssignment,
  onFetchAssignmentDetails,
}: HomeworkAssignmentListProps) {
  const [activeFilter, setActiveFilter] = React.useState<
    "all" | HomeworkAssignmentStatus
  >("all");
  const [selectedAssignment, setSelectedAssignment] =
    React.useState<HomeworkAssignment | null>(null);
  const [selectedDetail, setSelectedDetail] =
    React.useState<HomeworkAssignmentDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(
    null
  );

  const publishedCount = assignments.filter(
    (a) => a.status === "published"
  ).length;
  const draftCount = assignments.filter((a) => a.status === "draft").length;
  const archivedCount = assignments.filter(
    (a) => a.status === "archived"
  ).length;

  const filteredAssignments = React.useMemo(() => {
    if (activeFilter === "all") return assignments;
    return assignments.filter((a) => a.status === activeFilter);
  }, [assignments, activeFilter]);

  const handleViewDetails = async (assignment: HomeworkAssignment) => {
    setSelectedAssignment(assignment);
    setIsDetailOpen(true);

    if (onFetchAssignmentDetails) {
      setIsLoadingDetail(true);
      try {
        const detail = await onFetchAssignmentDetails(assignment.id);
        setSelectedDetail(detail);
      } catch (err) {
        console.error(
          "[HomeworkAssignmentList] Error fetching assignment details:",
          err
        );
      } finally {
        setIsLoadingDetail(false);
      }
    }
  };

  const handlePublish = async (assignmentId: string) => {
    if (!onPublishAssignment) return;
    setActionLoadingId(assignmentId);
    try {
      await onPublishAssignment(assignmentId);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleArchive = async (assignmentId: string) => {
    if (!onArchiveAssignment) return;
    setActionLoadingId(assignmentId);
    try {
      await onArchiveAssignment(assignmentId);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteDraft = async (assignmentId: string) => {
    if (!onDeleteDraftAssignment) return;
    setActionLoadingId(assignmentId);
    try {
      await onDeleteDraftAssignment(assignmentId);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div
      data-testid="homework-assignment-list"
      data-classroom-id={classroomId}
      className={cn("flex flex-col gap-4", className)}
    >
      {/* List Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BookOpenIcon className="size-4 text-primary" />
            <span>Bài tập Speaking ({classroomName})</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Quản lý các bài tập Speaking discrete (1–3 câu hỏi) đã giao cho lớp.
          </p>
        </div>

        {onCreateAssignment && (
          <HomeworkAssignmentCreationDialog
            classroomName={classroomName}
            onSubmit={onCreateAssignment}
          />
        )}
      </div>

      {/* Filter Tabs */}
      <Tabs
        value={activeFilter}
        onValueChange={(val) =>
          setActiveFilter(val as "all" | HomeworkAssignmentStatus)
        }
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 w-full sm:w-96 h-8 p-0.5">
          <TabsTrigger value="all" className="text-xs">
            Tất cả ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="published" className="text-xs gap-1">
            <CheckCircle2Icon className="size-3 text-emerald-600" />
            <span>Đã giao ({publishedCount})</span>
          </TabsTrigger>
          <TabsTrigger value="draft" className="text-xs gap-1">
            <ClockIcon className="size-3 text-amber-600" />
            <span>Nháp ({draftCount})</span>
          </TabsTrigger>
          <TabsTrigger value="archived" className="text-xs gap-1">
            <ArchiveIcon className="size-3 text-muted-foreground" />
            <span>Lưu trữ ({archivedCount})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Assignments Container */}
      {isLoading ? (
        <div className="rounded-xl border border-border/80 p-8 text-center text-xs text-muted-foreground bg-card">
          Đang tải danh sách bài tập...
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div
          data-testid="empty-assignments-card"
          className="rounded-xl border border-dashed border-border/80 p-8 text-center flex flex-col items-center justify-center gap-2.5 bg-card"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpenIcon className="size-5" />
          </div>
          <h4 className="font-semibold text-xs text-foreground">
            {activeFilter === "all"
              ? "Chưa có bài tập nào"
              : `Không có bài tập nào ở trạng thái "${activeFilter}".`}
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            Tạo bài tập Speaking discrete để học viên làm bài và gửi bản ghi âm
            cho giáo viên chấm chữa.
          </p>

          {onCreateAssignment && (
            <HomeworkAssignmentCreationDialog
              classroomName={classroomName}
              onSubmit={onCreateAssignment}
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 mt-2"
                >
                  <PlusIcon className="size-3.5" />
                  <span>Tạo bài tập đầu tiên</span>
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredAssignments.map((assignment) => (
            <HomeworkAssignmentCard
              key={assignment.id}
              assignment={assignment}
              isActionLoading={actionLoadingId === assignment.id}
              onViewDetails={handleViewDetails}
              onPublish={handlePublish}
              onArchive={handleArchive}
              onDeleteDraft={handleDeleteDraft}
            />
          ))}
        </div>
      )}

      {/* Assignment Detail & Roster Dialog */}
      <HomeworkAssignmentDetailDialog
        assignment={selectedAssignment}
        classroomName={classroomName}
        students={selectedDetail?.students || []}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        isLoading={isLoadingDetail}
      />
    </div>
  );
}
