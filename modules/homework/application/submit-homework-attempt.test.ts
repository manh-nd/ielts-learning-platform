import * as submissionRepository from "../infrastructure/homework-submission-repository";
import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { getLearnerAssignmentDetails } from "./get-learner-homework";
import { submitLearnerHomeworkAttempt } from "./submit-homework-attempt";
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
  addMembership,
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { ValidationError, ForbiddenError, ConflictError } from "@/lib/errors";

describe("Submit Homework attempt", () => {
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
    it("rejects a non-member before accepting an attempt", async () => {
      const { assignment } = await setupTestAssignment();
      await expect(
        submitLearnerHomeworkAttempt(nonMemberLearnerId, assignment.id, {
          audioResponses: [
            makeClip(nonMemberLearnerId, assignment.id, "p1"),
            makeClip(nonMemberLearnerId, assignment.id, "p2"),
          ],
        })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    for (const invalidKey of [
      "not-a-homework-key",
      "homework/learner_sub_test/other-assignment/audio.webm",
      "homework/learner_sub_test/../audio.webm",
    ]) {
      it(`rejects invalid or foreign assignment storage key: ${invalidKey}`, async () => {
        const { assignment } = await setupTestAssignment();
        await expect(
          submitLearnerHomeworkAttempt(learnerId, assignment.id, {
            audioResponses: [
              {
                ...makeClip(learnerId, assignment.id, "p1"),
                storageKey: invalidKey,
              },
              makeClip(learnerId, assignment.id, "p2"),
            ],
          })
        ).rejects.toMatchObject({
          statusCode: 400,
          message:
            "Khóa lưu trữ âm thanh không hợp lệ hoặc không thuộc về học viên.",
        });
      });
    }

    it("rejects extra audio for a foreign prompt even when all required prompts are present", async () => {
      const { assignment } = await setupTestAssignment();
      await expect(
        submitLearnerHomeworkAttempt(learnerId, assignment.id, {
          audioResponses: [
            makeClip(learnerId, assignment.id, "p1"),
            makeClip(learnerId, assignment.id, "p2"),
            makeClip(learnerId, assignment.id, "foreign"),
          ],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Có clip âm thanh không thuộc đề bài này.",
      });
    });
    it("commits initial and subsequent attempts without claiming evaluation was queued", async () => {
      const { assignment } = await setupTestAssignment();
      const input = {
        audioResponses: [
          makeClip(learnerId, assignment.id, "p1"),
          makeClip(learnerId, assignment.id, "p2"),
        ],
      };
      const log = spyOn(console, "info").mockImplementation(() => {});
      try {
        const first = await submitLearnerHomeworkAttempt(
          learnerId,
          assignment.id,
          input
        );
        const second = await submitLearnerHomeworkAttempt(
          learnerId,
          assignment.id,
          input
        );
        expect(first.attempt.attemptNumber).toBe(1);
        expect(second.attempt.attemptNumber).toBe(2);
        expect(log).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
      }
    });
    it("should reject submission when deadline has passed", async () => {
      // Assignment expired 10 minutes ago
      const { assignment } = await setupTestAssignment(-600000);

      await expect(
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
      await expect(
        submitLearnerHomeworkAttempt(learnerId, assignment.id, {
          audioResponses: [makeClip(learnerId, assignment.id, "p1")],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject submission with storageKey owned by another learner", async () => {
      const { assignment } = await setupTestAssignment();

      await expect(
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

    for (const [status, code] of [
      ["in_review", "SUBMISSION_UNDER_REVIEW"],
      ["published", "SUBMISSION_PUBLISHED"],
      ["submitted", "SUBMISSION_INVALID_STATE"],
    ] as const) {
      it(`maps a lost resubmission race to ${code} without dispatching AI`, async () => {
        const { assignment } = await setupTestAssignment();
        const input = {
          audioResponses: [
            makeClip(learnerId, assignment.id, "p1"),
            makeClip(learnerId, assignment.id, "p2"),
          ],
        };
        const { submission } = await submitLearnerHomeworkAttempt(
          learnerId,
          assignment.id,
          input
        );
        const commit = spyOn(
          submissionRepository,
          "commitResubmission"
        ).mockResolvedValue({
          kind: "no_transition",
          submission: { ...submission, status, currentAttemptNumber: 2 },
        });
        const log = spyOn(console, "info").mockImplementation(() => {});
        try {
          await expect(
            submitLearnerHomeworkAttempt(learnerId, assignment.id, input)
          ).rejects.toMatchObject({ code, statusCode: 409 });
          expect(commit).toHaveBeenCalledWith({
            submissionId: submission.id,
            expectedCurrentAttemptNumber: 1,
            audioResponses: input.audioResponses,
          });
          expect(log).not.toHaveBeenCalled();
          expect(await listAttemptsBySubmissionId(submission.id)).toHaveLength(
            1
          );
        } finally {
          commit.mockRestore();
          log.mockRestore();
        }
      });
    }

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

      await expect(
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
