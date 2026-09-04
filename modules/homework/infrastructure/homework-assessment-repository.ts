import { db } from "@/lib/db";
import {
  aiAssessmentProposals,
  teacherAssessments,
  publishedAssessments,
  evaluationFeedbacks,
} from "./homework-schema";
import type {
  AiAssessmentProposal,
  TeacherAssessment,
  PublishedAssessment,
  EvaluationFeedback,
  SpeakingCriteriaScores,
  SpeakingCriteriaFeedback,
  SpeakingReviewAnnotationItem,
} from "../domain/homework-types";
import { eq, and, desc } from "drizzle-orm";

// In-memory cache for development and test isolation
const globalForAssessment = globalThis as unknown as {
  devAiProposalCache?: Map<string, AiAssessmentProposal>;
  devTeacherAssessmentCache?: Map<string, TeacherAssessment>;
  devPublishedAssessmentCache?: Map<string, PublishedAssessment>;
  devEvaluationFeedbackCache?: Map<string, EvaluationFeedback[]>;
};

export const devAiProposalCache: Map<string, AiAssessmentProposal> =
  globalForAssessment.devAiProposalCache ||
  new Map<string, AiAssessmentProposal>();

export const devTeacherAssessmentCache: Map<string, TeacherAssessment> =
  globalForAssessment.devTeacherAssessmentCache ||
  new Map<string, TeacherAssessment>();

export const devPublishedAssessmentCache: Map<string, PublishedAssessment> =
  globalForAssessment.devPublishedAssessmentCache ||
  new Map<string, PublishedAssessment>();

export const devEvaluationFeedbackCache: Map<string, EvaluationFeedback[]> =
  globalForAssessment.devEvaluationFeedbackCache ||
  new Map<string, EvaluationFeedback[]>();

if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_E2E_MOCK_AUTH === "true"
) {
  globalForAssessment.devAiProposalCache = devAiProposalCache;
  globalForAssessment.devTeacherAssessmentCache = devTeacherAssessmentCache;
  globalForAssessment.devPublishedAssessmentCache = devPublishedAssessmentCache;
  globalForAssessment.devEvaluationFeedbackCache = devEvaluationFeedbackCache;
}

export function clearDevHomeworkAssessmentCache(): void {
  devAiProposalCache.clear();
  devTeacherAssessmentCache.clear();
  devPublishedAssessmentCache.clear();
  devEvaluationFeedbackCache.clear();
}

/**
 * Saves or updates an AI assessment proposal.
 */
