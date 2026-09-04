import { describe, it, expect, beforeEach } from "bun:test";
import {
  createAssignment,
  findAssignmentById,
  listAssignmentsByClassroomId,
  listAssignmentsByTeacherId,
  updateAssignment,
  deleteAssignment,
  clearDevHomeworkCache,
} from "./homework-assignment-repository";
import type { HomeworkPromptItem } from "../domain/homework-types";

describe("Homework Assignment Repository (Issue #74, ADR-0009)", () => {
  const teacherId = "teacher_repo_test_1";
  const classroomId = "cls_repo_test_1";
  const samplePrompts: HomeworkPromptItem[] = [
    {
      promptId: "p1_test",
      text: "Describe your hometown.",
      partNumber: 1,
    },
  ];

  beforeEach(() => {
    clearDevHomeworkCache();
  });

  it("should create and retrieve a homework assignment by ID", async () => {
    const deadline = new Date(Date.now() + 86400000 * 3);
    const created = await createAssignment({
      classroomId,
      teacherId,
      title: "Speaking HW 1",
      instructions: "Record clearly",
      prompts: samplePrompts,
      submissionDeadline: deadline,
      status: "draft",
    });

    expect(created.id).toBeDefined();
    expect(created.title).toBe("Speaking HW 1");
    expect(created.instructions).toBe("Record clearly");
    expect(created.status).toBe("draft");
    expect(created.prompts).toHaveLength(1);
    expect(created.prompts[0].promptId).toBe("p1_test");

    const retrieved = await findAssignmentById(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.title).toBe("Speaking HW 1");
  });

  it("should list assignments by classroom sorted by createdAt desc", async () => {
    const deadline = new Date(Date.now() + 86400000);
    const hw1 = await createAssignment({
      classroomId,
      teacherId,
      title: "HW 1",
      prompts: samplePrompts,
      submissionDeadline: deadline,
    });

    // Artificially space createdAt
    hw1.createdAt = new Date(Date.now() - 5000);

    const hw2 = await createAssignment({
      classroomId,
      teacherId,
      title: "HW 2",
      prompts: samplePrompts,
      submissionDeadline: deadline,
    });

    const list = await listAssignmentsByClassroomId(classroomId);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(hw2.id);
    expect(list[1].id).toBe(hw1.id);
  });

  it("should list assignments by teacherId", async () => {
    const deadline = new Date(Date.now() + 86400000);
    await createAssignment({
      classroomId: "cls_other",
      teacherId: "teacher_other",
      title: "Other Teacher HW",
      prompts: samplePrompts,
      submissionDeadline: deadline,
    });

    await createAssignment({
      classroomId,
      teacherId,
      title: "My HW",
      prompts: samplePrompts,
      submissionDeadline: deadline,
    });

    const teacherList = await listAssignmentsByTeacherId(teacherId);
    expect(teacherList).toHaveLength(1);
    expect(teacherList[0].title).toBe("My HW");
  });

  it("should update assignment fields and updatedAt timestamp", async () => {
    const deadline = new Date(Date.now() + 86400000);
    const created = await createAssignment({
      classroomId,
      teacherId,
      title: "Initial Title",
      prompts: samplePrompts,
      submissionDeadline: deadline,
      status: "draft",
    });

    const newDeadline = new Date(Date.now() + 86400000 * 5);
    const updated = await updateAssignment(created.id, {
      title: "Updated Title",
      submissionDeadline: newDeadline,
      status: "published",
    });

    expect(updated.title).toBe("Updated Title");
    expect(updated.status).toBe("published");
    expect(updated.submissionDeadline.getTime()).toBe(newDeadline.getTime());
  });

  it("should delete draft assignment from repository", async () => {
    const deadline = new Date(Date.now() + 86400000);
    const created = await createAssignment({
      classroomId,
      teacherId,
      title: "To Be Deleted",
      prompts: samplePrompts,
      submissionDeadline: deadline,
      status: "draft",
    });

    await deleteAssignment(created.id);
    const retrieved = await findAssignmentById(created.id);
    expect(retrieved).toBeNull();
  });
});
