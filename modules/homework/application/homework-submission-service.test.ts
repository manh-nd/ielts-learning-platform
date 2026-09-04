import { describe, it, expect, beforeEach } from "bun:test";
import {
  getLearnerAssignmentDetails,
  submitLearnerHomeworkAttempt,
} from "./homework-submission-service";
import {
  createAssignment,
  clearDevHomeworkCache,
} from "../infrastructure/homework-assignment-repository";
import {
  clearDevHomeworkSubmissionCache,
  updateSubmissionStatus,
  listAttemptsBySubmissionId,
} from "../infrastructure/homework-submission-repository";
import {
  createClassroom,
  addMember,
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";
import {
  ValidationError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";

describe("Homework Submission Application Service (Issue #75, ADR-0008, ADR-0009)", () => {
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

    await addMember(classroom.id, learnerId);

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
      expect(
        getLearnerAssignmentDetails(learnerId, "non_existent_id")
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when learner is not enrolled in the classroom", async () => {
      const { assignment } = await setupTestAssignment();

      expect(
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

      expect(
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

  function makeClip(
    lId: string,
    aId: string,
    pId: string,
    durationMs = 30000,
    audioBytes = 50000,
    suffix = ""
  ) {
    return {
      promptId: pId,
      storageKey: `homework/${lId}/${aId}/${pId}/audio${suffix}.webm`,
      durationMs,
      audioBytes,
    };
  }

  describe("submitLearnerHomeworkAttempt", () => {
    it("should reject submission when deadline has passed", async () => {
      // Assignment expired 10 minutes ago
      const { assignment } = await setupTestAssignment(-600000);

      expect(
        submitLearnerHomeworkAttempt(learnerId, assignment.id, {
          audioResponses: [
            makeClip(learnerId, assignment.id, "p1"),
            makeClip(learnerId, assignment.id, "p2"),
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject submission when not all discrete prompts are recorded", async () => {
      const { assignment } = await setupTestAssignment();

      // Only provided prompt p1, missing p2
      expect(
        submitLearnerHomeworkAttempt(learnerId, assignment.id, {
          audioResponses: [makeClip(learnerId, assignment.id, "p1")],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject submission with storageKey owned by another learner", async () => {
      const { assignment } = await setupTestAssignment();

      expect(
        submitLearnerHomeworkAttempt(learnerId, assignment.id, {
          audioResponses: [
            {
              promptId: "p1",
              storageKey: `homework/other_learner/${assignment.id}/p1/audio.webm`,
              durationMs: 30000,
              audioBytes: 50000,
            },
            makeClip(learnerId, assignment.id, "p2"),
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should successfully create initial submission and attempt #1", async () => {
      const { assignment } = await setupTestAssignment();

      const { submission, attempt } = await submitLearnerHomeworkAttempt(
        learnerId,
        assignment.id,
        {
          audioResponses: [
            makeClip(learnerId, assignment.id, "p1", 35000, 60000, "_attempt1"),
            makeClip(
              learnerId,
              assignment.id,
              "p2",
              90000,
              150000,
              "_attempt1"
            ),
          ],
        }
      );

      expect(submission.id).toBeDefined();
      expect(submission.status).toBe("submitted");
      expect(submission.currentAttemptNumber).toBe(1);
      expect(attempt.attemptNumber).toBe(1);
      expect(attempt.audioResponses).toHaveLength(2);

      // Verify learner details now show submission and current attempt
      const details = await getLearnerAssignmentDetails(
        learnerId,
        assignment.id
      );
      expect(details.submission?.id).toBe(submission.id);
      expect(details.currentAttempt?.attemptNumber).toBe(1);
      expect(details.allAttempts).toHaveLength(1);
    });

    it("should allow resubmission (attempt #2) before deadline and preserve attempt #1 immutably", async () => {
      const { assignment } = await setupTestAssignment();

      // Attempt 1
      await submitLearnerHomeworkAttempt(learnerId, assignment.id, {
        audioResponses: [
          makeClip(learnerId, assignment.id, "p1", 30000, 50000, "_v1"),
          makeClip(learnerId, assignment.id, "p2", 60000, 100000, "_v1"),
        ],
      });

      // Attempt 2 (Resubmission)
      const { submission: sub2, attempt: attempt2 } =
        await submitLearnerHomeworkAttempt(learnerId, assignment.id, {
          audioResponses: [
            makeClip(learnerId, assignment.id, "p1", 40000, 70000, "_v2"),
            makeClip(learnerId, assignment.id, "p2", 80000, 130000, "_v2"),
          ],
        });

      expect(sub2.currentAttemptNumber).toBe(2);
      expect(attempt2.attemptNumber).toBe(2);

      // Verify both attempts exist and v1 was not overwritten
      const attempts = await listAttemptsBySubmissionId(sub2.id);
      expect(attempts).toHaveLength(2);
      expect(attempts[0].attemptNumber).toBe(1);
      expect(attempts[0].audioResponses[0].storageKey).toContain("_v1.webm");
      expect(attempts[1].attemptNumber).toBe(2);
      expect(attempts[1].audioResponses[0].storageKey).toContain("_v2.webm");
    });

    it("should reject resubmission with 409 Conflict when Teacher has locked status to in_review (First-Committed-Wins)", async () => {
      const { assignment } = await setupTestAssignment();

      // Submit attempt #1
      const { submission } = await submitLearnerHomeworkAttempt(
        learnerId,
        assignment.id,
        {
          audioResponses: [
            makeClip(learnerId, assignment.id, "p1", 30000, 50000, "_v1"),
            makeClip(learnerId, assignment.id, "p2", 60000, 100000, "_v1"),
          ],
        }
      );

      // Teacher opens review cockpit and locks review
      await updateSubmissionStatus(submission.id, "in_review", 1);

      // Learner attempts to resubmit
      let caughtError: ConflictError | null = null;
      try {
        await submitLearnerHomeworkAttempt(learnerId, assignment.id, {
          audioResponses: [
            makeClip(learnerId, assignment.id, "p1", 40000, 70000, "_v2"),
            makeClip(learnerId, assignment.id, "p2", 80000, 130000, "_v2"),
          ],
        });
      } catch (err) {
        if (err instanceof ConflictError) {
          caughtError = err;
        }
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.statusCode).toBe(409);
      expect(caughtError?.code).toBe("SUBMISSION_UNDER_REVIEW");
      expect(caughtError?.message).toContain(
        "Bài làm đã được Giáo viên tiếp nhận chấm"
      );
    });

    it("should reject resubmission with 409 Conflict when submission is already published", async () => {
      const { assignment } = await setupTestAssignment();

      const { submission } = await submitLearnerHomeworkAttempt(
        learnerId,
        assignment.id,
        {
          audioResponses: [
            makeClip(learnerId, assignment.id, "p1", 30000, 50000, "_v1"),
            makeClip(learnerId, assignment.id, "p2", 60000, 100000, "_v1"),
          ],
        }
      );

      await updateSubmissionStatus(submission.id, "published", 1);

      expect(
        submitLearnerHomeworkAttempt(learnerId, assignment.id, {
          audioResponses: [
            makeClip(learnerId, assignment.id, "p1", 40000, 70000, "_v2"),
            makeClip(learnerId, assignment.id, "p2", 80000, 130000, "_v2"),
          ],
        })
      ).rejects.toThrow(ConflictError);
    });
  });
});
