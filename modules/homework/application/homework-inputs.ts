import type {
  HomeworkAssignmentStatus,
  AudioResponseClip,
  SpeakingCriteriaFeedback,
  SpeakingReviewAnnotationItem,
} from "../domain/homework-types";

/**
 * Homework Application Use-Case Inputs (Issue #85, ADR-0009)
 */

export interface CreateHomeworkAssignmentInput {
  title: string;
  instructions?: string | null;
  prompts: Array<{
    promptId?: string;
    text: string;
    partNumber: 1 | 2 | 3;
    subPrompts?: string[];
  }>;
  submissionDeadline: Date | string;
  status?: "draft" | "published";
}

export interface UpdateHomeworkAssignmentInput {
  title?: string;
  instructions?: string | null;
  prompts?: Array<{
    promptId?: string;
    text: string;
    partNumber: 1 | 2 | 3;
    subPrompts?: string[];
  }>;
  submissionDeadline?: Date | string;
  status?: HomeworkAssignmentStatus;
}

export interface SubmitHomeworkInput {
  audioResponses: AudioResponseClip[];
}

export interface PublishAssessmentInput {
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
  pronunciation: number;
  overallFeedback: string;
  criteriaFeedback?: SpeakingCriteriaFeedback;
  annotations?: SpeakingReviewAnnotationItem[];
  activeReviewDurationMs: number;
}
