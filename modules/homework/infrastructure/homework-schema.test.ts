import { describe, it, expect } from "bun:test";
import {
  homeworkAssignments,
  homeworkSubmissions,
  submissionAttempts,
} from "./homework-schema";
import { getTableColumns } from "drizzle-orm";

describe("Homework Database Schema (Issue #74, Issue #75, ADR-0009)", () => {
  it("should define homework_assignments table with expected columns and constraints", () => {
    const columns = getTableColumns(homeworkAssignments);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.classroomId).toBeDefined();
    expect(columns.classroomId.notNull).toBe(true);

    expect(columns.teacherId).toBeDefined();
    expect(columns.teacherId.notNull).toBe(true);

    expect(columns.title).toBeDefined();
    expect(columns.title.notNull).toBe(true);

    expect(columns.instructions).toBeDefined();
    expect(columns.instructions.notNull).toBe(false);

    expect(columns.prompts).toBeDefined();
    expect(columns.prompts.notNull).toBe(true);

    expect(columns.submissionDeadline).toBeDefined();
    expect(columns.submissionDeadline.notNull).toBe(true);

    expect(columns.status).toBeDefined();
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe("draft");

    expect(columns.createdAt).toBeDefined();
    expect(columns.createdAt.notNull).toBe(true);

    expect(columns.updatedAt).toBeDefined();
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it("should define homework_submissions table with expected columns and constraints", () => {
    const columns = getTableColumns(homeworkSubmissions);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.assignmentId).toBeDefined();
    expect(columns.assignmentId.notNull).toBe(true);

    expect(columns.learnerId).toBeDefined();
    expect(columns.learnerId.notNull).toBe(true);

    expect(columns.status).toBeDefined();
    expect(columns.status.notNull).toBe(true);
    expect(columns.status.default).toBe("pending");

    expect(columns.currentAttemptNumber).toBeDefined();
    expect(columns.currentAttemptNumber.notNull).toBe(true);
    expect(columns.currentAttemptNumber.default).toBe(1);

    expect(columns.reviewedAttemptNumber).toBeDefined();
    expect(columns.reviewedAttemptNumber.notNull).toBe(false);

    expect(columns.createdAt).toBeDefined();
    expect(columns.createdAt.notNull).toBe(true);

    expect(columns.updatedAt).toBeDefined();
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it("should define submission_attempts table with expected columns and constraints", () => {
    const columns = getTableColumns(submissionAttempts);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.submissionId).toBeDefined();
    expect(columns.submissionId.notNull).toBe(true);

    expect(columns.attemptNumber).toBeDefined();
    expect(columns.attemptNumber.notNull).toBe(true);

    expect(columns.audioResponses).toBeDefined();
    expect(columns.audioResponses.notNull).toBe(true);

    expect(columns.submittedAt).toBeDefined();
    expect(columns.submittedAt.notNull).toBe(true);
  });
});
