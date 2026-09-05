import {
  findSubmissionById,
  claimTeacherReview,
  findAttemptByNumber,
} from "../infrastructure/homework-submission-repository";
import { findAssignmentById } from "../infrastructure/homework-assignment-repository";
import {
  findClassroomById,
  listClassroomRoster,
} from "@/modules/classroom/infrastructure/classroom-repository";
import {
  findAiProposalByAttemptId,
  findTeacherAssessmentBySubmission,
  commitHomeworkPublication,
  findPublishedAssessmentBySubmission,
} from "../infrastructure/homework-assessment-repository";
import {
  calculateIeltsSpeakingOverallBand,
  type HomeworkSubmission,
  type TeacherAssessment,
  type PublishedAssessment,
  type EvaluationFeedback,
} from "../domain/homework-types";
import {
  getTeacherReviewAvailability,
  resolveAttemptForReview,
} from "../domain/homework-submission-lifecycle";
import type { TeacherReviewCockpitData } from "./homework-read-models";
import type { PublishAssessmentInput } from "./homework-inputs";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";
import { recordTelemetryEvent } from "@/modules/telemetry/infrastructure/telemetry-repository";

/**
 * Validates teacher ownership of the classroom associated with the submission's assignment.
 */
async function assertTeacherOwnsSubmission(
  teacherId: string,
  submissionId: string
) {
  if (!teacherId) {
    throw new ValidationError("Thiếu thông tin định danh giáo viên.");
  }
  if (!submissionId) {
    throw new ValidationError("Thiếu mã bài nộp.");
  }

  const submission = await findSubmissionById(submissionId);
  if (!submission) {
    throw new NotFoundError("Không tìm thấy bài nộp được yêu cầu.");
  }

  const assignment = await findAssignmentById(submission.assignmentId);
  if (!assignment) {
    throw new NotFoundError("Không tìm thấy bài tập tương ứng.");
  }

  const classroom = await findClassroomById(assignment.classroomId);
  if (!classroom) {
    throw new NotFoundError("Không tìm thấy lớp học tương ứng.");
  }

  if (classroom.teacherId !== teacherId) {
    throw new ForbiddenError(
      "Bạn không có quyền truy cập hoặc chấm bài nộp của lớp học này."
    );
  }

  return { submission, assignment, classroom };
}

/**
 * Validates an IELTS criterion score (0.0 to 9.0 in increments of 0.5).
 */
function validateBandScore(name: string, score: unknown): number {
  if (typeof score !== "number" || isNaN(score)) {
    throw new ValidationError(`Điểm tiêu chí ${name} không hợp lệ.`);
  }
  if (score < 0 || score > 9) {
    throw new ValidationError(
      `Điểm tiêu chí ${name} phải nằm trong thang điểm từ 0.0 đến 9.0.`
    );
  }
  if ((score * 10) % 5 !== 0) {
    throw new ValidationError(
      `Điểm tiêu chí ${name} phải là số nguyên hoặc có đuôi .5.`
    );
  }
  return score;
}

/**
 * Retrieves full data required by Teacher Review Cockpit.
 * Graceful AI Failure handling: returns aiProposal: null if AI is missing or failed without crashing.
 */
export async function getTeacherReviewCockpit(
  teacherId: string,
  submissionId: string
): Promise<TeacherReviewCockpitData> {
  const { submission, assignment } = await assertTeacherOwnsSubmission(
    teacherId,
    submissionId
  );

  // Before review, CurrentAttempt is the candidate; after review claim, ReviewedAttempt is authoritative
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

  // AI Proposal (if any)
  const aiProposal = await findAiProposalByAttemptId(attempt.id);

  // Teacher review draft (if any)
  const teacherDraft = await findTeacherAssessmentBySubmission(submission.id);

  // Published assessment (if already published)
  const publishedAssessment = await findPublishedAssessmentBySubmission(
    submission.id
  );

  const members = await listClassroomRoster(assignment.classroomId);
  const member = members.find((m) => m.learnerId === submission.learnerId);

  return {
    assignment,
    submission,
    attempt,
    student: {
      id: submission.learnerId,
      name:
        member?.learnerName || `Học viên ${submission.learnerId.slice(0, 6)}`,
      email: member?.learnerEmail || `${submission.learnerId}@learner.local`,
      avatarUrl: member?.learnerImage || null,
    },
    aiProposal,
    teacherDraft,
    publishedAssessment,
  };
}

/**
 * Executes First-Committed-Wins Concurrency Lock:
 * Transitions submission status to "in_review" and locks reviewedAttemptNumber = currentAttemptNumber.
 */
