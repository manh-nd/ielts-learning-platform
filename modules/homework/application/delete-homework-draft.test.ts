import { describe, it, expect, beforeEach } from "bun:test";
import { createHomeworkAssignment } from "./create-homework-assignment";
import { deleteHomeworkDraft } from "./delete-homework-draft";
import { archiveHomeworkAssignment } from "./archive-homework-assignment";
import { getHomeworkAssignmentDetail } from "./get-homework-assignment-detail";
import { clearDevHomeworkCache } from "../infrastructure/homework-assignment-repository";
import {
  createClassroom,
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { ValidationError, NotFoundError, ForbiddenError } from "@/lib/errors";

describe("deleteHomeworkDraft Use Case (Issue #95, ADR-0009)", () => {
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

  it("should permit deleting a draft assignment", async () => {
    const draftHw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Temporary Draft",
      prompts: [{ text: "Draft question", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "draft",
    });

    const res = await deleteHomeworkDraft(teacherA, draftHw.id);
    expect(res.success).toBe(true);
    expect(res.message).toBe("Đã xóa bài tập bản nháp thành công.");

    // Querying deleted assignment should fail with NotFoundError
    expect(getHomeworkAssignmentDetail(teacherA, draftHw.id)).rejects.toThrow(
      NotFoundError
    );
  });

  it("should reject deleting a published assignment", async () => {
    const publishedHw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Published HW",
      prompts: [{ text: "Question", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "published",
    });

    expect(deleteHomeworkDraft(teacherA, publishedHw.id)).rejects.toThrow(
      /Chỉ có thể xóa bài tập ở trạng thái Bản nháp/
    );
  });

  it("should reject deleting an archived assignment", async () => {
    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Assignment to Archive",
      prompts: [{ text: "Question", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "published",
    });

    await archiveHomeworkAssignment(teacherA, hw.id);

    expect(deleteHomeworkDraft(teacherA, hw.id)).rejects.toThrow(
      ValidationError
    );
  });

  it("should reject foreign teacher deleting another teacher's draft", async () => {
    const draftHw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Teacher A Draft",
      prompts: [{ text: "Draft question", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "draft",
    });

    expect(deleteHomeworkDraft(teacherB, draftHw.id)).rejects.toThrow(
      ForbiddenError
    );
  });
});
