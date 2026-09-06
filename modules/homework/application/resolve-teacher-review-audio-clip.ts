import { assertTeacherOwnsSubmission } from "./assert-teacher-owns-submission";
import { resolveAttemptForReview } from "../domain/homework-submission-lifecycle";
import { findAttemptByNumber } from "../infrastructure/homework-submission-repository";
import { NotFoundError } from "@/lib/errors";

export interface ResolvedTeacherReviewAudioClip {
  promptId: string;
  storageKey: string;
}

/**
 * Resolves the authorized audio clip for teacher inspection within a homework submission.
 * Enforces:
 * 1. Teacher owns the submission's classroom/assignment (assertTeacherOwnsSubmission)
 * 2. Resolves the authoritative review attempt (resolveAttemptForReview)
 * 3. Verifies the requested promptId exists within that attempt
 * 4. Returns the storage locator reference for server-side audio buffer fetching
 */
export async function resolveTeacherReviewAudioClip(
  teacherId: string,
  submissionId: string,
  promptId: string
): Promise<ResolvedTeacherReviewAudioClip> {
  const { submission } = await assertTeacherOwnsSubmission(
    teacherId,
    submissionId
  );

  const reviewAttempt = resolveAttemptForReview(submission);
  const attempt = await findAttemptByNumber(
    submission.id,
    reviewAttempt.attemptNumber
  );

  if (!attempt) {
    throw new NotFoundError(
      `Không tìm thấy dữ liệu lượt nộp #${reviewAttempt.attemptNumber}.`
    );
  }

  const clip = attempt.audioResponses.find((c) => c.promptId === promptId);
  if (!clip || !clip.storageKey) {
    throw new NotFoundError(
      `Không tìm thấy tệp âm thanh cho câu hỏi ${promptId}.`
    );
  }

  return {
    promptId: clip.promptId,
    storageKey: clip.storageKey,
  };
}
