import { describe, it, expect } from "bun:test";
import {
  canLearnerResubmit,
  hasSubmissionDeadlinePassed,
  getTeacherReviewAvailability,
  resolveAttemptForReview,
} from "./homework-submission-lifecycle";

describe("HomeworkSubmission Lifecycle Domain Policies (Issue #90, ADR-0009, CONTEXT.md)", () => {
  describe("canLearnerResubmit", () => {
    it("should allow resubmission when status is submitted", () => {
      expect(canLearnerResubmit("submitted")).toBe(true);
    });

    it("should disallow resubmission when status is in_review", () => {
      expect(canLearnerResubmit("in_review")).toBe(false);
    });

    it("should disallow resubmission when status is published", () => {
      expect(canLearnerResubmit("published")).toBe(false);
    });
  });

  describe("hasSubmissionDeadlinePassed (Strict SubmissionDeadline Boundary)", () => {
    const deadline = new Date("2026-09-05T12:00:00.000Z");

    it("should return false when now is strictly before deadline", () => {
      const now = new Date("2026-09-05T11:59:59.999Z");
      expect(hasSubmissionDeadlinePassed(deadline, now)).toBe(false);
    });

    it("should return false at the exact millisecond of the deadline (final instant is accepted)", () => {
      const now = new Date("2026-09-05T12:00:00.000Z");
      expect(hasSubmissionDeadlinePassed(deadline, now)).toBe(false);
    });

    it("should return true when now is after the deadline", () => {
      const now = new Date("2026-09-05T12:00:00.001Z");
      expect(hasSubmissionDeadlinePassed(deadline, now)).toBe(true);
    });
  });

  describe("getTeacherReviewAvailability", () => {
    it("should classify submitted status as claimable", () => {
      expect(getTeacherReviewAvailability("submitted")).toBe("claimable");
    });

    it("should classify in_review status as already_in_review", () => {
      expect(getTeacherReviewAvailability("in_review")).toBe(
        "already_in_review"
      );
    });

    it("should classify published status as terminal", () => {
      expect(getTeacherReviewAvailability("published")).toBe("terminal");
    });
  });

  describe("resolveAttemptForReview (CurrentAttempt vs ReviewedAttempt semantics)", () => {
    it("should resolve candidate attempt to CurrentAttempt before review begins", () => {
      const submission = {
        currentAttemptNumber: 2,
        reviewedAttemptNumber: null,
      };

      const result = resolveAttemptForReview(submission);

      expect(result).toEqual({
        kind: "current_candidate",
        attemptNumber: 2,
      });
    });

    it("should resolve to ReviewedAttempt once review has been claimed", () => {
      // When Teacher starts review, reviewedAttemptNumber is locked to currentAttemptNumber
      const submission = {
        currentAttemptNumber: 2,
        reviewedAttemptNumber: 2,
      };

      const result = resolveAttemptForReview(submission);

      expect(result).toEqual({
        kind: "reviewed",
        attemptNumber: 2,
      });
    });

    it("should resolve to ReviewedAttempt in terminal published state", () => {
      const submission = {
        currentAttemptNumber: 2,
        reviewedAttemptNumber: 2,
      };

      const result = resolveAttemptForReview(submission);

      expect(result).toEqual({
        kind: "reviewed",
        attemptNumber: 2,
      });
    });
  });
});
