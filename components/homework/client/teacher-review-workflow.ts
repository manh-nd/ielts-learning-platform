import type {
  HomeworkSubmissionStatus,
  TeacherAssessment,
} from "@/modules/homework/domain/homework-types";
import type {
  PublishAssessmentInput,
  SaveAssessmentDraftInput,
} from "@/modules/homework/application/homework-inputs";

export type ReviewWorkflowState = "claimable" | "in_review" | "published";

export type ClaimTeacherReviewResult =
  | { kind: "claimed" }
  | { kind: "terminal"; message: string }
  | { kind: "rejected"; message: string };

export type PublishTeacherAssessmentResult =
  | { kind: "published" }
  | { kind: "conflict"; message: string }
  | { kind: "rejected"; message: string };

export type SaveTeacherReviewDraftResult =
  | { kind: "saved"; draft: TeacherAssessment }
  | { kind: "conflict"; message: string }
  | { kind: "rejected"; message: string };

export interface ClaimTeacherReviewOptions {
  submissionId: string;
  mockMode?: boolean;
  onStartReview?: () => Promise<void>;
  fetchFn?: typeof fetch;
}

export interface PublishTeacherAssessmentOptions {
  submissionId: string;
  input: PublishAssessmentInput;
  mockMode?: boolean;
  onPublish?: (input: PublishAssessmentInput) => Promise<void>;
  fetchFn?: typeof fetch;
}

export interface SaveTeacherReviewDraftOptions {
  submissionId: string;
  input: SaveAssessmentDraftInput;
  mockMode?: boolean;
  onSaveDraft?: (input: SaveAssessmentDraftInput) => Promise<TeacherAssessment>;
  fetchFn?: typeof fetch;
}

/**
 * Maps canonical submission status to presentation review workflow state.
 *
 * Exhaustive mapping:
 * - "submitted" -> "claimable"
 * - "in_review" -> "in_review"
 * - "published" -> "published"
 */
export function mapInitialSubmissionStatusToWorkflowState(
  status: HomeworkSubmissionStatus
): ReviewWorkflowState {
  switch (status) {
    case "submitted":
      return "claimable";
    case "in_review":
      return "in_review";
    case "published":
      return "published";
  }
}

/**
 * Claims a Teacher review session with First-Committed-Wins concurrency lock.
 *
 * Outcomes:
 * - { kind: "claimed" }: Successfully claimed (or idempotent 200 OK from server).
 * - { kind: "terminal", message }: Submission was already published (HTTP 409 + SUBMISSION_ALREADY_PUBLISHED).
 * - { kind: "rejected", message }: Any other failure, conflict, or network error.
 */
export async function claimTeacherReview(
  options: ClaimTeacherReviewOptions
): Promise<ClaimTeacherReviewResult> {
  const { submissionId, mockMode = false, onStartReview, fetchFn } = options;

  if (onStartReview) {
    try {
      await onStartReview();
      return { kind: "claimed" };
    } catch (err: unknown) {
      return {
        kind: "rejected",
        message: (err as Error)?.message || "Không thể bắt đầu chấm bài.",
      };
    }
  }

  if (mockMode) {
    return { kind: "claimed" };
  }

  const fetchImpl = fetchFn ?? globalThis.fetch;
  try {
    const res = await fetchImpl(
      `/api/teacher/submissions/${submissionId}/start-review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (res.ok) {
      return { kind: "claimed" };
    }

    const errData = await res.json().catch(() => ({}));
    const message = errData?.error?.message || `HTTP_${res.status}`;
    const code = errData?.error?.code;

    if (res.status === 409 && code === "SUBMISSION_ALREADY_PUBLISHED") {
      return { kind: "terminal", message };
    }

    return { kind: "rejected", message };
  } catch (err: unknown) {
    return {
      kind: "rejected",
      message: (err as Error)?.message || "Không thể bắt đầu chấm bài.",
    };
  }
}

/**
 * Publishes the official Teacher assessment in a single atomic action.
 *
 * Outcomes:
 * - { kind: "published" }: Successfully published.
 * - { kind: "conflict", message }: Concurrency or state conflict (HTTP 409).
 * - { kind: "rejected", message }: Validation or server failure.
 */
export async function publishTeacherAssessment(
  options: PublishTeacherAssessmentOptions
): Promise<PublishTeacherAssessmentResult> {
  const { submissionId, input, mockMode = false, onPublish, fetchFn } = options;

  if (onPublish) {
    try {
      await onPublish(input);
      return { kind: "published" };
    } catch (err: unknown) {
      return {
        kind: "rejected",
        message: (err as Error)?.message || "Không thể công bố bài chấm.",
      };
    }
  }

  if (mockMode) {
    return { kind: "published" };
  }

  const fetchImpl = fetchFn ?? globalThis.fetch;
  try {
    const res = await fetchImpl(
      `/api/teacher/submissions/${submissionId}/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (res.ok) {
      return { kind: "published" };
    }

    const errData = await res.json().catch(() => ({}));
    const message = errData?.error?.message || `HTTP_${res.status}`;

    if (res.status === 409) {
      return { kind: "conflict", message };
    }

    return { kind: "rejected", message };
  } catch (err: unknown) {
    return {
      kind: "rejected",
      message: (err as Error)?.message || "Không thể công bố bài chấm.",
    };
  }
}

/**
 * Saves Teacher review draft.
 *
 * Outcomes:
 * - { kind: "saved", draft }: Successfully saved draft.
 * - { kind: "conflict", message }: Concurrency or terminal state conflict (HTTP 409).
 * - { kind: "rejected", message }: Validation or server failure.
 */
export async function saveTeacherReviewDraft(
  options: SaveTeacherReviewDraftOptions
): Promise<SaveTeacherReviewDraftResult> {
  const {
    submissionId,
    input,
    mockMode = false,
    onSaveDraft,
    fetchFn,
  } = options;

  if (onSaveDraft) {
    try {
      const draft = await onSaveDraft(input);
      return { kind: "saved", draft };
    } catch (err: unknown) {
      return {
        kind: "rejected",
        message: (err as Error)?.message || "Không thể lưu bản nháp.",
      };
    }
  }

  if (mockMode) {
    const mockDraft: TeacherAssessment = {
      id: "mock_draft_id",
      submissionId,
      assignmentId: "mock_assignment_id",
      teacherId: "mock_teacher_id",
      attemptNumber: 1,
      status: "draft",
      fluencyCoherence: input.fluencyCoherence,
      lexicalResource: input.lexicalResource,
      grammaticalRangeAccuracy: input.grammaticalRangeAccuracy,
      pronunciation: input.pronunciation,
      overallBand:
        (input.fluencyCoherence +
          input.lexicalResource +
          input.grammaticalRangeAccuracy +
          input.pronunciation) /
        4,
      overallFeedback: input.overallFeedback,
      criteriaFeedback: input.criteriaFeedback || null,
      annotations: input.annotations,
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return { kind: "saved", draft: mockDraft };
  }

  const fetchImpl = fetchFn ?? globalThis.fetch;
  try {
    const res = await fetchImpl(
      `/api/teacher/submissions/${submissionId}/review`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return { kind: "saved", draft: data.teacherDraft };
    }

    const errData = await res.json().catch(() => ({}));
    const message = errData?.error?.message || `HTTP_${res.status}`;

    if (res.status === 409) {
      return { kind: "conflict", message };
    }

    return { kind: "rejected", message };
  } catch (err: unknown) {
    return {
      kind: "rejected",
      message: (err as Error)?.message || "Không thể lưu bản nháp.",
    };
  }
}
