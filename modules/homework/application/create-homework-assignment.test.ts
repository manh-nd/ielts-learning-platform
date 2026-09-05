import { describe, it, expect, beforeEach } from "bun:test";
import { createHomeworkAssignment } from "./create-homework-assignment";
import { clearDevHomeworkCache } from "../infrastructure/homework-assignment-repository";
import {
  createClassroom,
  addMembership,
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { ValidationError, ForbiddenError } from "@/lib/errors";

describe("createHomeworkAssignment Use Case (Issue #95, ADR-0009)", () => {
  const teacherA = "usr_teacher_a";
  const teacherB = "usr_teacher_b";
  const learner1 = "usr_learner_1";
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
    registerDevUser({
      id: learner1,
      name: "Learner One",
      email: "learner.1@test.com",
      role: "learner",
    });

    const cls = await createClassroom(teacherA, {
      name: "IELTS Advanced Speaking",
      description: "Cohort 2026",
    });
    classroomAId = cls.id;
    await addMembership(classroomAId, learner1);
  });

  it("should reject creation if teacher does not own classroom (Single-Teacher invariant)", async () => {
    expect(
      createHomeworkAssignment(teacherB, classroomAId, {
        title: "HW 1",
        prompts: [{ text: "Describe a book.", partNumber: 2 }],
        submissionDeadline: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("should reject creation when prompt count is outside 1-3 range", async () => {
    // 0 prompts
    expect(
      createHomeworkAssignment(teacherA, classroomAId, {
        title: "Empty Prompts HW",
        prompts: [],
        submissionDeadline: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(ValidationError);

    // 4 prompts
    expect(
      createHomeworkAssignment(teacherA, classroomAId, {
        title: "Too Many Prompts HW",
        prompts: [
          { text: "Q1", partNumber: 1 },
          { text: "Q2", partNumber: 1 },
          { text: "Q3", partNumber: 3 },
          { text: "Q4", partNumber: 3 },
        ],
        submissionDeadline: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject empty prompt text and invalid Part numbers", async () => {
    // Empty text
    expect(
      createHomeworkAssignment(teacherA, classroomAId, {
        title: "Blank Prompt HW",
        prompts: [{ text: "   ", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(/Nội dung câu hỏi thứ 1 không được để trống/);

    // Invalid Part number
    expect(
      createHomeworkAssignment(teacherA, classroomAId, {
        title: "Bad Part HW",
        prompts: [
          { text: "Valid question", partNumber: 5 as unknown as 1 | 2 | 3 },
        ],
        submissionDeadline: new Date(Date.now() + 86400000),
      })
    ).rejects.toThrow(
      /Phần thi \(Part\) cho câu hỏi thứ 1 phải là 1, 2 hoặc 3/
    );
  });

  it("should reject expired submission deadlines on creation", async () => {
    const pastDeadline = new Date(Date.now() - 60000);
    expect(
      createHomeworkAssignment(teacherA, classroomAId, {
        title: "Expired HW",
        prompts: [{ text: "Speak about hobbies.", partNumber: 1 }],
        submissionDeadline: pastDeadline,
      })
    ).rejects.toThrow(/Hạn nộp bài phải là một mốc thời gian trong tương lai/);
  });

  it("should accept valid combinations of 1 to 3 prompts and assign UUIDs when missing", async () => {
    const deadline = new Date(Date.now() + 86400000 * 3);

    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Part 1 & 2 Mixed HW",
      prompts: [
        { text: "Where do you live?", partNumber: 1 },
        {
          text: "Describe a historical building.",
          partNumber: 2,
          subPrompts: ["Where it is", "What it looks like"],
        },
      ],
      submissionDeadline: deadline,
      status: "published",
    });

    expect(hw.id).toBeDefined();
    expect(hw.status).toBe("published");
    expect(hw.prompts).toHaveLength(2);
    expect(hw.prompts[0].promptId).toBeDefined();
    expect(typeof hw.prompts[0].promptId).toBe("string");
    expect(hw.prompts[1].subPrompts).toHaveLength(2);
  });

  it("should support creating draft assignment", async () => {
    const hw = await createHomeworkAssignment(teacherA, classroomAId, {
      title: "Draft Assignment",
      prompts: [{ text: "Part 1 intro", partNumber: 1 }],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "draft",
    });

    expect(hw.status).toBe("draft");
  });
});
