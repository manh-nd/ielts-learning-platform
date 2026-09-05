import type {
  HomeworkSubmission,
  HomeworkSubmissionStatus,
} from "./homework-types";

/**
 * Pure, framework-agnostic HomeworkSubmission lifecycle policies.
 *
 * Canonical Domain Invariants (ADR-0009, CONTEXT.md):
 * - HomeworkSubmissionStatus = submitted | in_review | published
 * - SubmissionAttempt is immutable.
 * - Learner may resubmit only while the submission is still "submitted".
 * - Submission/resubmission must obey the strict SubmissionDeadline.
 * - CurrentAttempt and ReviewedAttempt are distinct domain concepts:
 *   Before review, CurrentAttempt is the candidate.
 *   When Teacher Review is claimed, that CurrentAttempt is locked as ReviewedAttempt.
 *   ReviewedAttempt is then authoritative for review and publication.
 * - "published" is terminal.
 *
 * Strict boundary rule: Zero imports of React, Next.js, database/Drizzle,
 * storage SDKs, Gemini SDK, telemetry, or fetch.
 */

export type TeacherReviewAvailability =
  "claimable" | "already_in_review" | "terminal";

export type ReviewAttempt =
  | {
      kind: "current_candidate";
      attemptNumber: number;
    }
  | {
      kind: "reviewed";
      attemptNumber: number;
    };

/**
 * Evaluates whether a Learner is permitted to submit a subsequent SubmissionAttempt.
 * A learner may resubmit only while the submission is still in "submitted" status.
 * Once teacher review starts ("in_review") or is published ("published"), resubmission is prohibited.
 */
export function canLearnerResubmit(status: HomeworkSubmissionStatus): boolean {
  return status === "submitted";
}

/**
 * Evaluates whether the submission deadline has passed.
 * SubmissionDeadline is the final instant when a submission is accepted:
 * - now <= deadline -> false (window is open; deadline instant is accepted)
 * - now > deadline  -> true  (deadline has passed; submission rejected)
 */
export function hasSubmissionDeadlinePassed(
  deadline: Date,
  now: Date
): boolean {
  return now.getTime() > deadline.getTime();
}

/**
 * Classifies the readiness of a submission from the Teacher Review lifecycle perspective:
 * - "submitted" -> "claimable" (awaiting Teacher review claim)
 * - "in_review" -> "already_in_review" (claimed and locked under review)
 * - "published" -> "terminal" (official published assessment finalized)
 */
export function getTeacherReviewAvailability(
  status: HomeworkSubmissionStatus
): TeacherReviewAvailability {
  if (status === "submitted") return "claimable";
  if (status === "in_review") return "already_in_review";
  return "terminal";
}

/**
 * Resolves the attempt role and attempt number for review and evaluation:
 * - Before review begins (reviewedAttemptNumber is null): returns CurrentAttempt as candidate.
 * - Once review starts (reviewedAttemptNumber is set): returns ReviewedAttempt as authoritative.
 */
export function resolveAttemptForReview(
  submission: Pick<
    HomeworkSubmission,
    "currentAttemptNumber" | "reviewedAttemptNumber"
  >
): ReviewAttempt {
  if (submission.reviewedAttemptNumber !== null) {
    return {
      kind: "reviewed",
      attemptNumber: submission.reviewedAttemptNumber,
    };
  }

  return {
    kind: "current_candidate",
    attemptNumber: submission.currentAttemptNumber,
  };
}
