import { findAttemptByNumber } from "../infrastructure/homework-submission-repository";
import {
  findTeacherAssessmentBySubmission,
  saveTeacherAssessment,
} from "../infrastructure/homework-assessment-repository";
import type { TeacherAssessment } from "../domain/homework-types";
import {
  getTeacherReviewAvailability,
  resolveAttemptForReview,
} from "../domain/homework-submission-lifecycle";
import { calculateIeltsSpeakingOverallBand } from "../domain/homework-types";
import { assertTeacherOwnsSubmission } from "./assert-teacher-owns-submission";
import {
  validateBandScore,
  validateAndNormalizeSpeakingAnnotations,
} from "./validate-homework-assessment";
import type { SaveAssessmentDraftInput } from "./homework-inputs";
import { NotFoundError, ConflictError } from "@/lib/errors";

export async function saveHomeworkReviewDraft(
  teacherId: string,
  submissionId: string,
  input: SaveAssessmentDraftInput
): Promise<TeacherAssessment> {
  const { submission, assignment } = await assertTeacherOwnsSubmission(
    teacherId,
    submissionId
  );

  const reviewAvailability = getTeacherReviewAvailability(submission.status);
  if (reviewAvailability === "claimable") {
    throw new ConflictError(
      "Phải bắt đầu chấm bài trước khi lưu bản nháp đánh giá.",
      { status: submission.status },
      "REVIEW_NOT_STARTED"
    );
  }

  if (reviewAvailability === "terminal") {
    throw new ConflictError(
      "Bài nộp này đã được xuất bản kết quả chính thức trước đó.",
      { status: submission.status },
      "SUBMISSION_ALREADY_PUBLISHED"
    );
  }

  const reviewAttempt = resolveAttemptForReview(submission);
  if (reviewAttempt.kind !== "reviewed") {
    throw new ConflictError(
      "Bài nộp chưa khóa lượt nộp chính thức để chấm điểm.",
      { submissionId: submission.id, status: submission.status },
      "REVIEW_ATTEMPT_NOT_LOCKED"
    );
  }

  const attemptNumber = reviewAttempt.attemptNumber;

  const attempt = await findAttemptByNumber(submission.id, attemptNumber);
  if (!attempt) {
    throw new NotFoundError(
      `Không tìm thấy dữ liệu lượt nộp #${attemptNumber}.`
    );
  }

  // Validate 4 IELTS Speaking criteria scores
  const fc = validateBandScore("Fluency & Coherence", input.fluencyCoherence);
  const lr = validateBandScore("Lexical Resource", input.lexicalResource);
  const gra = validateBandScore(
    "Grammatical Range & Accuracy",
    input.grammaticalRangeAccuracy
  );
  const pr = validateBandScore("Pronunciation", input.pronunciation);

  // Overall feedback can be empty for draft, but trim if provided
  const overallFeedback =
    typeof input.overallFeedback === "string"
      ? input.overallFeedback.trim()
      : "";

  // Validate and normalize annotations against assignment prompts and attempt audio responses
  const annotations = validateAndNormalizeSpeakingAnnotations(
    input.annotations,
    assignment.prompts,
    attempt.audioResponses
  );

  const overallBand = calculateIeltsSpeakingOverallBand(fc, lr, gra, pr);
  const now = new Date();

  // Check if teacher draft already exists for this submission attempt
  const existingAssessment = await findTeacherAssessmentBySubmission(
    submission.id
  );
  const existingDraft =
    existingAssessment?.status === "draft" &&
    existingAssessment.attemptNumber === attemptNumber
      ? existingAssessment
      : null;

  const draftToSave: TeacherAssessment = {
    id: existingDraft?.id ?? crypto.randomUUID(),
    submissionId: submission.id,
    assignmentId: submission.assignmentId,
    teacherId,
    attemptNumber,
    status: "draft",
    fluencyCoherence: fc,
    lexicalResource: lr,
    grammaticalRangeAccuracy: gra,
    pronunciation: pr,
    overallBand,
    overallFeedback,
    criteriaFeedback: input.criteriaFeedback || null,
    annotations,
    publishedAt: null,
    createdAt: existingDraft?.createdAt ?? now,
    updatedAt: now,
  };

  return await saveTeacherAssessment(draftToSave);
}
