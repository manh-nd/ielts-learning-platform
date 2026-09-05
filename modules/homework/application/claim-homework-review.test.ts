import * as telemetryRepository from "@/modules/telemetry/infrastructure/telemetry-repository";
import * as submissionRepository from "../infrastructure/homework-submission-repository";
import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { getTeacherReviewCockpit } from "./get-teacher-review-cockpit";
import { claimHomeworkReview } from "./claim-homework-review";
import { submitLearnerHomeworkAttempt } from "./submit-homework-attempt";
import { ConflictError } from "@/lib/errors";
import {
  createTeacherHomeworkReviewFixture,
  teacherId,
  otherTeacherId,
  learnerId,
} from "@/tests/fixtures/teacher-homework-review";

describe("claim-homework-review", () => {
  let assignmentId: string;
  let submissionId: string;
  beforeEach(async () => {
    ({ assignmentId, submissionId } =
      await createTeacherHomeworkReviewFixture());
  });
  it("rejects a foreign Teacher without claiming the submission", async () => {
    await expect(
      claimHomeworkReview(otherTeacherId, submissionId)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(
      (await getTeacherReviewCockpit(teacherId, submissionId)).submission.status
    ).toBe("submitted");
  });

  for (const synchronous of [true, false]) {
    it(`preserves claimed review when telemetry ${synchronous ? "throws" : "rejects"}`, async () => {
      const telemetry = spyOn(
        telemetryRepository,
        "recordTelemetryEvent"
      ).mockImplementation(() => {
        if (synchronous) throw new Error("telemetry failed");
        return Promise.reject(new Error("telemetry failed"));
      });
      try {
        const result = await claimHomeworkReview(teacherId, submissionId);
        expect(result.status).toBe("in_review");
        expect(
          (await getTeacherReviewCockpit(teacherId, submissionId)).submission
            .reviewedAttemptNumber
        ).toBe(1);
      } finally {
        telemetry.mockRestore();
      }
    });
  }

  describe("First-Committed-Wins Concurrency Lock (claimHomeworkReview vs Learner Resubmit)", () => {
    it("opens the newly committed attempt even if ownership checked an older snapshot", async () => {
      const originalClaim = submissionRepository.claimTeacherReview;
      const claim = spyOn(
        submissionRepository,
        "claimTeacherReview"
      ).mockImplementation(async (id) => {
        await submissionRepository.commitResubmission({
          submissionId: id,
          expectedCurrentAttemptNumber: 1,
          audioResponses: [],
        });
        return originalClaim(id);
      });
      try {
        expect(
          await claimHomeworkReview(teacherId, submissionId)
        ).toMatchObject({
          currentAttemptNumber: 2,
          reviewedAttemptNumber: 2,
          status: "in_review",
        });
      } finally {
        claim.mockRestore();
      }
      const reopened = await claimHomeworkReview(teacherId, submissionId);
      expect(reopened.reviewedAttemptNumber).toBe(2);
    });

    it("maps a published conditional claim result to the existing conflict", async () => {
      const submission =
        await submissionRepository.findSubmissionById(submissionId);
      if (!submission) throw new Error("Missing fixture");
      const claim = spyOn(
        submissionRepository,
        "claimTeacherReview"
      ).mockResolvedValue({
        kind: "no_transition",
        submission: {
          ...submission,
          status: "published",
          reviewedAttemptNumber: 1,
        },
      });
      try {
        await expect(
          claimHomeworkReview(teacherId, submissionId)
        ).rejects.toMatchObject({
          code: "SUBMISSION_ALREADY_PUBLISHED",
          statusCode: 409,
        });
      } finally {
        claim.mockRestore();
      }
    });

    it("should transition status to in_review and lock reviewedAttemptNumber", async () => {
      const updated = await claimHomeworkReview(teacherId, submissionId);
      expect(updated.status).toBe("in_review");
      expect(updated.reviewedAttemptNumber).toBe(1);
    });

    it("should reject learner resubmission with 409 Conflict once review has started", async () => {
      // 1. Teacher starts review
      await claimHomeworkReview(teacherId, submissionId);

      // 2. Learner attempts to resubmit
      await expect(
        submitLearnerHomeworkAttempt(learnerId, assignmentId, {
          audioResponses: [
            {
              promptId: "prompt_p1_1",
              storageKey: `homework/${learnerId}/${assignmentId}/p1_v2.webm`,
              durationMs: 50000,
              audioBytes: 160000,
            },
            {
              promptId: "prompt_p1_2",
              storageKey: `homework/${learnerId}/${assignmentId}/p2_v2.webm`,
              durationMs: 40000,
              audioBytes: 130000,
            },
          ],
        })
      ).rejects.toThrow(ConflictError);
    });
  });
});
