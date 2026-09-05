import { db } from "@/lib/db";
import { homeworkSubmissions, submissionAttempts } from "./homework-schema";
import type {
  HomeworkSubmission,
  SubmissionAttempt,
  AudioResponseClip,
  HomeworkSubmissionStatus,
} from "../domain/homework-types";
import {
  canLearnerResubmit,
  getTeacherReviewAvailability,
} from "../domain/homework-submission-lifecycle";
import { eq, and, desc, asc } from "drizzle-orm";

// In-memory cache for development and test isolation
const globalForSubmission = globalThis as unknown as {
  devSubmissionCache?: Map<string, HomeworkSubmission>;
  devAttemptCache?: Map<string, SubmissionAttempt[]>;
};

export const devSubmissionCache: Map<string, HomeworkSubmission> =
  globalForSubmission.devSubmissionCache ||
  new Map<string, HomeworkSubmission>();

export const devAttemptCache: Map<string, SubmissionAttempt[]> =
  globalForSubmission.devAttemptCache || new Map<string, SubmissionAttempt[]>();

if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_E2E_MOCK_AUTH === "true"
) {
  globalForSubmission.devSubmissionCache = devSubmissionCache;
  globalForSubmission.devAttemptCache = devAttemptCache;
}

export function clearDevHomeworkSubmissionCache(): void {
  devSubmissionCache.clear();
  devAttemptCache.clear();
}

export class SubmissionIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubmissionIntegrityError";
  }
}

