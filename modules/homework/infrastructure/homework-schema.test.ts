import { describe, it, expect } from "bun:test";
import { homeworkAssignments } from "./homework-schema";
import { getTableColumns } from "drizzle-orm";

describe("Homework Assignment Database Schema (Issue #74, ADR-0009)", () => {
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
});
