import { describe, it, expect, beforeEach } from "bun:test";
import {
  createTeacherClassroom,
  getTeacherClassrooms,
  enrollLearnerInClassroom,
  removeLearnerFromClassroom,
  getClassroomRoster,
} from "./classroom-service";
import {
  clearDevClassroomCache,
  registerDevUser,
} from "../infrastructure/classroom-repository";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";

describe("Classroom Application Service", () => {
  const teacherId = "teacher_svc_01";
  const otherTeacherId = "teacher_svc_02";

  beforeEach(() => {
    clearDevClassroomCache();

    // Register test users
    registerDevUser({
      id: "learner_svc_01",
      name: "Tran Van Learner",
      email: "learner01@example.com",
      role: "learner",
    });

    registerDevUser({
      id: "learner_svc_02",
      name: "Le Thi Learner",
      email: "learner02@example.com",
      role: "learner",
    });

    registerDevUser({
      id: "teacher_user_02",
      name: "Teacher Other",
      email: "otherteacher@example.com",
      role: "teacher",
    });
  });

  describe("createTeacherClassroom", () => {
    it("should successfully create classroom with valid inputs", async () => {
      const result = await createTeacherClassroom(teacherId, {
        name: "IELTS Advanced Speaking Cohort 1",
        description: "Target Band 7.5+",
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe("IELTS Advanced Speaking Cohort 1");
      expect(result.description).toBe("Target Band 7.5+");
      expect(result.teacherId).toBe(teacherId);
    });

    it("should reject creation with empty or whitespace-only name", async () => {
      expect(
        createTeacherClassroom(teacherId, { name: "" })
      ).rejects.toBeInstanceOf(ValidationError);

      expect(
        createTeacherClassroom(teacherId, { name: "   " })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("should reject creation when name exceeds 255 chars", async () => {
      const longName = "A".repeat(256);
      expect(
        createTeacherClassroom(teacherId, { name: longName })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("getTeacherClassrooms", () => {
    it("should return classrooms for the teacher with member counts", async () => {
      const c1 = await createTeacherClassroom(teacherId, { name: "Class 1" });
      await createTeacherClassroom(otherTeacherId, { name: "Class Other" });

      await enrollLearnerInClassroom(teacherId, c1.id, "learner01@example.com");

      const classrooms = await getTeacherClassrooms(teacherId);
      expect(classrooms.length).toBe(1);
      expect(classrooms[0].id).toBe(c1.id);
      expect(classrooms[0].memberCount).toBe(1);
    });
  });

  describe("enrollLearnerInClassroom", () => {
    it("should successfully enroll a registered learner into the classroom", async () => {
      const c = await createTeacherClassroom(teacherId, { name: "Class Test" });
      const member = await enrollLearnerInClassroom(
        teacherId,
        c.id,
        "learner01@example.com"
      );

      expect(member.id).toBeDefined();
      expect(member.classroomId).toBe(c.id);
      expect(member.learnerId).toBe("learner_svc_01");
      expect(member.learnerName).toBe("Tran Van Learner");
      expect(member.learnerEmail).toBe("learner01@example.com");
    });

    it("should reject invalid email formatting", async () => {
      const c = await createTeacherClassroom(teacherId, { name: "Class Test" });
      expect(
        enrollLearnerInClassroom(teacherId, c.id, "not-an-email")
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("should throw NotFoundError if classroom does not exist", async () => {
      expect(
        enrollLearnerInClassroom(
          teacherId,
          "00000000-0000-0000-0000-000000000000",
          "learner01@example.com"
        )
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("should enforce single-teacher ownership and throw ForbiddenError if teacher does not own the classroom", async () => {
      const c = await createTeacherClassroom(otherTeacherId, {
        name: "Other Class",
      });

      expect(
        enrollLearnerInClassroom(teacherId, c.id, "learner01@example.com")
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("should throw NotFoundError if learner email has no existing account", async () => {
      const c = await createTeacherClassroom(teacherId, { name: "Class Test" });

      expect(
        enrollLearnerInClassroom(teacherId, c.id, "unregistered@example.com")
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("should throw ValidationError if account belongs to a teacher instead of learner", async () => {
      const c = await createTeacherClassroom(teacherId, { name: "Class Test" });

      expect(
        enrollLearnerInClassroom(teacherId, c.id, "otherteacher@example.com")
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("should throw ConflictError if learner is already enrolled in the classroom", async () => {
      const c = await createTeacherClassroom(teacherId, { name: "Class Test" });
      await enrollLearnerInClassroom(teacherId, c.id, "learner01@example.com");

      expect(
        enrollLearnerInClassroom(teacherId, c.id, "learner01@example.com")
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("removeLearnerFromClassroom", () => {
    it("should remove learner when requested by owning teacher", async () => {
      const c = await createTeacherClassroom(teacherId, { name: "Class Test" });
      await enrollLearnerInClassroom(teacherId, c.id, "learner01@example.com");

      const result = await removeLearnerFromClassroom(
        teacherId,
        c.id,
        "learner_svc_01"
      );
      expect(result.success).toBe(true);

      const roster = await getClassroomRoster(teacherId, c.id);
      expect(roster.length).toBe(0);
    });

    it("should throw ForbiddenError if teacher does not own the classroom", async () => {
      const c = await createTeacherClassroom(otherTeacherId, {
        name: "Other Class",
      });
      await enrollLearnerInClassroom(
        otherTeacherId,
        c.id,
        "learner01@example.com"
      );

      expect(
        removeLearnerFromClassroom(teacherId, c.id, "learner_svc_01")
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("should throw NotFoundError if learner is not in classroom", async () => {
      const c = await createTeacherClassroom(teacherId, { name: "Class Test" });

      expect(
        removeLearnerFromClassroom(teacherId, c.id, "learner_svc_02")
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("getClassroomRoster", () => {
    it("should list members for the owning teacher", async () => {
      const c = await createTeacherClassroom(teacherId, { name: "Class Test" });
      await enrollLearnerInClassroom(teacherId, c.id, "learner01@example.com");
      await enrollLearnerInClassroom(teacherId, c.id, "learner02@example.com");

      const roster = await getClassroomRoster(teacherId, c.id);
      expect(roster.length).toBe(2);
      expect(roster.map((m) => m.learnerEmail)).toContain(
        "learner01@example.com"
      );
      expect(roster.map((m) => m.learnerEmail)).toContain(
        "learner02@example.com"
      );
    });

    it("should throw ForbiddenError if teacher does not own the classroom", async () => {
      const c = await createTeacherClassroom(otherTeacherId, {
        name: "Other Class",
      });

      expect(getClassroomRoster(teacherId, c.id)).rejects.toBeInstanceOf(
        ForbiddenError
      );
    });
  });
});
