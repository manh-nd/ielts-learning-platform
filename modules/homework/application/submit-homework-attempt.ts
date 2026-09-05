import { assertLearnerEnrolledInAssignmentClassroom } from "./assert-learner-enrolled-in-assignment-classroom";
import {
  findSubmissionByAssignmentAndLearner,
  createInitialSubmissionWithAttempt,
  commitResubmission,
} from "../infrastructure/homework-submission-repository";
import type {
  HomeworkSubmission,
  SubmissionAttempt,
} from "../domain/homework-types";
import {
  canLearnerResubmit,
  hasSubmissionDeadlinePassed,
} from "../domain/homework-submission-lifecycle";
import type { SubmitHomeworkInput } from "./homework-inputs";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/errors";
import { isHomeworkAudioStorageKeyOwnedBy } from "@/lib/storage/s3-client";

/**
 * Submits or resubmits a discrete IELTS Speaking homework attempt.
 * Preserves invariants:
 * - Immutable SubmissionAttempt snapshots
 * - All prompts must have valid audio recordings
 * - Strict deadline validation (no submissions after submissionDeadline)
 * - First-Committed-Wins concurrency lock (HTTP 409 Conflict if status is in_review or published)
 *
 * Committing an attempt currently does not trigger HomeworkEvaluation.
 * No HomeworkEvaluation dispatcher is implemented yet.
 */
export async function submitLearnerHomeworkAttempt(
  learnerId: string,
  assignmentId: string,
  input: SubmitHomeworkInput
): Promise<{ submission: HomeworkSubmission; attempt: SubmissionAttempt }> {
  const assignment = await assertLearnerEnrolledInAssignmentClassroom(
    learnerId,
    assignmentId
  );

  // 1. Deadline check: Strict rejection after deadline
  const now = new Date();
  if (hasSubmissionDeadlinePassed(assignment.submissionDeadline, now)) {
    throw new ValidationError(
      "Đã hết hạn nộp bài. Hệ thống không tiếp nhận thêm bài làm sau thời hạn chót."
    );
  }

  // 2. Validate audio responses against assignment prompts
  if (!input || !Array.isArray(input.audioResponses)) {
    throw new ValidationError("Dữ liệu bài nộp âm thanh không hợp lệ.");
  }

  const assignmentPromptIds = new Set(
    assignment.prompts.map((p) => p.promptId)
  );
  const submittedPromptIds = new Set(
    input.audioResponses.map((r) => r.promptId)
  );

  for (const promptId of assignmentPromptIds) {
    if (!submittedPromptIds.has(promptId)) {
      throw new ValidationError(
        "Chưa ghi âm đủ câu trả lời cho tất cả các câu hỏi trong đề bài."
      );
    }
  }

  for (const clip of input.audioResponses) {
    if (!clip.promptId || !assignmentPromptIds.has(clip.promptId)) {
      throw new ValidationError("Có clip âm thanh không thuộc đề bài này.");
    }
    if (!clip.storageKey || typeof clip.storageKey !== "string") {
      throw new ValidationError("Thiếu thông tin đường dẫn lưu trữ âm thanh.");
    }
    if (
      !isHomeworkAudioStorageKeyOwnedBy(
        clip.storageKey,
        learnerId,
        assignmentId
      )
    ) {
      throw new ValidationError(
        "Khóa lưu trữ âm thanh không hợp lệ hoặc không thuộc về học viên."
      );
    }
    if (typeof clip.durationMs !== "number" || clip.durationMs <= 0) {
      throw new ValidationError(
        "Thời lượng bản ghi âm phải lớn hơn 0 mili-giây."
      );
    }
    if (typeof clip.audioBytes !== "number" || clip.audioBytes <= 0) {
      throw new ValidationError(
        "Kích thước file âm thanh phải lớn hơn 0 bytes."
      );
    }
  }

  // 3. Concurrency check & submission creation/resubmission
  const existingSubmission = await findSubmissionByAssignmentAndLearner(
    assignmentId,
    learnerId
  );

  if (existingSubmission) {
    // First-Committed-Wins Concurrency Lock: Only "submitted" status can be resubmitted
    if (!canLearnerResubmit(existingSubmission.status)) {
      throwResubmissionConflict(existingSubmission);
    }

    // Resubmission: Create immutable attempt #N
    const result = await commitResubmission({
      submissionId: existingSubmission.id,
      expectedCurrentAttemptNumber: existingSubmission.currentAttemptNumber,
      audioResponses: input.audioResponses,
    });
    if (result.kind === "not_found") {
      throw new NotFoundError("Không tìm thấy bài nộp được yêu cầu.");
    }
    if (result.kind === "no_transition") {
      throwResubmissionConflict(result.submission);
    }

    return { submission: result.submission, attempt: result.attempt };
  }

  // Initial submission: Create attempt #1
  const result = await createInitialSubmissionWithAttempt({
    assignmentId,
    learnerId,
    audioResponses: input.audioResponses,
    status: "submitted",
  });

  return result;
}

function throwResubmissionConflict(submission: HomeworkSubmission): never {
  if (submission.status === "in_review") {
    throw new ConflictError(
      "Bài làm đã được Giáo viên tiếp nhận chấm, không thể nộp lại.",
      { status: submission.status },
      "SUBMISSION_UNDER_REVIEW"
    );
  }
  if (submission.status === "published") {
    throw new ConflictError(
      "Bài làm đã được Giáo viên xuất bản kết quả đánh giá, không thể nộp lại.",
      { status: submission.status },
      "SUBMISSION_PUBLISHED"
    );
  }
  throw new ConflictError(
    `Không thể nộp lại bài làm khi đang ở trạng thái "${submission.status}".`,
    { status: submission.status },
    "SUBMISSION_INVALID_STATE"
  );
}
