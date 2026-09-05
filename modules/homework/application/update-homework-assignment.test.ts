import { describe, it, expect, beforeEach } from "bun:test";
import { createHomeworkAssignment } from "./create-homework-assignment";
import { updateHomeworkAssignment } from "./update-homework-assignment";
import { archiveHomeworkAssignment } from "./archive-homework-assignment";
import { clearDevHomeworkCache } from "../infrastructure/homework-assignment-repository";
import {
  createClassroom,
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { ForbiddenError } from "@/lib/errors";

describe("updateHomeworkAssignment & archiveHomeworkAssignment (Issue #95, ADR-0009)", () => {
  const teacherA = "usr_teacher_a";
  const teacherB = "usr_teacher_b";
  let classroomAId: string;

  beforeEach(async () => {
    clearDevHomeworkCache();
    clearDevClassroomCache();

    registerDevUser({
      id: teacherA,
      name: "Teacher Alpha",
      email: "teacher.a@test.com",
      role: "teacher",
    });
    registerDevUser({
      id: teacherB,
      name: "Teacher Beta",
      email: "teacher.b@test.com",
      role: "teacher",
    });

    const cls = await createClassroom(teacherA, {
      name: "IELTS Advanced Speaking",
      description: "Cohort 2026",
    });
    classroomAId = cls.id;
  });

  it("should freeze prompts when assignment is published (Prompt Immutability Invariant)", async () => {
    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Published HW",
      prompts: [{ text: "Original Question", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000 * 2),
      status: "published",
    });

    expect(
      updateHomeworkAssignment(teacherA, hw.id, {
        prompts: [{ text: "Modified Question", partNumber: 1 }],
      })
    ).rejects.toThrow(
      /Không thể sửa đổi nội dung câu hỏi sau khi bài tập đã được giao/
    );
  });

  it("should enforce deadline extension only for published assignments", async () => {
    const originalDeadline = new Date(Date.now() + 86400000 * 4);
    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Deadline Test HW",
      prompts: [{ text: "Part 2 Cue Card", partNumber: 2 }],
      submissionDeadline: originalDeadline,
      status: "published",
    });

    // Attempting to shorten deadline
    const shortenedDeadline = new Date(Date.now() + 86400000 * 2);
    expect(
      updateHomeworkAssignment(teacherA, hw.id, {
        submissionDeadline: shortenedDeadline,
      })
    ).rejects.toThrow(/Hạn nộp bài đã giao chỉ có thể gia hạn thêm/);

    // Extending deadline
    const extendedDeadline = new Date(Date.now() + 86400000 * 7);
    const updated = await updateHomeworkAssignment(teacherA, hw.id, {
      submissionDeadline: extendedDeadline,
    });
    expect(updated.submissionDeadline.getTime()).toBe(
      extendedDeadline.getTime()
    );
  });

  it("should preserve same-state published update", async () => {
    const originalDeadline = new Date(Date.now() + 86400000 * 3);
    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Same-State Published HW",
      prompts: [{ text: "Question 1", partNumber: 1 }],
      submissionDeadline: originalDeadline,
      status: "published",
    });

    const updated = await updateHomeworkAssignment(teacherA, hw.id, {
      title: "Renamed Published HW",
      status: "published",
    });
    expect(updated.title).toBe("Renamed Published HW");
    expect(updated.status).toBe("published");
  });

  it("should allow editing prompts and deadlines while assignment is in draft status", async () => {
    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Draft HW",
      prompts: [{ text: "Draft question 1", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "draft",
    });

    const updated = await updateHomeworkAssignment(teacherA, hw.id, {
      title: "Polished Draft HW",
      prompts: [
        { text: "Draft question 1", partNumber: 1 },
        { text: "Draft question 2", partNumber: 1 },
      ],
    });

    expect(updated.title).toBe("Polished Draft HW");
    expect(updated.prompts).toHaveLength(2);
  });

  it("should reject published assignments transitioning back to draft", async () => {
    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Published HW",
      prompts: [{ text: "Question 1", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "published",
    });

    expect(
      updateHomeworkAssignment(teacherA, hw.id, {
        status: "draft",
      })
    ).rejects.toThrow(
      /Bài tập đã xuất bản không thể chuyển ngược lại thành bản nháp/
    );
  });

  it("should reject publishing draft assignment if deadline has expired", async () => {
    // Create draft with expired deadline by advancing time or setting past
    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Draft to Publish HW",
      prompts: [{ text: "Question 1", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 1000), // very soon
      status: "draft",
    });

    // Update with expired deadline on publish
    const pastDeadline = new Date(Date.now() - 5000);
    expect(
      updateHomeworkAssignment(teacherA, hw.id, {
        submissionDeadline: pastDeadline,
        status: "published",
      })
    ).rejects.toThrow();
  });

  it("should archive assignment and reject editing archived assignment", async () => {
    const publishedHw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "To Be Archived",
      prompts: [{ text: "Question", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "published",
    });

    const archived = await archiveHomeworkAssignment(teacherA, publishedHw.id);
    expect(archived.status).toBe("archived");

    // Edits on archived assignment must be blocked
    expect(
      updateHomeworkAssignment(teacherA, publishedHw.id, {
        title: "New Title Attempt",
      })
    ).rejects.toThrow(/Không thể chỉnh sửa bài tập đã lưu trữ/);
  });

  it("should reject foreign teacher updating or archiving another teacher's assignment", async () => {
    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Alpha HW",
      prompts: [{ text: "Question", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000),
    });

    expect(
      updateHomeworkAssignment(teacherB, hw.id, { title: "Hacked Title" })
    ).rejects.toThrow(ForbiddenError);

    expect(archiveHomeworkAssignment(teacherB, hw.id)).rejects.toThrow(
      ForbiddenError
    );
  });
});
