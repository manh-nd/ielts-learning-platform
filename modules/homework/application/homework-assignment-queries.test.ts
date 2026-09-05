import { describe, it, expect, beforeEach } from "bun:test";
import { createHomeworkAssignment } from "./create-homework-assignment";
import { getHomeworkAssignmentDetail } from "./get-homework-assignment-detail";
import { listHomeworkAssignmentsByClassroom } from "./list-homework-assignments";
import { clearDevHomeworkCache } from "../infrastructure/homework-assignment-repository";
import {
  createClassroom,
  addMembership,
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

describe("Homework Assignment Queries (Issue #95, ADR-0009)", () => {
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

  describe("getHomeworkAssignmentDetail", () => {
    it("should return assignment details, classroom name, and student roster", async () => {
      const hw = await createHomeworkAssignment(teacherA, classroomAId, {
        title: "Speaking Assignment Details Test",
        prompts: [{ text: "Describe your job.", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 86400000),
      });

      const details = await getHomeworkAssignmentDetail(teacherA, hw.id);
      expect(details.assignment.id).toBe(hw.id);
      expect(details.classroom.name).toBe("IELTS Advanced Speaking");
      expect(details.students).toHaveLength(1);
      expect(details.students[0].learnerEmail).toBe("learner.1@test.com");
      expect(details.students[0].submissionStatus).toBe("not_submitted");
    });

    it("should reject unauthorized teacher viewing assignment details", async () => {
      const hw = await createHomeworkAssignment(teacherA, classroomAId, {
        title: "Private HW",
        prompts: [{ text: "Secret question", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 86400000),
      });

      expect(getHomeworkAssignmentDetail(teacherB, hw.id)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should throw NotFoundError if assignment does not exist", async () => {
      expect(
        getHomeworkAssignmentDetail(teacherA, "non_existent_id")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("listHomeworkAssignmentsByClassroom", () => {
    it("should list assignments for classroom and reject unauthorized teacher", async () => {
      await createHomeworkAssignment(teacherA, classroomAId, {
        title: "HW Alpha",
        prompts: [{ text: "Alpha question", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 86400000),
      });

      const list = await listHomeworkAssignmentsByClassroom(
        teacherA,
        classroomAId
      );
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe("HW Alpha");

      expect(
        listHomeworkAssignmentsByClassroom(teacherB, classroomAId)
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
