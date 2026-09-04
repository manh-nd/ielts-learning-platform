"use client";

import * as React from "react";
import { PlusIcon, SchoolIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClassroomCard } from "./classroom-card";
import { CreateClassroomDialog } from "./create-classroom-dialog";
import { ClassroomRosterTable } from "./classroom-roster-table";
import type {
  ClassroomWithMemberCount,
  ClassroomMemberDetail,
} from "@/modules/classroom/domain/classroom-types";

export interface ClassroomManagerProps {
  initialClassrooms?: ClassroomWithMemberCount[];
  initialMembers?: ClassroomMemberDetail[];
  className?: string;
  // Optional mock handlers for Storybook or testing
  onCreateClassroom?: (data: {
    name: string;
    description?: string;
  }) => Promise<ClassroomWithMemberCount>;
  onFetchRoster?: (classroomId: string) => Promise<ClassroomMemberDetail[]>;
  onEnrollMember?: (
    classroomId: string,
    email: string
  ) => Promise<ClassroomMemberDetail>;
  onRemoveMember?: (classroomId: string, learnerId: string) => Promise<void>;
}

export function ClassroomManager({
  initialClassrooms = [],
  initialMembers = [],
  className,
  onCreateClassroom,
  onFetchRoster,
  onEnrollMember,
  onRemoveMember,
}: ClassroomManagerProps) {
  const [classrooms, setClassrooms] =
    React.useState<ClassroomWithMemberCount[]>(initialClassrooms);
  const [selectedClassroomId, setSelectedClassroomId] = React.useState<
    string | null
  >(initialClassrooms.length > 0 ? initialClassrooms[0].id : null);
  const selectedClassroom =
    classrooms.find((c) => c.id === selectedClassroomId) ?? null;
  const [members, setMembers] =
    React.useState<ClassroomMemberDetail[]>(initialMembers);
  const [isLoadingRoster, setIsLoadingRoster] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isEnrolling, setIsEnrolling] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  // Load roster when selected classroom changes
  React.useEffect(() => {
    if (!selectedClassroomId) {
      return;
    }

    // If initialMembers match selectedClassroom on mount, skip fetching
    if (
      initialMembers.length > 0 &&
      initialMembers[0].classroomId === selectedClassroomId
    ) {
      return;
    }

    let isMounted = true;
    const loadRoster = async () => {
      setIsLoadingRoster(true);
      try {
        if (onFetchRoster) {
          const res = await onFetchRoster(selectedClassroomId);
          if (isMounted) setMembers(res);
        } else {
          const res = await fetch(
            `/api/teacher/classrooms/${selectedClassroomId}/members`
          );
          if (res.ok) {
            const data = await res.json();
            if (isMounted) setMembers(data.members || []);
          }
        }
      } catch (err) {
        console.error("[ClassroomManager] Error fetching roster:", err);
      } finally {
        if (isMounted) setIsLoadingRoster(false);
      }
    };

    void loadRoster();

    return () => {
      isMounted = false;
    };
  }, [selectedClassroomId, onFetchRoster, initialMembers]);

  const handleCreateClassroom = async (data: {
    name: string;
    description?: string;
  }) => {
    setIsCreating(true);
    try {
      let newClassroom: ClassroomWithMemberCount;

      if (onCreateClassroom) {
        newClassroom = await onCreateClassroom(data);
      } else {
        const res = await fetch("/api/teacher/classrooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || "Lỗi khi tạo lớp học mới");
        }

        const resData = await res.json();
        newClassroom = {
          ...resData.classroom,
          memberCount: 0,
        };
      }

      setClassrooms((prev) => [newClassroom, ...prev]);
      setSelectedClassroomId(newClassroom.id);
      setMembers([]);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEnrollLearner = async (email: string) => {
    if (!selectedClassroom) return;

    setIsEnrolling(true);
    try {
      let newMember: ClassroomMemberDetail;

      if (onEnrollMember) {
        newMember = await onEnrollMember(selectedClassroom.id, email);
      } else {
        const res = await fetch(
          `/api/teacher/classrooms/${selectedClassroom.id}/members`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData?.error?.message || "Lỗi khi thêm học viên vào lớp"
          );
        }

        const resData = await res.json();
        newMember = resData.member;
      }

      setMembers((prev) => [newMember, ...prev]);
      // Increment count on selected classroom
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === selectedClassroomId
            ? { ...c, memberCount: c.memberCount + 1 }
            : c
        )
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleRemoveLearner = async (learnerId: string) => {
    if (!selectedClassroom) return;

    setRemovingId(learnerId);
    try {
      if (onRemoveMember) {
        await onRemoveMember(selectedClassroom.id, learnerId);
      } else {
        const res = await fetch(
          `/api/teacher/classrooms/${selectedClassroom.id}/members?learnerId=${learnerId}`,
          {
            method: "DELETE",
          }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || "Lỗi khi xóa học viên");
        }
      }

      setMembers((prev) => prev.filter((m) => m.learnerId !== learnerId));
      setClassrooms((prev) =>
        prev.map((c) =>
          c.id === selectedClassroomId
            ? { ...c, memberCount: Math.max(0, c.memberCount - 1) }
            : c
        )
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div
      data-testid="classroom-manager"
      className={cn("flex flex-col gap-6", className)}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SchoolIcon className="size-5 text-primary" />
            <span>Quản lý Lớp học & Sĩ số</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tạo lớp học, quản lý danh sách học viên và tổ chức các nhóm học tập
            cho kì thi IELTS.
          </p>
        </div>

        <CreateClassroomDialog
          onSubmit={handleCreateClassroom}
          isSubmitting={isCreating}
        />
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column: Classrooms List (Master) */}
        <div className="md:col-span-4 lg:col-span-4 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Danh sách lớp ({classrooms.length})
            </h2>
          </div>

          {classrooms.length === 0 ? (
            <div
              data-testid="empty-classrooms-card"
              className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-8 text-center bg-card"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                <SchoolIcon className="size-5" />
              </div>
              <h3 className="font-semibold text-xs text-foreground mb-1">
                Chưa có lớp học nào
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Bắt đầu bằng cách tạo lớp học đầu tiên của bạn.
              </p>
              <CreateClassroomDialog
                onSubmit={handleCreateClassroom}
                isSubmitting={isCreating}
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                  >
                    <PlusIcon className="size-3.5" />
                    <span>Tạo lớp học</span>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {classrooms.map((cls) => (
                <ClassroomCard
                  key={cls.id}
                  classroom={cls}
                  isSelected={selectedClassroom?.id === cls.id}
                  onSelect={(selected) => setSelectedClassroomId(selected.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Classroom Roster (Detail) */}
        <div className="md:col-span-8 lg:col-span-8">
          <ClassroomRosterTable
            classroom={selectedClassroom}
            members={members}
            isLoading={isLoadingRoster}
            isEnrolling={isEnrolling}
            isRemoving={removingId}
            onEnroll={handleEnrollLearner}
            onRemove={handleRemoveLearner}
          />
        </div>
      </div>
    </div>
  );
}
