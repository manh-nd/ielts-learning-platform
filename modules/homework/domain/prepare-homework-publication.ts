import type {
  AiAssessmentProposal,
  HomeworkSubmission,
  TeacherAssessment,
  PublishedAssessment,
  EvaluationFeedback,
} from "./homework-types";
import type { HomeworkAssessmentCalibration } from "./calibrate-homework-assessment";

type ValidatedTeacherAssessment = Pick<
  TeacherAssessment,
  | "fluencyCoherence"
  | "lexicalResource"
  | "grammaticalRangeAccuracy"
  | "pronunciation"
  | "overallBand"
  | "overallFeedback"
> &
  Partial<Pick<TeacherAssessment, "criteriaFeedback" | "annotations">> & {
    activeReviewDurationMs: number;
  };

/** Prepare distinct official records; the caller commits them together atomically. */
export function prepareHomeworkPublication({
  submission,
  teacherId,
  attemptNumber,
  input,
  aiProposal,
  calibration,
  now,
  teacherAssessmentId,
  publishedAssessmentId,
  evaluationFeedbackId,
}: {
  submission: HomeworkSubmission;
  teacherId: string;
  attemptNumber: number;
  input: ValidatedTeacherAssessment;
  aiProposal: AiAssessmentProposal | null;
  calibration: HomeworkAssessmentCalibration;
  now: Date;
  teacherAssessmentId: string;
  publishedAssessmentId: string;
  evaluationFeedbackId: string;
}) {
  const { aiProposalAccepted, scoreDeltas, modifiedCriteria } = calibration;
  // Prepare the finalized TeacherAssessment.
  const teacherAssessment: TeacherAssessment = {
    id: teacherAssessmentId,
    submissionId: submission.id,
    assignmentId: submission.assignmentId,
    teacherId,
    attemptNumber,
    status: "published",
    fluencyCoherence: input.fluencyCoherence,
    lexicalResource: input.lexicalResource,
    grammaticalRangeAccuracy: input.grammaticalRangeAccuracy,
    pronunciation: input.pronunciation,
    overallBand: input.overallBand,
    overallFeedback: input.overallFeedback,
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
    assignmentId: submission.assignmentId,
    teacherAssessmentId,
    learnerId: submission.learnerId,
    teacherId,
    attemptNumber,
    fluencyCoherence: input.fluencyCoherence,
    lexicalResource: input.lexicalResource,
    grammaticalRangeAccuracy: input.grammaticalRangeAccuracy,
    pronunciation: input.pronunciation,
    overallBand: input.overallBand,
    overallFeedback: input.overallFeedback,
    criteriaFeedback: input.criteriaFeedback || null,
    publishedAt: now,
  };

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

  return { teacherAssessment, publishedAssessment, evaluationFeedback };
}