export async function startTeacherReview(
  teacherId: string,
  submissionId: string
): Promise<HomeworkSubmission> {
  const { submission } = await assertTeacherOwnsSubmission(
    teacherId,
    submissionId
  );

  if (getTeacherReviewAvailability(submission.status) === "terminal") {
    throw new ConflictError(
      "Bài nộp đã được xuất bản kết quả đánh giá chính thức, không thể mở lại chấm.",
      { status: submission.status },
      "SUBMISSION_ALREADY_PUBLISHED"
    );
  }

  const result = await claimTeacherReview(submission.id);
  if (result.kind === "not_found") {
    throw new NotFoundError("Không tìm thấy bài nộp được yêu cầu.");
  }
  if (getTeacherReviewAvailability(result.submission.status) === "terminal") {
    throw new ConflictError(
      "Bài nộp đã được xuất bản kết quả đánh giá chính thức, không thể mở lại chấm.",
      { status: result.submission.status },
      "SUBMISSION_ALREADY_PUBLISHED"
    );
  }
  const updated = result.submission;

  recordTelemetryEvent({
    userId: teacherId,
    eventName: "teacher_review_opened",
    userRole: "teacher",
    contextType: "homework",
    contextId: submission.id,
    properties: {
      assignmentId: submission.assignmentId,
      learnerId: submission.learnerId,
      reviewedAttemptNumber: updated.reviewedAttemptNumber,
    },
  }).catch(() => {});

  return updated;
}

/**
 * Executes Single-Action Atomic Publish:
 * Validates criteria completeness, calculates overall band, marks submission 'published',
 * creates PublishedAssessment, saves TeacherAssessment, and records EvaluationFeedback.
 */
