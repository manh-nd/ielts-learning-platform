import type { HomeworkSubmission } from "@/modules/homework/domain/homework-types";
import type { CommitHomeworkPublicationInput } from "@/modules/homework/infrastructure/homework-assessment-repository";

export function publicationFixture(
  submission: HomeworkSubmission,
  teacherId = "teacher"
): CommitHomeworkPublicationInput {
  const now = new Date();
  const common = {
    submissionId: submission.id,
    assignmentId: submission.assignmentId,
    teacherId,
    attemptNumber:
      submission.reviewedAttemptNumber ?? submission.currentAttemptNumber,
    fluencyCoherence: 7,
    lexicalResource: 7,
    grammaticalRangeAccuracy: 7,
    pronunciation: 7,
    overallBand: 7,
    overallFeedback: "Teacher feedback",
    criteriaFeedback: null,
    publishedAt: now,
  };
  const teacherAssessment = {
    ...common,
    id: crypto.randomUUID(),
    status: "published" as const,
    annotations: [],
    createdAt: now,
    updatedAt: now,
  };
  return {
    expectedSubmission: { ...submission },
    teacherAssessment,
    publishedAssessment: {
      ...common,
      id: crypto.randomUUID(),
      teacherAssessmentId: teacherAssessment.id,
      learnerId: submission.learnerId,
    },
    evaluationFeedback: {
      id: crypto.randomUUID(),
      submissionId: submission.id,
      teacherAssessmentId: teacherAssessment.id,
      aiProposalId: null,
      attemptNumber: common.attemptNumber,
      teacherId,
      activeReviewDurationMs: 1000,
      aiProposalAccepted: false,
      scoreDeltas: {
        fluencyCoherence: 0,
        lexicalResource: 0,
        grammaticalRangeAccuracy: 0,
        pronunciation: 0,
        overallBand: 0,
      },
      teacherModifications: { modifiedCriteria: [], teacherOverallDiff: 0 },
      modelVersion: "gemini-2.5-flash",
      createdAt: now,
    },
  };
}
