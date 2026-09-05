import type {
  HomeworkAssignment,
  HomeworkSubmission,
  HomeworkSubmissionStatus,
  SubmissionAttempt,
  PublishedAssessment,
  AiAssessmentProposal,
  TeacherAssessment,
} from "../domain/homework-types";

/**
 * Homework Application Read Models & View DTOs (Issue #85, ADR-0009)
 */

export type HomeworkRosterSubmissionStatus =
  "not_submitted" | HomeworkSubmissionStatus | "under_review";

export interface HomeworkAssignmentStudentRosterItem {
  learnerId: string;
  learnerName: string;
  learnerEmail: string;
  learnerImage: string | null;
  submissionStatus: HomeworkRosterSubmissionStatus;
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
  publishedAssessment?: PublishedAssessment | null;
}

export interface LearnerPublishedAssessmentData {
  assignment: HomeworkAssignment;
  classroom: {
    id: string;
    name: string;
  };
  submission: HomeworkSubmission;
  attempt: SubmissionAttempt;
  publishedAssessment: PublishedAssessment;
  teacher: {
    id: string;
    name: string;
  };
}

export interface TeacherReviewCockpitData {
  assignment: HomeworkAssignment;
  submission: HomeworkSubmission;
  attempt: SubmissionAttempt;
  student: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  aiProposal: AiAssessmentProposal | null;
  teacherDraft: TeacherAssessment | null;
  publishedAssessment: PublishedAssessment | null;
}
