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

export type HomeworkSubmissionStatus =
  "not_submitted" | "submitted" | "in_review" | "under_review" | "published";

export type SubmissionRecordStatus =
  "pending" | "submitted" | "in_review" | "published";

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
  status: SubmissionRecordStatus;
  currentAttemptNumber: number;
  reviewedAttemptNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmitHomeworkInput {
  audioResponses: AudioResponseClip[];
}

export interface HomeworkAssignmentStudentRosterItem {
  learnerId: string;
  learnerName: string;
  learnerEmail: string;
  learnerImage: string | null;
  submissionStatus: HomeworkSubmissionStatus;
  submittedAt: Date | null;
  submissionId: string | null;
}

export interface HomeworkAssignmentDetail {
  assignment: HomeworkAssignment;
  classroom: {
    id: string;
    name: string;
  };
  students: HomeworkAssignmentStudentRosterItem[];
}

export interface LearnerHomeworkDetail {
  assignment: HomeworkAssignment;
  classroom: {
    id: string;
    name: string;
  };
  submission: HomeworkSubmission | null;
  currentAttempt: SubmissionAttempt | null;
  allAttempts: SubmissionAttempt[];
}
