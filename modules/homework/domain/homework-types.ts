/**
 * Homework Assignment Domain Models (Issue #74, Ticket #53, ADR-0008, ADR-0009)
 * Canonical ubiquitous language:
 * - HomeworkAssignment: Teacher-owned assignment bound to a Classroom with 1-3 discrete Prompts.
 * - HomeworkPromptItem: A discrete question/prompt item for IELTS Speaking Part 1, 2, or 3.
 * - SubmissionDeadline: The final instant when a Learner may submit or resubmit Homework. No SubmissionAttempt is accepted after it passes.
 */

export type HomeworkAssignmentStatus = "draft" | "published" | "archived";

export interface HomeworkPromptItem {
  promptId: string;
  text: string;
  partNumber: 1 | 2 | 3;
  subPrompts?: string[];
}

export interface HomeworkAssignment {
  id: string;
  classroomId: string;
  teacherId: string;
  title: string;
  instructions: string | null;
  prompts: HomeworkPromptItem[];
  submissionDeadline: Date;
  status: HomeworkAssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type HomeworkSubmissionStatus = "submitted" | "in_review" | "published";

export interface AudioResponseClip {
  promptId: string;
  storageKey: string;
  durationMs: number;
  audioBytes: number;
}

export interface SubmissionAttempt {
  id: string;
  submissionId: string;
  attemptNumber: number;
  audioResponses: AudioResponseClip[];
  submittedAt: Date;
}

export interface HomeworkSubmission {
  id: string;
  assignmentId: string;
  learnerId: string;
  status: HomeworkSubmissionStatus;
  currentAttemptNumber: number;
  reviewedAttemptNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpeakingCriteriaScores {
  fluencyAndCoherence: number;
  lexicalResource: number;
  grammaticalRangeAndAccuracy: number;
  pronunciation: number;
}

export interface SpeakingCriteriaFeedback {
  fluencyAndCoherence?: string;
  lexicalResource?: string;
  grammaticalRangeAndAccuracy?: string;
  pronunciation?: string;
}

export interface SpeakingReviewAnnotationItem {
  id: string;
  partNumber: number;
  timestampSeconds: number;
  category: "pronunciation" | "grammar" | "lexical" | "fluency" | "general";
  originalQuote?: string;
  teacherComment: string;
  createdAt: string;
}

/**
 * AiAssessmentProposal (Ticket #55, #56, ADR-0008, ADR-0009)
 * Represents the untouched AI proposal generated for an attempt. Strictly hidden from Learner.
 */
export interface AiAssessmentProposal {
  id: string;
  submissionId: string;
  attemptId: string;
  attemptNumber: number;
  status: "pending" | "processing" | "ready" | "failed";
  scores: SpeakingCriteriaScores;
  overallBand: number;
  feedbackSummary: string | null;
  strengths: string[];
  improvements: string[];
  actionPlan: string[];
  pronunciationNotes: Array<{
    word: string;
    expectedIpa?: string;
    detectedIssue?: string;
    timestampSeconds?: number;
    recommendation?: string;
  }>;
  rawProposalJson: Record<string, unknown> | null;
  modelVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TeacherAssessment (Ticket #51, ADR-0009)
 * Teacher evaluation draft and official validated scores.
 */
export interface TeacherAssessment {
  id: string;
  submissionId: string;
  assignmentId: string;
  teacherId: string;
  attemptNumber: number;
  status: "draft" | "published";
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
  pronunciation: number;
  overallBand: number;
  overallFeedback: string;
  criteriaFeedback: SpeakingCriteriaFeedback | null;
  annotations: SpeakingReviewAnnotationItem[];
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PublishedAssessment (Ticket #51, ADR-0009)
 * Immutable official snapshot visible to the Learner after publication.
 */
export interface PublishedAssessment {
  id: string;
  submissionId: string;
  assignmentId: string;
  teacherAssessmentId: string;
  learnerId: string;
  teacherId: string;
  attemptNumber: number;
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
  pronunciation: number;
  overallBand: number;
  overallFeedback: string;
  criteriaFeedback: SpeakingCriteriaFeedback | null;
  publishedAt: Date;
}

/**
 * EvaluationFeedback (ADR-0008, ADR-0010, Ticket #52, #76)
 * Calibration difference record between AI proposal and finalized Teacher scores.
 */
export interface EvaluationFeedback {
  id: string;
  submissionId: string;
  teacherAssessmentId: string;
  aiProposalId: string | null;
  attemptNumber: number;
  teacherId: string;
  activeReviewDurationMs: number;
  aiProposalAccepted: boolean;
  scoreDeltas: {
    fluencyCoherence: number;
    lexicalResource: number;
    grammaticalRangeAccuracy: number;
    pronunciation: number;
    overallBand: number;
  };
  teacherModifications: {
    modifiedCriteria: string[];
    teacherOverallDiff: number;
  } | null;
  modelVersion: string;
  createdAt: Date;
}

/**
 * Calculates IELTS Speaking overall band score from 4 criteria according to official IELTS rounding rules:
 * - Average fractional part < 0.25 -> round down (e.g. 6.125 -> 6.0)
 * - Average fractional part >= 0.25 and < 0.75 -> round to .5 (e.g. 6.25 -> 6.5, 6.625 -> 6.5)
 * - Average fractional part >= 0.75 -> round up to next whole band (e.g. 6.75 -> 7.0)
 */
export function calculateIeltsSpeakingOverallBand(
  fc: number,
  lr: number,
  gra: number,
  pr: number
): number {
  const mean = (fc + lr + gra + pr) / 4;
  const floor = Math.floor(mean);
  const remainder = Number((mean - floor).toFixed(4));

  if (remainder < 0.25) return floor;
  if (remainder < 0.75) return floor + 0.5;
  return floor + 1;
}
