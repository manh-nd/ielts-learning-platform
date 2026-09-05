import { describe, it, expect } from "bun:test";
import type { Classroom, Membership } from "./classroom-types";

describe("Classroom Domain Models (Issue #85, ADR-0009)", () => {
  it("should define pure Classroom aggregate root", () => {
    const classroom: Classroom = {
      id: "cls_01",
      teacherId: "teacher_01",
      name: "IELTS Intensive Speaking",
      description: "Target Band 7.5+",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    };

    expect(classroom.id).toBe("cls_01");
    expect(classroom.teacherId).toBe("teacher_01");
  });

  it("should define canonical Membership entity without read-model pollution", () => {
    const membership: Membership = {
      id: "mem_01",
      classroomId: "cls_01",
      learnerId: "learner_01",
      joinedAt: new Date("2026-09-01T10:00:00Z"),
    };

    expect(membership.id).toBe("mem_01");
    expect(membership.classroomId).toBe("cls_01");
    expect(membership.learnerId).toBe("learner_01");

    // Ensure pure domain entity does not hold presentation or user profile fields
    const keys = Object.keys(membership);
    expect(keys).not.toContain("learnerName");
    expect(keys).not.toContain("learnerEmail");
    expect(keys).not.toContain("learnerImage");
    expect(keys).not.toContain("memberCount");
  });
});