export async function publishTeacherAssessment(
  teacherId: string,
  submissionId: string,
  input: PublishAssessmentInput
): Promise<{
  submission: HomeworkSubmission;
  teacherAssessment: TeacherAssessment;
  publishedAssessment: PublishedAssessment;
  evaluationFeedback: EvaluationFeedback;
}> {
  const { submission, assignment } = await assertTeacherOwnsSubmission(
    teacherId,
    submissionId
  );

  if (getTeacherReviewAvailability(submission.status) === "terminal") {
    throw new ConflictError(
      "Bài nộp này đã được xuất bản kết quả chính thức trước đó.",
      { status: submission.status },
      "SUBMISSION_ALREADY_PUBLISHED"
    );
  }

  // Validate 4 IELTS Speaking criteria
  const fc = validateBandScore("Fluency & Coherence", input.fluencyCoherence);
  const lr = validateBandScore("Lexical Resource", input.lexicalResource);
  const gra = validateBandScore(
    "Grammatical Range & Accuracy",
    input.grammaticalRangeAccuracy
  );
  const pr = validateBandScore("Pronunciation", input.pronunciation);

  // Mandatory overall feedback
  if (!input.overallFeedback || !input.overallFeedback.trim()) {
    throw new ValidationError(
      "Nhận xét tổng quan của Giáo viên là bắt buộc trước khi Duyệt & Công bố."
    );
  }

  // Derive IELTS Overall Band with official rounding rules
  const overallBand = calculateIeltsSpeakingOverallBand(fc, lr, gra, pr);

  const reviewAttempt = resolveAttemptForReview(submission);
  const attemptNumber = reviewAttempt.attemptNumber;

  const now = new Date();
  const teacherAssessmentId = crypto.randomUUID();
  const publishedAssessmentId = crypto.randomUUID();
  const evaluationFeedbackId = crypto.randomUUID();

  // Prepare the finalized TeacherAssessment.
  const teacherAssessment: TeacherAssessment = {
    id: teacherAssessmentId,
    submissionId: submission.id,
    assignmentId: assignment.id,
    teacherId,
    attemptNumber,
    status: "published",
    fluencyCoherence: fc,
    lexicalResource: lr,
    grammaticalRangeAccuracy: gra,
    pronunciation: pr,
    overallBand,
    overallFeedback: input.overallFeedback.trim(),
    criteriaFeedback: input.criteriaFeedback || null,
    annotations: input.annotations || [],
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  // Prepare the separate immutable PublishedAssessment.
  const publishedAssessment: PublishedAssessment = {
    id: publishedAssessmentId,
    submissionId: submission.id,
    assignmentId: assignment.id,
    teacherAssessmentId,
    learnerId: submission.learnerId,
    teacherId,
    attemptNumber,
    fluencyCoherence: fc,
    lexicalResource: lr,
    grammaticalRangeAccuracy: gra,
    pronunciation: pr,
    overallBand,
    overallFeedback: input.overallFeedback.trim(),
    criteriaFeedback: input.criteriaFeedback || null,
    publishedAt: now,
  };

  // Prepare AI acceptance and calibration metrics (Contract §7.3).
  const attempt = await findAttemptByNumber(submission.id, attemptNumber);
  if (!attempt) {
    throw new NotFoundError("Không tìm thấy dữ liệu lượt nộp được đánh giá.");
  }
  const aiProposal = await findAiProposalByAttemptId(attempt.id);

  let aiProposalAccepted = false;
  let scoreDeltas = {
    fluencyCoherence: 0,
    lexicalResource: 0,
    grammaticalRangeAccuracy: 0,
    pronunciation: 0,
    overallBand: 0,
  };
  const modifiedCriteria: string[] = [];

  if (aiProposal && aiProposal.status === "ready") {
    const aiScores = aiProposal.scores;
    const diffFc = Number((fc - aiScores.fluencyAndCoherence).toFixed(1));
    const diffLr = Number((lr - aiScores.lexicalResource).toFixed(1));
    const diffGra = Number(
      (gra - aiScores.grammaticalRangeAndAccuracy).toFixed(1)
    );
    const diffPr = Number((pr - aiScores.pronunciation).toFixed(1));
    const diffOverall = Number(
      (overallBand - aiProposal.overallBand).toFixed(1)
    );

    scoreDeltas = {
      fluencyCoherence: diffFc,
      lexicalResource: diffLr,
      grammaticalRangeAccuracy: diffGra,
      pronunciation: diffPr,
      overallBand: diffOverall,
    };

    if (diffFc !== 0) modifiedCriteria.push("fluencyCoherence");
    if (diffLr !== 0) modifiedCriteria.push("lexicalResource");
    if (diffGra !== 0) modifiedCriteria.push("grammaticalRangeAccuracy");
    if (diffPr !== 0) modifiedCriteria.push("pronunciation");

    // Acceptance formula from speaking-pilot-acceptance-contract.md (§7.3):
    // |Teacher Overall - AI Overall| <= 0.5 AND at most 1 criterion has |delta| >= 1.0
    const largeDeltaCount = [diffFc, diffLr, diffGra, diffPr].filter(
      (d) => Math.abs(d) >= 1.0
    ).length;

    aiProposalAccepted = Math.abs(diffOverall) <= 0.5 && largeDeltaCount <= 1;
  }

  const evaluationFeedback: EvaluationFeedback = {
    id: evaluationFeedbackId,
    submissionId: submission.id,
    teacherAssessmentId,
    aiProposalId: aiProposal?.id || null,
    attemptNumber,
    teacherId,
    activeReviewDurationMs: Math.max(0, input.activeReviewDurationMs || 0),
    aiProposalAccepted,
    scoreDeltas,
    teacherModifications: {
      modifiedCriteria,
      teacherOverallDiff: scoreDeltas.overallBand,
    },
    modelVersion: aiProposal?.modelVersion || "gemini-2.5-flash",
    createdAt: now,
  };

  const publication = await commitHomeworkPublication({
    expectedSubmission: submission,
    teacherAssessment,
    publishedAssessment,
    evaluationFeedback,
  });
  if (publication.kind === "not_found") {
    throw new NotFoundError("Không tìm thấy bài nộp được yêu cầu.");
  }
  if (publication.kind === "no_transition") {
    const alreadyPublished =
      getTeacherReviewAvailability(publication.submission.status) ===
      "terminal";
    throw new ConflictError(
      alreadyPublished
        ? "Bài nộp này đã được xuất bản kết quả chính thức trước đó."
        : "Bài nộp đã thay đổi. Vui lòng tải lại trước khi công bố.",
      { status: publication.submission.status },
      alreadyPublished
        ? "SUBMISSION_ALREADY_PUBLISHED"
        : "SUBMISSION_STATE_CHANGED"
    );
  }

  if (aiProposal?.status === "ready") {
    // Telemetry for proposal accept/reject
    observePublication({
      userId: teacherId,
      eventName: aiProposalAccepted
        ? "teacher_ai_proposal_accepted"
        : "teacher_ai_proposal_rejected",
      userRole: "teacher",
      contextType: "homework",
      contextId: submission.id,
      properties: {
        aiProposalId: aiProposal.id,
        scoreDeltas,
        aiProposalAccepted,
      },
    });
  }

  // Observe only after the official business commit.
  observePublication({
    userId: teacherId,
    eventName: "teacher_assessment_published",
    userRole: "teacher",
    contextType: "homework",
    contextId: submission.id,
    durationMs: evaluationFeedback.activeReviewDurationMs,
    properties: {
      assignmentId: assignment.id,
      learnerId: submission.learnerId,
      overallBand,
      attemptNumber,
    },
  });

  return {
    submission: publication.submission,
    teacherAssessment,
    publishedAssessment,
    evaluationFeedback,
  };
}

/** Observation must never invalidate a committed publication, even on a synchronous throw. */
function observePublication(
  event: Parameters<typeof recordTelemetryEvent>[0]
): void {
  try {
    void recordTelemetryEvent(event).catch(() => {});
  } catch {
    // Best-effort telemetry.
  }
}