export async function saveAiProposal(
  proposal: AiAssessmentProposal
): Promise<AiAssessmentProposal> {
  devAiProposalCache.set(proposal.attemptId, proposal);

  if (process.env.DATABASE_URL) {
    try {
      await db
        .insert(aiAssessmentProposals)
        .values({
          id: proposal.id,
          submissionId: proposal.submissionId,
          attemptId: proposal.attemptId,
          attemptNumber: proposal.attemptNumber,
          status: proposal.status,
          scores: proposal.scores,
          overallBand: proposal.overallBand,
          feedbackSummary: proposal.feedbackSummary,
          strengths: proposal.strengths,
          improvements: proposal.improvements,
          actionPlan: proposal.actionPlan,
          pronunciationNotes: proposal.pronunciationNotes,
          rawProposalJson: proposal.rawProposalJson,
          modelVersion: proposal.modelVersion,
          createdAt: proposal.createdAt,
          updatedAt: proposal.updatedAt,
        })
        .onConflictDoUpdate({
          target: aiAssessmentProposals.id,
          set: {
            status: proposal.status,
            scores: proposal.scores,
            overallBand: proposal.overallBand,
            feedbackSummary: proposal.feedbackSummary,
            strengths: proposal.strengths,
            improvements: proposal.improvements,
            actionPlan: proposal.actionPlan,
            pronunciationNotes: proposal.pronunciationNotes,
            rawProposalJson: proposal.rawProposalJson,
            updatedAt: proposal.updatedAt,
          },
        });
    } catch (err) {
      console.warn("[HomeworkAssessmentRepo] saveAiProposal DB warning:", err);
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  return proposal;
}

/**
 * Finds AI assessment proposal by attempt ID.
 */
export async function findAiProposalByAttemptId(
  attemptId: string
): Promise<AiAssessmentProposal | null> {
  if (devAiProposalCache.has(attemptId)) {
    return devAiProposalCache.get(attemptId) || null;
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(aiAssessmentProposals)
        .where(eq(aiAssessmentProposals.attemptId, attemptId))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        const record: AiAssessmentProposal = {
          id: r.id,
          submissionId: r.submissionId,
          attemptId: r.attemptId,
          attemptNumber: r.attemptNumber,
          status: r.status as AiAssessmentProposal["status"],
          scores: r.scores as SpeakingCriteriaScores,
          overallBand: r.overallBand,
          feedbackSummary: r.feedbackSummary,
          strengths: (r.strengths || []) as string[],
          improvements: (r.improvements || []) as string[],
          actionPlan: (r.actionPlan || []) as string[],
          pronunciationNotes: (r.pronunciationNotes || []) as Array<{
            word: string;
            expectedIpa?: string;
            detectedIssue?: string;
            timestampSeconds?: number;
            recommendation?: string;
          }>,
          rawProposalJson: r.rawProposalJson as Record<string, unknown> | null,
          modelVersion: r.modelVersion || "gemini-2.5-flash",
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
        devAiProposalCache.set(attemptId, record);
        return record;
      }
    } catch (err) {
      console.warn(
        "[HomeworkAssessmentRepo] findAiProposalByAttemptId DB warning:",
        err
      );
    }
  }

  return null;
}

/**
 * Saves or updates a Teacher assessment (draft or published).
 */
export async function saveTeacherAssessment(
  assessment: TeacherAssessment
): Promise<TeacherAssessment> {
  devTeacherAssessmentCache.set(assessment.submissionId, assessment);

  if (process.env.DATABASE_URL) {
    try {
      await db
        .insert(teacherAssessments)
        .values({
          id: assessment.id,
          submissionId: assessment.submissionId,
          assignmentId: assessment.assignmentId,
          teacherId: assessment.teacherId,
          attemptNumber: assessment.attemptNumber,
          status: assessment.status,
          fluencyCoherence: assessment.fluencyCoherence,
          lexicalResource: assessment.lexicalResource,
          grammaticalRangeAccuracy: assessment.grammaticalRangeAccuracy,
          pronunciation: assessment.pronunciation,
          overallBand: assessment.overallBand,
          overallFeedback: assessment.overallFeedback,
          criteriaFeedback: assessment.criteriaFeedback,
          annotations: assessment.annotations,
          publishedAt: assessment.publishedAt,
          createdAt: assessment.createdAt,
          updatedAt: assessment.updatedAt,
        })
        .onConflictDoUpdate({
          target: teacherAssessments.id,
          set: {
            status: assessment.status,
            fluencyCoherence: assessment.fluencyCoherence,
            lexicalResource: assessment.lexicalResource,
            grammaticalRangeAccuracy: assessment.grammaticalRangeAccuracy,
            pronunciation: assessment.pronunciation,
            overallBand: assessment.overallBand,
            overallFeedback: assessment.overallFeedback,
            criteriaFeedback: assessment.criteriaFeedback,
            annotations: assessment.annotations,
            publishedAt: assessment.publishedAt,
            updatedAt: assessment.updatedAt,
          },
        });
    } catch (err) {
      console.warn(
        "[HomeworkAssessmentRepo] saveTeacherAssessment DB warning:",
        err
      );
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  return assessment;
}

/**
 * Finds Teacher assessment by submission ID.
 */
export async function findTeacherAssessmentBySubmission(
  submissionId: string
): Promise<TeacherAssessment | null> {
  if (devTeacherAssessmentCache.has(submissionId)) {
    return devTeacherAssessmentCache.get(submissionId) || null;
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(teacherAssessments)
        .where(eq(teacherAssessments.submissionId, submissionId))
        .orderBy(desc(teacherAssessments.updatedAt))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        const record: TeacherAssessment = {
          id: r.id,
          submissionId: r.submissionId,
          assignmentId: r.assignmentId,
          teacherId: r.teacherId,
          attemptNumber: r.attemptNumber,
          status: r.status as TeacherAssessment["status"],
          fluencyCoherence: r.fluencyCoherence,
          lexicalResource: r.lexicalResource,
          grammaticalRangeAccuracy: r.grammaticalRangeAccuracy,
          pronunciation: r.pronunciation,
          overallBand: r.overallBand,
          overallFeedback: r.overallFeedback,
          criteriaFeedback:
            r.criteriaFeedback as SpeakingCriteriaFeedback | null,
          annotations: (r.annotations || []) as SpeakingReviewAnnotationItem[],
          publishedAt: r.publishedAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
        devTeacherAssessmentCache.set(submissionId, record);
        return record;
      }
    } catch (err) {
      console.warn(
        "[HomeworkAssessmentRepo] findTeacherAssessmentBySubmission DB warning:",
        err
      );
    }
  }

  return null;
}

/**
 * Creates an immutable Published Assessment record.
 */
export async function createPublishedAssessment(
  assessment: PublishedAssessment
): Promise<PublishedAssessment> {
  devPublishedAssessmentCache.set(assessment.submissionId, assessment);

  if (process.env.DATABASE_URL) {
    try {
      await db.insert(publishedAssessments).values({
        id: assessment.id,
        submissionId: assessment.submissionId,
        assignmentId: assessment.assignmentId,
        teacherAssessmentId: assessment.teacherAssessmentId,
        learnerId: assessment.learnerId,
        teacherId: assessment.teacherId,
        attemptNumber: assessment.attemptNumber,
        fluencyCoherence: assessment.fluencyCoherence,
        lexicalResource: assessment.lexicalResource,
        grammaticalRangeAccuracy: assessment.grammaticalRangeAccuracy,
        pronunciation: assessment.pronunciation,
        overallBand: assessment.overallBand,
        overallFeedback: assessment.overallFeedback,
        criteriaFeedback: assessment.criteriaFeedback,
        publishedAt: assessment.publishedAt,
      });
    } catch (err) {
      console.warn(
        "[HomeworkAssessmentRepo] createPublishedAssessment DB warning:",
        err
      );
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  return assessment;
}

/**
 * Finds Published Assessment by submission ID.
 */
export async function findPublishedAssessmentBySubmission(
  submissionId: string
): Promise<PublishedAssessment | null> {
  if (devPublishedAssessmentCache.has(submissionId)) {
    return devPublishedAssessmentCache.get(submissionId) || null;
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(publishedAssessments)
        .where(eq(publishedAssessments.submissionId, submissionId))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        const record: PublishedAssessment = {
          id: r.id,
          submissionId: r.submissionId,
          assignmentId: r.assignmentId,
          teacherAssessmentId: r.teacherAssessmentId,
          learnerId: r.learnerId,
          teacherId: r.teacherId,
          attemptNumber: r.attemptNumber,
          fluencyCoherence: r.fluencyCoherence,
          lexicalResource: r.lexicalResource,
          grammaticalRangeAccuracy: r.grammaticalRangeAccuracy,
          pronunciation: r.pronunciation,
          overallBand: r.overallBand,
          overallFeedback: r.overallFeedback,
          criteriaFeedback:
            r.criteriaFeedback as SpeakingCriteriaFeedback | null,
          publishedAt: r.publishedAt,
        };
        devPublishedAssessmentCache.set(submissionId, record);
        return record;
      }
    } catch (err) {
      console.warn(
        "[HomeworkAssessmentRepo] findPublishedAssessmentBySubmission DB warning:",
        err
      );
    }
  }

  return null;
}

/**
 * Finds Published Assessment by assignment ID and learner ID.
 */
export async function findPublishedAssessmentByAssignmentAndLearner(
  assignmentId: string,
  learnerId: string
): Promise<PublishedAssessment | null> {
  for (const p of devPublishedAssessmentCache.values()) {
    if (p.assignmentId === assignmentId && p.learnerId === learnerId) {
      return p;
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(publishedAssessments)
        .where(
          and(
            eq(publishedAssessments.assignmentId, assignmentId),
            eq(publishedAssessments.learnerId, learnerId)
          )
        )
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        const record: PublishedAssessment = {
          id: r.id,
          submissionId: r.submissionId,
          assignmentId: r.assignmentId,
          teacherAssessmentId: r.teacherAssessmentId,
          learnerId: r.learnerId,
          teacherId: r.teacherId,
          attemptNumber: r.attemptNumber,
          fluencyCoherence: r.fluencyCoherence,
          lexicalResource: r.lexicalResource,
          grammaticalRangeAccuracy: r.grammaticalRangeAccuracy,
          pronunciation: r.pronunciation,
          overallBand: r.overallBand,
          overallFeedback: r.overallFeedback,
          criteriaFeedback:
            r.criteriaFeedback as SpeakingCriteriaFeedback | null,
          publishedAt: r.publishedAt,
        };
        devPublishedAssessmentCache.set(record.submissionId, record);
        return record;
      }
    } catch (err) {
      console.warn(
        "[HomeworkAssessmentRepo] findPublishedAssessmentByAssignmentAndLearner DB warning:",
        err
      );
    }
  }

  return null;
}

/**
 * Creates an Evaluation Feedback calibration record.
 */
export async function createEvaluationFeedback(
  feedback: EvaluationFeedback
): Promise<EvaluationFeedback> {
  const existing = devEvaluationFeedbackCache.get(feedback.submissionId) || [];
  devEvaluationFeedbackCache.set(feedback.submissionId, [
    ...existing,
    feedback,
  ]);

  if (process.env.DATABASE_URL) {
    try {
      await db.insert(evaluationFeedbacks).values({
        id: feedback.id,
        submissionId: feedback.submissionId,
        teacherAssessmentId: feedback.teacherAssessmentId,
        aiProposalId: feedback.aiProposalId,
        attemptNumber: feedback.attemptNumber,
        teacherId: feedback.teacherId,
        activeReviewDurationMs: feedback.activeReviewDurationMs,
        aiProposalAccepted: feedback.aiProposalAccepted,
        scoreDeltas: feedback.scoreDeltas,
        teacherModifications: feedback.teacherModifications,
        modelVersion: feedback.modelVersion,
        createdAt: feedback.createdAt,
      });
    } catch (err) {
      console.warn(
        "[HomeworkAssessmentRepo] createEvaluationFeedback DB warning:",
        err
      );
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  return feedback;
}

/**
 * Lists all Evaluation Feedback records for a submission ID.
 */
export async function listEvaluationFeedbacksBySubmissionId(
  submissionId: string
): Promise<EvaluationFeedback[]> {
  const cached = devEvaluationFeedbackCache.get(submissionId);
  if (cached && cached.length > 0) {
    return cached;
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(evaluationFeedbacks)
        .where(eq(evaluationFeedbacks.submissionId, submissionId))
        .orderBy(desc(evaluationFeedbacks.createdAt));

      const records: EvaluationFeedback[] = rows.map((r) => ({
        id: r.id,
        submissionId: r.submissionId,
        teacherAssessmentId: r.teacherAssessmentId,
        aiProposalId: r.aiProposalId,
        attemptNumber: r.attemptNumber,
        teacherId: r.teacherId,
        activeReviewDurationMs: r.activeReviewDurationMs,
        aiProposalAccepted: r.aiProposalAccepted,
        scoreDeltas: r.scoreDeltas as EvaluationFeedback["scoreDeltas"],
        teacherModifications:
          r.teacherModifications as EvaluationFeedback["teacherModifications"],
        modelVersion: r.modelVersion || "gemini-2.5-flash",
        createdAt: r.createdAt,
      }));

      devEvaluationFeedbackCache.set(submissionId, records);
      return records;
    } catch (err) {
      console.warn(
        "[HomeworkAssessmentRepo] listEvaluationFeedbacksBySubmissionId DB warning:",
        err
      );
    }
  }

  return [];
}
