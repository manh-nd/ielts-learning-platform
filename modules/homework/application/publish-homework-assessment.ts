import { findAttemptByNumber } from "../infrastructure/homework-submission-repository";
import {
  findAiProposalByAttemptId,
  commitHomeworkPublication,
} from "../infrastructure/homework-assessment-repository";
import type {
  HomeworkSubmission,
  TeacherAssessment,
  PublishedAssessment,
  EvaluationFeedback,
} from "../domain/homework-types";
import {
  getTeacherReviewAvailability,
  resolveAttemptForReview,
} from "../domain/homework-submission-lifecycle";
import { calibrateHomeworkAssessment } from "../domain/calibrate-homework-assessment";
import { prepareHomeworkPublication } from "../domain/prepare-homework-publication";
import { assertTeacherOwnsSubmission } from "./assert-teacher-owns-submission";
import { validateHomeworkAssessment } from "./validate-homework-assessment";
import { observeHomeworkReview } from "./observe-homework-review";
import type { PublishAssessmentInput } from "./homework-inputs";
import { NotFoundError, ConflictError } from "@/lib/errors";

export async function publishHomeworkAssessment(
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

  const validatedInput = validateHomeworkAssessment(input);

  const reviewAttempt = resolveAttemptForReview(submission);
  const attemptNumber = reviewAttempt.attemptNumber;

  // Prepare AI acceptance and calibration metrics (Contract §7.3).
  const attempt = await findAttemptByNumber(submission.id, attemptNumber);
  if (!attempt) {
    throw new NotFoundError("Không tìm thấy dữ liệu lượt nộp được đánh giá.");
  }
  const aiProposal = await findAiProposalByAttemptId(attempt.id);

  const calibration = calibrateHomeworkAssessment(validatedInput, aiProposal);
  const { teacherAssessment, publishedAssessment, evaluationFeedback } =
    prepareHomeworkPublication({
      submission,
      teacherId,
      attemptNumber,
      input: validatedInput,
      aiProposal,
      calibration,
      now: new Date(),
      teacherAssessmentId: crypto.randomUUID(),
      publishedAssessmentId: crypto.randomUUID(),
      evaluationFeedbackId: crypto.randomUUID(),
    });

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
    observeHomeworkReview({
      userId: teacherId,
      eventName: calibration.aiProposalAccepted
        ? "teacher_ai_proposal_accepted"
        : "teacher_ai_proposal_rejected",
      userRole: "teacher",
      contextType: "homework",
      contextId: submission.id,
      properties: {
        aiProposalId: aiProposal.id,
        scoreDeltas: calibration.scoreDeltas,
        aiProposalAccepted: calibration.aiProposalAccepted,
      },
    });
  }

  // Observe only after the official business commit.
  observeHomeworkReview({
    userId: teacherId,
    eventName: "teacher_assessment_published",
    userRole: "teacher",
    contextType: "homework",
    contextId: submission.id,
    durationMs: evaluationFeedback.activeReviewDurationMs,
    properties: {
      assignmentId: assignment.id,
      learnerId: submission.learnerId,
      overallBand: teacherAssessment.overallBand,
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
