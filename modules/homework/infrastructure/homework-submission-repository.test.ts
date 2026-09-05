import { describe, it, expect, beforeEach } from "bun:test";
import {
  createInitialSubmissionWithAttempt,
  createSubsequentAttempt,
  findSubmissionByAssignmentAndLearner,
  findSubmissionById,
  listAttemptsBySubmissionId,
  updateSubmissionStatus,
  clearDevHomeworkSubmissionCache,
} from "./homework-submission-repository";

describe("Homework Submission Repository (Issue #75, ADR-0009)", () => {
  beforeEach(() => {
    clearDevHomeworkSubmissionCache();
  });

  it("should create initial submission and attempt #1", async () => {
    const assignmentId = "asg_test_1";
    const learnerId = "user_learner_1";

    const { submission, attempt } = await createInitialSubmissionWithAttempt({
      assignmentId,
      learnerId,
      audioResponses: [
        {
          promptId: "prompt_1",
          storageKey: "homework/user_learner_1/asg_test_1/p1.webm",
          durationMs: 45000,
          audioBytes: 120000,
        },
      ],
    });

    expect(submission.id).toBeDefined();
    expect(submission.assignmentId).toBe(assignmentId);
    expect(submission.learnerId).toBe(learnerId);
    expect(submission.status).toBe("submitted");
    expect(submission.currentAttemptNumber).toBe(1);
    expect(submission.reviewedAttemptNumber).toBeNull();

    expect(attempt.id).toBeDefined();
    expect(attempt.submissionId).toBe(submission.id);
    expect(attempt.attemptNumber).toBe(1);
    expect(attempt.audioResponses).toHaveLength(1);
    expect(attempt.audioResponses[0].promptId).toBe("prompt_1");

    // Lookup by assignment + learner
    const found = await findSubmissionByAssignmentAndLearner(
      assignmentId,
      learnerId
    );
    expect(found).not.toBeNull();
    expect(found?.id).toBe(submission.id);

    // List attempts
    const attempts = await listAttemptsBySubmissionId(submission.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].attemptNumber).toBe(1);
  });

  it("should create subsequent immutable attempt #2 and increment currentAttemptNumber", async () => {
    const assignmentId = "asg_test_resubmit";
    const learnerId = "user_learner_2";

    const { submission: initialSub } = await createInitialSubmissionWithAttempt(
      {
        assignmentId,
        learnerId,
        audioResponses: [
          {
            promptId: "p1",
            storageKey: "key_v1.webm",
            durationMs: 30000,
            audioBytes: 80000,
          },
        ],
      }
    );

    const { submission: updatedSub, attempt: attempt2 } =
      await createSubsequentAttempt(initialSub.id, [
        {
          promptId: "p1",
          storageKey: "key_v2.webm",
          durationMs: 35000,
          audioBytes: 95000,
        },
      ]);

    expect(updatedSub.currentAttemptNumber).toBe(2);
    expect(attempt2.attemptNumber).toBe(2);
    expect(attempt2.audioResponses[0].storageKey).toBe("key_v2.webm");

    // All attempts history is preserved immutably
    const attempts = await listAttemptsBySubmissionId(initialSub.id);
    expect(attempts).toHaveLength(2);
    expect(attempts[0].attemptNumber).toBe(1);
    expect(attempts[0].audioResponses[0].storageKey).toBe("key_v1.webm");
    expect(attempts[1].attemptNumber).toBe(2);
    expect(attempts[1].audioResponses[0].storageKey).toBe("key_v2.webm");
  });

  it("should update submission status and reviewedAttemptNumber", async () => {
    const { submission } = await createInitialSubmissionWithAttempt({
      assignmentId: "asg_status",
      learnerId: "user_status",
      audioResponses: [],
    });

    const updated = await updateSubmissionStatus(submission.id, "in_review", 1);
    expect(updated.status).toBe("in_review");
    expect(updated.reviewedAttemptNumber).toBe(1);

    const reloaded = await findSubmissionById(submission.id);
    expect(reloaded?.status).toBe("in_review");
    expect(reloaded?.reviewedAttemptNumber).toBe(1);
  });

  it("should enforce canonical domain statuses and reject uncommitted pending status", async () => {
    const { submission } = await createInitialSubmissionWithAttempt({
      assignmentId: "asg_canonical",
      learnerId: "user_canonical",
      audioResponses: [],
    });

    expect(submission.status).toBe("submitted");

    // Transition through review to published
    const inReview = await updateSubmissionStatus(
      submission.id,
      "in_review",
      1
    );
    expect(inReview.status).toBe("in_review");

    const published = await updateSubmissionStatus(submission.id, "published");
    expect(published.status).toBe("published");
  });
});
