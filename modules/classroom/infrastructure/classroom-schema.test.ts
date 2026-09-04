import { describe, it, expect } from "bun:test";
import { classrooms, classroomMembers } from "./classroom-schema";
import { getTableColumns } from "drizzle-orm";

describe("Classroom and Membership Database Schema (Issue #73, ADR-0009)", () => {
  it("should define classrooms table with expected columns and constraints", () => {
    const columns = getTableColumns(classrooms);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.teacherId).toBeDefined();
    expect(columns.teacherId.notNull).toBe(true);

    expect(columns.name).toBeDefined();
    expect(columns.name.notNull).toBe(true);

    expect(columns.description).toBeDefined();
    expect(columns.description.notNull).toBe(false);

    expect(columns.createdAt).toBeDefined();
    expect(columns.createdAt.notNull).toBe(true);

    expect(columns.updatedAt).toBeDefined();
    expect(columns.updatedAt.notNull).toBe(true);
  });

  it("should define classroom_members table with expected columns and constraints", () => {
    const columns = getTableColumns(classroomMembers);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.classroomId).toBeDefined();
    expect(columns.classroomId.notNull).toBe(true);

    expect(columns.learnerId).toBeDefined();
    expect(columns.learnerId.notNull).toBe(true);

    expect(columns.joinedAt).toBeDefined();
    expect(columns.joinedAt.notNull).toBe(true);
  });
});