export function mapRowToSubmission(
  r: typeof homeworkSubmissions.$inferSelect
): HomeworkSubmission {
  const status = r.status;
  if (
    status !== "submitted" &&
    status !== "in_review" &&
    status !== "published"
  ) {
    throw new SubmissionIntegrityError(
      `[HomeworkSubmissionRepo] Encountered uncommitted/invalid submission status "${status}" for submission ${r.id}. Persistence rows without a committed attempt must not be treated as valid HomeworkSubmission.`
    );
  }

  return {
    id: r.id,
    assignmentId: r.assignmentId,
    learnerId: r.learnerId,
    status: status as HomeworkSubmissionStatus,
    currentAttemptNumber: r.currentAttemptNumber,
    reviewedAttemptNumber: r.reviewedAttemptNumber,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Database reads deliberately bypass the development store. */
export async function findSubmissionByAssignmentAndLearner(
  assignmentId: string,
  learnerId: string
): Promise<HomeworkSubmission | null> {
  if (process.env.DATABASE_URL) {
    const rows = await db
      .select()
      .from(homeworkSubmissions)
      .where(
        and(
          eq(homeworkSubmissions.assignmentId, assignmentId),
          eq(homeworkSubmissions.learnerId, learnerId)
        )
      )
      .limit(1);
    return rows[0] ? mapRowToSubmission(rows[0]) : null;
  }
  return (
    [...devSubmissionCache.values()].find(
      (s) => s.assignmentId === assignmentId && s.learnerId === learnerId
    ) || null
  );
}

export async function findSubmissionById(
  id: string
): Promise<HomeworkSubmission | null> {
  if (process.env.DATABASE_URL) {
    const rows = await db
      .select()
      .from(homeworkSubmissions)
      .where(eq(homeworkSubmissions.id, id))
      .limit(1);
    return rows[0] ? mapRowToSubmission(rows[0]) : null;
  }
  return devSubmissionCache.get(id) || null;
}

/**
 * Creates initial homework submission and its attempt #1 snapshot.
 */
export async function createInitialSubmissionWithAttempt(data: {
  id?: string;
  assignmentId: string;
  learnerId: string;
  audioResponses: AudioResponseClip[];
  status?: HomeworkSubmissionStatus;
}): Promise<{ submission: HomeworkSubmission; attempt: SubmissionAttempt }> {
  const submissionId = data.id || crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const now = new Date();

  const submission: HomeworkSubmission = {
    id: submissionId,
    assignmentId: data.assignmentId,
    learnerId: data.learnerId,
    status: data.status || "submitted",
    currentAttemptNumber: 1,
    reviewedAttemptNumber: null,
    createdAt: now,
    updatedAt: now,
  };

  const attempt: SubmissionAttempt = {
    id: attemptId,
    submissionId,
    attemptNumber: 1,
    audioResponses: data.audioResponses,
    submittedAt: now,
  };

  if (process.env.DATABASE_URL) {
    await db.transaction(async (tx) => {
      await tx.insert(homeworkSubmissions).values(submission);
      await tx.insert(submissionAttempts).values(attempt);
    });
  } else {
    devSubmissionCache.set(submission.id, submission);
    devAttemptCache.set(submission.id, [attempt]);
  }
  return { submission, attempt };
}

type NoSubmissionTransition =
  | { kind: "no_transition"; submission: HomeworkSubmission }
  | { kind: "not_found" };

export type CommitResubmissionResult =
  | NoSubmissionTransition
  | {
      kind: "committed";
      submission: HomeworkSubmission;
      attempt: SubmissionAttempt;
    };
export type ClaimTeacherReviewResult =
  | NoSubmissionTransition
  | {
      kind: "claimed";
      submission: HomeworkSubmission;
    };

function noTransition(
  submission: HomeworkSubmission | null
): NoSubmissionTransition {
  return submission
    ? { kind: "no_transition", submission }
    : { kind: "not_found" };
}

/** The conditional row update and immutable attempt insert form one business commit. */
export async function commitResubmission(data: {
  submissionId: string;
  expectedCurrentAttemptNumber: number;
  audioResponses: AudioResponseClip[];
}): Promise<CommitResubmissionResult> {
  const { submissionId, expectedCurrentAttemptNumber, audioResponses } = data;
  const now = new Date();
  const attempt: SubmissionAttempt = {
    id: crypto.randomUUID(),
    submissionId,
    attemptNumber: expectedCurrentAttemptNumber + 1,
    audioResponses,
    submittedAt: now,
  };
  if (process.env.DATABASE_URL) {
    return db.transaction(async (tx): Promise<CommitResubmissionResult> => {
      const rows = await tx
        .update(homeworkSubmissions)
        .set({
          currentAttemptNumber: attempt.attemptNumber,
          updatedAt: now,
        })
        .where(
          and(
            eq(homeworkSubmissions.id, submissionId),
            eq(homeworkSubmissions.status, "submitted"),
            eq(
              homeworkSubmissions.currentAttemptNumber,
              expectedCurrentAttemptNumber
            )
          )
        )
        .returning();
      if (!rows[0]) {
        const current = await tx
          .select()
          .from(homeworkSubmissions)
          .where(eq(homeworkSubmissions.id, submissionId))
          .limit(1);
        return noTransition(current[0] ? mapRowToSubmission(current[0]) : null);
      }
      const submission = mapRowToSubmission(rows[0]);
      // Throwing here must escape the callback so postgres-js rolls back the update.
      await tx.insert(submissionAttempts).values(attempt);
      return { kind: "committed", submission, attempt };
    });
  }

  // No await between observing state and committing both in-memory records.
  const existing = devSubmissionCache.get(submissionId);
  if (!existing) return { kind: "not_found" };
  if (
    !canLearnerResubmit(existing.status) ||
    existing.currentAttemptNumber !== expectedCurrentAttemptNumber
  ) {
    return noTransition(existing);
  }
  const submission = {
    ...existing,
    currentAttemptNumber: attempt.attemptNumber,
    updatedAt: now,
  };
  const attempts = [...(devAttemptCache.get(submissionId) || []), attempt];
  devSubmissionCache.set(submissionId, submission);
  devAttemptCache.set(submissionId, attempts);
  return { kind: "committed", submission, attempt };
}

/** Capture the database's CurrentAttempt, never an application snapshot. */
export async function claimTeacherReview(
  submissionId: string
): Promise<ClaimTeacherReviewResult> {
  const now = new Date();
  if (process.env.DATABASE_URL) {
    const rows = await db
      .update(homeworkSubmissions)
      .set({
        status: "in_review",
        reviewedAttemptNumber: homeworkSubmissions.currentAttemptNumber,
        updatedAt: now,
      })
      .where(
        and(
          eq(homeworkSubmissions.id, submissionId),
          eq(homeworkSubmissions.status, "submitted")
        )
      )
      .returning();
    if (rows[0])
      return { kind: "claimed", submission: mapRowToSubmission(rows[0]) };
    return noTransition(await findSubmissionById(submissionId));
  }
  const existing = devSubmissionCache.get(submissionId);
  if (!existing) return { kind: "not_found" };
  if (getTeacherReviewAvailability(existing.status) !== "claimable")
    return noTransition(existing);
  const submission: HomeworkSubmission = {
    ...existing,
    status: "in_review",
    reviewedAttemptNumber: existing.currentAttemptNumber,
    updatedAt: now,
  };
  devSubmissionCache.set(submissionId, submission);
  return { kind: "claimed", submission };
}

/**
 * Legacy publication write. Review claims must use claimTeacherReview instead.
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: HomeworkSubmissionStatus,
  reviewedAttemptNumber?: number | null
): Promise<HomeworkSubmission> {
  const existing = await findSubmissionById(submissionId);
  if (!existing) {
    throw new Error(`Submission ${submissionId} not found.`);
  }

  const now = new Date();
  const updated: HomeworkSubmission = {
    ...existing,
    status,
    reviewedAttemptNumber:
      reviewedAttemptNumber !== undefined
        ? reviewedAttemptNumber
        : existing.reviewedAttemptNumber,
    updatedAt: now,
  };

  if (process.env.DATABASE_URL) {
    const rows = await db
      .update(homeworkSubmissions)
      .set({
        status: updated.status,
        reviewedAttemptNumber: updated.reviewedAttemptNumber,
        updatedAt: updated.updatedAt,
      })
      .where(eq(homeworkSubmissions.id, submissionId))
      .returning();
    if (!rows[0]) throw new Error(`Submission ${submissionId} not found.`);
    return mapRowToSubmission(rows[0]);
  }
  devSubmissionCache.set(submissionId, updated);
  return updated;
}

export async function listAttemptsBySubmissionId(
  submissionId: string
): Promise<SubmissionAttempt[]> {
  if (process.env.DATABASE_URL) {
    return db
      .select()
      .from(submissionAttempts)
      .where(eq(submissionAttempts.submissionId, submissionId))
      .orderBy(asc(submissionAttempts.attemptNumber));
  }
  return [...(devAttemptCache.get(submissionId) || [])].sort(
    (a, b) => a.attemptNumber - b.attemptNumber
  );
}

/**
 * Finds an attempt by submission ID and attempt number.
 */
export async function findAttemptByNumber(
  submissionId: string,
  attemptNumber: number
): Promise<SubmissionAttempt | null> {
  const attempts = await listAttemptsBySubmissionId(submissionId);
  return attempts.find((a) => a.attemptNumber === attemptNumber) || null;
}

/**
 * Lists all submissions for an assignment.
 */
export async function listSubmissionsByAssignmentId(
  assignmentId: string
): Promise<HomeworkSubmission[]> {
  if (process.env.DATABASE_URL) {
    const rows = await db
      .select()
      .from(homeworkSubmissions)
      .where(eq(homeworkSubmissions.assignmentId, assignmentId))
      .orderBy(desc(homeworkSubmissions.createdAt));
    return rows.map(mapRowToSubmission);
  }
  return [...devSubmissionCache.values()].filter(
    (s) => s.assignmentId === assignmentId
  );
}
