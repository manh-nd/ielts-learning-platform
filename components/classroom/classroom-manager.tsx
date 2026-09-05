"use client";

import * as React from "react";
import { PlusIcon, SchoolIcon, UsersIcon, BookOpenIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ClassroomCard } from "./classroom-card";
import { CreateClassroomDialog } from "./create-classroom-dialog";
import { ClassroomRosterTable } from "./classroom-roster-table";
import { HomeworkAssignmentList } from "@/components/homework/homework-assignment-list";
import type {
  ClassroomWithMemberCount,
  ClassroomRosterItem,
} from "@/modules/classroom/application/classroom-read-models";
import type { HomeworkAssignment } from "@/modules/homework/domain/homework-types";
import type { CreateHomeworkAssignmentInput } from "@/modules/homework/application/homework-inputs";
import type { HomeworkAssignmentDetail } from "@/modules/homework/application/homework-read-models";

export interface ClassroomManagerProps {
  initialClassrooms?: ClassroomWithMemberCount[];
  initialMembers?: ClassroomRosterItem[];
  initialAssignments?: HomeworkAssignment[];
  className?: string;
  // Optional mock handlers for Storybook or testing
  onCreateClassroom?: (data: {
    name: string;
    description?: string;
  }) => Promise<ClassroomWithMemberCount>;
  onFetchRoster?: (classroomId: string) => Promise<ClassroomRosterItem[]>;
  onEnrollMember?: (
    classroomId: string,
    email: string
  ) => Promise<ClassroomRosterItem>;
  onRemoveMember?: (classroomId: string, learnerId: string) => Promise<void>;
  onUpdateClassroom?: (
    classroomId: string,
    data: { name: string; description?: string | null }
  ) => Promise<ClassroomWithMemberCount>;
  // Homework Assignment handlers
  onCreateAssignment?: (
    classroomId: string,
    data: CreateHomeworkAssignmentInput
  ) => Promise<HomeworkAssignment>;
  onFetchAssignments?: (classroomId: string) => Promise<HomeworkAssignment[]>;
  onPublishAssignment?: (assignmentId: string) => Promise<void>;
  onArchiveAssignment?: (assignmentId: string) => Promise<void>;
  onDeleteDraftAssignment?: (assignmentId: string) => Promise<void>;
  onFetchAssignmentDetails?: (
    assignmentId: string
  ) => Promise<HomeworkAssignmentDetail>;
}

