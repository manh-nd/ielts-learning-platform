import { describe, it, expect, beforeEach } from "bun:test";
import { getLearnerAssignmentDetails } from "./get-learner-homework";
import {
  createAssignment,
  clearDevHomeworkCache,
} from "../infrastructure/homework-assignment-repository";
import { clearDevHomeworkSubmissionCache } from "../infrastructure/homework-submission-repository";
import {
  createClassroom,
  addMembership,
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

describe("Learner Homework query", () => {
  const teacherId = "teacher_sub_test";
  const learnerId = "learner_sub_test";
  const nonMemberLearnerId = "learner_non_member";

  beforeEach(() => {
    clearDevHomeworkCache();
    clearDevHomeworkSubmissionCache();
    clearDevClassroomCache();

    registerDevUser({
      id: teacherId,
      name: "Teacher User",
      email: "teacher@test.com",
      role: "teacher",
    });

    registerDevUser({
      id: learnerId,
      name: "Learner User",
      email: "learner@test.com",
      role: "learner",
    });

    registerDevUser({
      id: nonMemberLearnerId,
      name: "Non Member",
      email: "nonmember@test.com",
      role: "learner",
    });
  });

  async function setupTestAssignment(deadlineDeltaMs = 3600000) {
    const classroom = await createClassroom(teacherId, {
      name: "IELTS Speaking Room",
    });

    await addMembership(classroom.id, learnerId);

    const assignment = await createAssignment({
      classroomId: classroom.id,
      teacherId,
      title: "Part 1 & 2 Speaking Homework",
      prompts: [
        {
          promptId: "p1",
          text: "What do you do in your free time?",
          partNumber: 1,
        },
        {
          promptId: "p2",
          text: "Describe a memorable trip you took.",
          partNumber: 2,
          subPrompts: ["Where you went", "Who you went with"],
        },
      ],
      submissionDeadline: new Date(Date.now() + deadlineDeltaMs),
      status: "published",
    });

    return { classroom, assignment };
  }

  describe("getLearnerAssignmentDetails", () => {
    it("should throw NotFoundError when assignment does not exist", async () => {
      await expect(
        getLearnerAssignmentDetails(learnerId, "non_existent_id")
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when learner is not enrolled in the classroom", async () => {
      const { assignment } = await setupTestAssignment();

      await expect(
        getLearnerAssignmentDetails(nonMemberLearnerId, assignment.id)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw ForbiddenError when assignment is still a draft", async () => {
      const { classroom } = await setupTestAssignment();
      const draftAssignment = await createAssignment({
        classroomId: classroom.id,
        teacherId,
        title: "Draft Assignment",
        prompts: [{ promptId: "p_d", text: "Question", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 3600000),
        status: "draft",
      });

      await expect(
        getLearnerAssignmentDetails(learnerId, draftAssignment.id)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should return assignment details and null submission when learner has not submitted", async () => {
      const { assignment, classroom } = await setupTestAssignment();

      const details = await getLearnerAssignmentDetails(
        learnerId,
        assignment.id
      );

      expect(details.assignment.id).toBe(assignment.id);
      expect(details.classroom.id).toBe(classroom.id);
      expect(details.submission).toBeNull();
      expect(details.currentAttempt).toBeNull();
      expect(details.allAttempts).toHaveLength(0);
    });
  });
});
