import { findAssignmentById } from "../infrastructure/homework-assignment-repository";
import {
  findMember,
  findClassroomById,
} from "@/modules/classroom/infrastructure/classroom-repository";
import {
  findSubmissionByAssignmentAndLearner,
  createInitialSubmissionWithAttempt,
  createSubsequentAttempt,
  listAttemptsBySubmissionId,
  findAttemptByNumber,
} from "../infrastructure/homework-submission-repository";
import type {
  HomeworkSubmission,
  SubmissionAttempt,
  LearnerHomeworkDetail,
  SubmitHomeworkInput,
} from "../domain/homework-types";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";
import { isHomeworkAudioStorageKeyOwnedBy } from "@/lib/storage/s3-client";

/**
 * Validates learner membership and homework assignment availability.
 */
async function assertLearnerEnrolledInAssignmentClassroom(
  learnerId: string,
  assignmentId: string
) {
  if (!learnerId) {
    throw new ValidationError("Thiếu thông tin định danh học viên.");
  }
  if (!assignmentId) {
    throw new ValidationError("Thiếu mã bài tập.");
  }

  const assignment = await findAssignmentById(assignmentId);
  if (!assignment) {
    throw new NotFoundError("Không tìm thấy bài tập được yêu cầu.");
  }

  // Verify learner is enrolled in the classroom
  const member = await findMember(assignment.classroomId, learnerId);
  if (!member) {
    throw new ForbiddenError("Bạn không phải là thành viên của lớp học này.");
  }

  // Learner can only see published assignments (drafts are teacher-private)
  if (assignment.status !== "published") {
    throw new ForbiddenError(
      "Bài tập này chưa được xuất bản hoặc đã bị thu hồi."
    );
  }

  return assignment;
}

/**
 * Retrieves assignment details, classroom information, and current submission status for a learner.
 */
export async function getLearnerAssignmentDetails(
  learnerId: string,
  assignmentId: string
): Promise<LearnerHomeworkDetail> {
  const assignment = await assertLearnerEnrolledInAssignmentClassroom(
    learnerId,
    assignmentId
  );

  const classroom = await findClassroomById(assignment.classroomId);
  const classroomInfo = {
    id: assignment.classroomId,
    name: classroom?.name || "Lớp học",
  };

  const submission = await findSubmissionByAssignmentAndLearner(
    assignmentId,
    learnerId
  );

  if (!submission) {
    return {
      assignment,
      classroom: classroomInfo,
      submission: null,
      currentAttempt: null,
      allAttempts: [],
    };
  }

  const allAttempts = await listAttemptsBySubmissionId(submission.id);
  const currentAttempt =
    (await findAttemptByNumber(
      submission.id,
      submission.currentAttemptNumber
    )) ||
    allAttempts[allAttempts.length - 1] ||
    null;

  return {
    assignment,
    classroom: classroomInfo,
    submission,
    currentAttempt,
    allAttempts,
  };
}

/**
 * Submits or resubmits a discrete IELTS Speaking homework attempt.
 * Preserves invariants:
 * - Immutable SubmissionAttempt snapshots
 * - All prompts must have valid audio recordings
 * - Strict deadline validation (no submissions after submissionDeadline)
 * - First-Committed-Wins concurrency lock (HTTP 409 Conflict if status is in_review or published)
 * - Decoupled background AI proposal dispatch
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
  if (now.getTime() > assignment.submissionDeadline.getTime()) {
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
    if (existingSubmission.status !== "submitted") {
      if (existingSubmission.status === "in_review") {
        throw new ConflictError(
          "Bài làm đã được Giáo viên tiếp nhận chấm, không thể nộp lại.",
          { status: existingSubmission.status },
          "SUBMISSION_UNDER_REVIEW"
        );
      }
      if (existingSubmission.status === "published") {
        throw new ConflictError(
          "Bài làm đã được Giáo viên xuất bản kết quả đánh giá, không thể nộp lại.",
          { status: existingSubmission.status },
          "SUBMISSION_PUBLISHED"
        );
      }
      throw new ConflictError(
        `Không thể nộp lại bài làm khi đang ở trạng thái "${existingSubmission.status}".`,
        { status: existingSubmission.status },
        "SUBMISSION_INVALID_STATE"
      );
    }

    // Resubmission: Create immutable attempt #N
    const result = await createSubsequentAttempt(
      existingSubmission.id,
      input.audioResponses
    );

    // Asynchronous AI proposal trigger placeholder
    dispatchBackgroundAiEvaluation(result.submission.id, result.attempt.id);

    return result;
  }

  // Initial submission: Create attempt #1
  const result = await createInitialSubmissionWithAttempt({
    assignmentId,
    learnerId,
    audioResponses: input.audioResponses,
    status: "submitted",
  });

  // Asynchronous AI proposal trigger placeholder
  dispatchBackgroundAiEvaluation(result.submission.id, result.attempt.id);

  return result;
}

/**
 * Dispatches asynchronous AI evaluation in the background.
 * Decoupled & non-blocking: Never throws or fails the submission attempt.
 */
function dispatchBackgroundAiEvaluation(
  submissionId: string,
  attemptId: string
): void {
  // HomeworkEvaluation background job will be processed by worker / downstream #76
  console.info(
    `[HomeworkSubmissionService] Queued background AI evaluation for submission=${submissionId}, attempt=${attemptId}`
  );
}