export function ClassroomManager({
  initialClassrooms = [],
  initialMembers = [],
  initialAssignments = [],
  className,
  onCreateClassroom,
  onFetchRoster,
  onEnrollMember,
  onRemoveMember,
  onUpdateClassroom,
  onCreateAssignment,
  onFetchAssignments,
  onPublishAssignment,
  onArchiveAssignment,
  onDeleteDraftAssignment,
  onFetchAssignmentDetails,
}: ClassroomManagerProps) {
  const [classrooms, setClassrooms] =
    React.useState<ClassroomWithMemberCount[]>(initialClassrooms);
  const [selectedClassroomId, setSelectedClassroomId] = React.useState<
    string | null
  >(initialClassrooms.length > 0 ? initialClassrooms[0].id : null);
  const selectedClassroom =
    classrooms.find((c) => c.id === selectedClassroomId) ?? null;
  const [members, setMembers] =
    React.useState<ClassroomRosterItem[]>(initialMembers);
  const [assignments, setAssignments] =
    React.useState<HomeworkAssignment[]>(initialAssignments);

  const [activeDetailTab, setActiveDetailTab] = React.useState<
    "roster" | "homework"
  >("roster");

  const [isLoadingRoster, setIsLoadingRoster] = React.useState(false);
  const [isLoadingAssignments, setIsLoadingAssignments] = React.useState(false);
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

  // Load assignments when selected classroom changes or tab switches to homework
  React.useEffect(() => {
    if (!selectedClassroomId) {
      return;
    }

    let isMounted = true;
    const loadAssignments = async () => {
      setIsLoadingAssignments(true);
      try {
        if (onFetchAssignments) {
          const res = await onFetchAssignments(selectedClassroomId);
          if (isMounted) setAssignments(res);
        } else {
          const res = await fetch(
            `/api/teacher/classrooms/${selectedClassroomId}/assignments`
          );
          if (res.ok) {
            const data = await res.json();
            if (isMounted) setAssignments(data.assignments || []);
          }
        }
      } catch (err) {
        console.error("[ClassroomManager] Error fetching assignments:", err);
      } finally {
        if (isMounted) setIsLoadingAssignments(false);
      }
    };

    void loadAssignments();

    return () => {
      isMounted = false;
    };
  }, [selectedClassroomId, onFetchAssignments]);

  const handleCreateClassroom = async (data: {
    name: string;
    description?: string;
  }) => {
    setIsCreating(true);
    try {
      let created: ClassroomWithMemberCount | undefined;
      if (onCreateClassroom) {
        created = await onCreateClassroom(data);
      } else {
        const res = await fetch("/api/teacher/classrooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || "Lỗi khi tạo lớp học");
        }

        const resData = await res.json();
        if (resData?.classroom) {
          created = {
            ...resData.classroom,
            memberCount: 0,
          };
        }
      }

      if (!created || !created.id) {
        created = {
          id: crypto.randomUUID(),
          teacherId: "current_user",
          name: data.name,
          description: data.description || null,
          memberCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      const finalCreated = created;
      setClassrooms((prev) => [finalCreated, ...prev]);
      setSelectedClassroomId(finalCreated.id);
      setMembers([]);
      setAssignments([]);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEnrollLearner = async (email: string) => {
    if (!selectedClassroom) return;

    setIsEnrolling(true);
    try {
      let newMember: ClassroomRosterItem | undefined;
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
          throw new Error(errData?.error?.message || "Lỗi khi thêm học viên");
        }

        const resData = await res.json();
        newMember = resData.member;
      }

      if (newMember) {
        setMembers((prev) => [...prev, newMember!]);
      }

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

  const handleUpdateClassroom = async (data: {
    name: string;
    description?: string | null;
  }) => {
    if (!selectedClassroom) return;

    let updated: ClassroomWithMemberCount | undefined;

    if (onUpdateClassroom) {
      updated = await onUpdateClassroom(selectedClassroom.id, data);
    } else {
      const res = await fetch(
        `/api/teacher/classrooms/${selectedClassroom.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Lỗi khi cập nhật lớp học");
      }

      const resData = await res.json();
      if (resData?.classroom) {
        updated = {
          ...resData.classroom,
          memberCount: selectedClassroom.memberCount,
        };
      }
    }

    if (!updated || !updated.id) {
      updated = {
        ...selectedClassroom,
        name: data.name,
        description:
          data.description !== undefined
            ? data.description
            : selectedClassroom.description,
        updatedAt: new Date(),
      };
    }

    const finalUpdated = updated;
    setClassrooms((prev) =>
      prev.map((cls) => (cls.id === finalUpdated.id ? finalUpdated : cls))
    );
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

  // Homework Handlers
  const handleCreateAssignment = async (
    data: CreateHomeworkAssignmentInput
  ) => {
    if (!selectedClassroom) return;

    let created: HomeworkAssignment | undefined;
    if (onCreateAssignment) {
      created = await onCreateAssignment(selectedClassroom.id, data);
    } else {
      const res = await fetch(
        `/api/teacher/classrooms/${selectedClassroom.id}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Lỗi khi tạo bài tập");
      }

      const resData = await res.json();
      created = resData.assignment;
    }

    if (created) {
      setAssignments((prev) => [created!, ...prev]);
    }
  };

  const handlePublishAssignment = async (assignmentId: string) => {
    if (onPublishAssignment) {
      await onPublishAssignment(assignmentId);
    } else {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Lỗi khi giao bài tập");
      }
    }

    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId ? { ...a, status: "published" } : a
      )
    );
  };

  const handleArchiveAssignment = async (assignmentId: string) => {
    if (onArchiveAssignment) {
      await onArchiveAssignment(assignmentId);
    } else {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Lỗi khi lưu trữ bài tập");
      }
    }

    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId ? { ...a, status: "archived" } : a
      )
    );
  };

  const handleDeleteDraftAssignment = async (assignmentId: string) => {
    if (onDeleteDraftAssignment) {
      await onDeleteDraftAssignment(assignmentId);
    } else {
      const res = await fetch(`/api/teacher/assignments/${assignmentId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData?.error?.message || "Lỗi khi xóa bài tập bản nháp"
        );
      }
    }

    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
  };

  const handleFetchAssignmentDetails = async (assignmentId: string) => {
    if (onFetchAssignmentDetails) {
      return await onFetchAssignmentDetails(assignmentId);
    }

    const res = await fetch(`/api/teacher/assignments/${assignmentId}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData?.error?.message || "Lỗi khi tải chi tiết bài tập"
      );
    }
    return await res.json();
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
            <span>Quản lý Lớp học & Bài tập Speaking</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tạo lớp học, quản lý danh sách học viên và phân phối bài tập
            Speaking discrete cho kì thi IELTS.
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
            <div className="flex flex-col gap-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
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

        {/* Right Column: Classroom Detail (Roster & Homework Tabs) */}
        <div className="md:col-span-8 lg:col-span-8">
          <Tabs
            value={activeDetailTab}
            onValueChange={(val) =>
              setActiveDetailTab(val as "roster" | "homework")
            }
            className="w-full flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <TabsList className="grid grid-cols-2 w-72 h-8 p-0.5">
                <TabsTrigger
                  value="roster"
                  className="text-xs gap-1.5"
                  data-testid="tab-roster"
                >
                  <UsersIcon className="size-3.5" />
                  <span>
                    Sĩ số ({selectedClassroom?.memberCount ?? members.length})
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="homework"
                  className="text-xs gap-1.5"
                  data-testid="tab-homework"
                >
                  <BookOpenIcon className="size-3.5" />
                  <span>Bài tập ({assignments.length})</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="roster" className="mt-0">
              <ClassroomRosterTable
                classroom={selectedClassroom}
                members={members}
                isLoading={isLoadingRoster}
                isEnrolling={isEnrolling}
                isRemoving={removingId}
                onEnroll={handleEnrollLearner}
                onRemove={handleRemoveLearner}
                onUpdateClassroom={handleUpdateClassroom}
              />
            </TabsContent>

            <TabsContent value="homework" className="mt-0">
              {selectedClassroom ? (
                <HomeworkAssignmentList
                  classroomId={selectedClassroom.id}
                  classroomName={selectedClassroom.name}
                  assignments={assignments}
                  isLoading={isLoadingAssignments}
                  onCreateAssignment={handleCreateAssignment}
                  onPublishAssignment={handlePublishAssignment}
                  onArchiveAssignment={handleArchiveAssignment}
                  onDeleteDraftAssignment={handleDeleteDraftAssignment}
                  onFetchAssignmentDetails={handleFetchAssignmentDetails}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground bg-card">
                  Vui lòng chọn một lớp học để xem danh sách bài tập.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
