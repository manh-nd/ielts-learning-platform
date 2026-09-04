import { db } from "@/lib/db";
import { homeworkSubmissions, submissionAttempts } from "./homework-schema";
import type {
  HomeworkSubmission,
  SubmissionAttempt,
  AudioResponseClip,
  SubmissionRecordStatus,
} from "../domain/homework-types";
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

if (process.env.NODE_ENV !== "production") {
  globalForSubmission.devSubmissionCache = devSubmissionCache;
  globalForSubmission.devAttemptCache = devAttemptCache;
}

export function clearDevHomeworkSubmissionCache(): void {
  devSubmissionCache.clear();
  devAttemptCache.clear();
}

function mapRowToSubmission(
  r: typeof homeworkSubmissions.$inferSelect
): HomeworkSubmission {
  return {
    id: r.id,
    assignmentId: r.assignmentId,
    learnerId: r.learnerId,
    status: r.status as SubmissionRecordStatus,
    currentAttemptNumber: r.currentAttemptNumber,
    reviewedAttemptNumber: r.reviewedAttemptNumber,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Finds a homework submission by assignment ID and learner ID.
 */
export async function findSubmissionByAssignmentAndLearner(
  assignmentId: string,
  learnerId: string
): Promise<HomeworkSubmission | null> {
  // Check in-memory cache first
  for (const s of devSubmissionCache.values()) {
    if (s.assignmentId === assignmentId && s.learnerId === learnerId) {
      return s;
    }
  }

  if (process.env.DATABASE_URL) {
    try {
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

      if (rows.length > 0) {
        const record = mapRowToSubmission(rows[0]);
        devSubmissionCache.set(record.id, record);
        return record;
      }
    } catch (err) {
      console.warn(
        "[HomeworkSubmissionRepo] findSubmissionByAssignmentAndLearner DB warning:",
        err
      );
    }
  }

  return null;
}

/**
 * Finds a homework submission by ID.
 */
export async function findSubmissionById(
  id: string
): Promise<HomeworkSubmission | null> {
  if (devSubmissionCache.has(id)) {
    return devSubmissionCache.get(id) || null;
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(homeworkSubmissions)
        .where(eq(homeworkSubmissions.id, id))
        .limit(1);

      if (rows.length > 0) {
        const record = mapRowToSubmission(rows[0]);
        devSubmissionCache.set(record.id, record);
        return record;
      }
    } catch (err) {
      console.warn(
        "[HomeworkSubmissionRepo] findSubmissionById DB warning:",
        err
      );
    }
  }

  return null;
}

/**
 * Creates initial homework submission and its attempt #1 snapshot.
 */
export async function createInitialSubmissionWithAttempt(data: {
  id?: string;
  assignmentId: string;
  learnerId: string;
  audioResponses: AudioResponseClip[];
  status?: SubmissionRecordStatus;
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
    try {
      await db.transaction(async (tx) => {
        await tx.insert(homeworkSubmissions).values({
          id: submission.id,
          assignmentId: submission.assignmentId,
          learnerId: submission.learnerId,
          status: submission.status,
          currentAttemptNumber: submission.currentAttemptNumber,
          reviewedAttemptNumber: submission.reviewedAttemptNumber,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
        });

        await tx.insert(submissionAttempts).values({
          id: attempt.id,
          submissionId: attempt.submissionId,
          attemptNumber: attempt.attemptNumber,
          audioResponses: attempt.audioResponses,
          submittedAt: attempt.submittedAt,
        });
      });
    } catch (err) {
      console.warn(
        "[HomeworkSubmissionRepo] createInitialSubmissionWithAttempt DB warning:",
        err
      );
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  devSubmissionCache.set(submission.id, submission);
  devAttemptCache.set(submission.id, [attempt]);

  return { submission, attempt };
}

/**
 * Creates a subsequent immutable attempt snapshot (Resubmission: attempt #2, #3, etc.)
 * Increments currentAttemptNumber on homeworkSubmissions.
 */
export async function createSubsequentAttempt(
  submissionId: string,
  audioResponses: AudioResponseClip[]
): Promise<{ submission: HomeworkSubmission; attempt: SubmissionAttempt }> {
  const existing = await findSubmissionById(submissionId);
  if (!existing) {
    throw new Error(`Submission ${submissionId} not found.`);
  }

  const nextAttemptNumber = existing.currentAttemptNumber + 1;
  const attemptId = crypto.randomUUID();
  const now = new Date();

  const updatedSubmission: HomeworkSubmission = {
    ...existing,
    status: "submitted",
    currentAttemptNumber: nextAttemptNumber,
    updatedAt: now,
  };

  const newAttempt: SubmissionAttempt = {
    id: attemptId,
    submissionId,
    attemptNumber: nextAttemptNumber,
    audioResponses,
    submittedAt: now,
  };

  if (process.env.DATABASE_URL) {
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(homeworkSubmissions)
          .set({
            status: updatedSubmission.status,
            currentAttemptNumber: updatedSubmission.currentAttemptNumber,
            updatedAt: updatedSubmission.updatedAt,
          })
          .where(eq(homeworkSubmissions.id, submissionId));

        await tx.insert(submissionAttempts).values({
          id: newAttempt.id,
          submissionId: newAttempt.submissionId,
          attemptNumber: newAttempt.attemptNumber,
          audioResponses: newAttempt.audioResponses,
          submittedAt: newAttempt.submittedAt,
        });
      });
    } catch (err) {
      console.warn(
        "[HomeworkSubmissionRepo] createSubsequentAttempt DB warning:",
        err
      );
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  devSubmissionCache.set(submissionId, updatedSubmission);
  const attempts = devAttemptCache.get(submissionId) || [];
  devAttemptCache.set(submissionId, [...attempts, newAttempt]);

  return { submission: updatedSubmission, attempt: newAttempt };
}

/**
 * Updates submission status and optionally reviewedAttemptNumber (for Teacher review lock/publish).
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: SubmissionRecordStatus,
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
    try {
      await db
        .update(homeworkSubmissions)
        .set({
          status: updated.status,
          reviewedAttemptNumber: updated.reviewedAttemptNumber,
          updatedAt: updated.updatedAt,
        })
        .where(eq(homeworkSubmissions.id, submissionId));
    } catch (err) {
      console.warn(
        "[HomeworkSubmissionRepo] updateSubmissionStatus DB warning:",
        err
      );
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  devSubmissionCache.set(submissionId, updated);
  return updated;
}

/**
 * Lists all attempts for a given submission ID, sorted ascending by attemptNumber.
 */
export async function listAttemptsBySubmissionId(
  submissionId: string
): Promise<SubmissionAttempt[]> {
  const cached = devAttemptCache.get(submissionId);
  if (cached && cached.length > 0) {
    return [...cached].sort((a, b) => a.attemptNumber - b.attemptNumber);
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(submissionAttempts)
        .where(eq(submissionAttempts.submissionId, submissionId))
        .orderBy(asc(submissionAttempts.attemptNumber));

      const attempts: SubmissionAttempt[] = rows.map((r) => ({
        id: r.id,
        submissionId: r.submissionId,
        attemptNumber: r.attemptNumber,
        audioResponses: r.audioResponses as AudioResponseClip[],
        submittedAt: r.submittedAt,
      }));

      devAttemptCache.set(submissionId, attempts);
      return attempts;
    } catch (err) {
      console.warn(
        "[HomeworkSubmissionRepo] listAttemptsBySubmissionId DB warning:",
        err
      );
    }
  }

  return [];
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
  const cachedSubmissions: HomeworkSubmission[] = [];
  for (const s of devSubmissionCache.values()) {
    if (s.assignmentId === assignmentId) {
      cachedSubmissions.push(s);
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(homeworkSubmissions)
        .where(eq(homeworkSubmissions.assignmentId, assignmentId))
        .orderBy(desc(homeworkSubmissions.createdAt));

      const dbSubmissions: HomeworkSubmission[] = rows.map(mapRowToSubmission);

      const merged = new Map<string, HomeworkSubmission>();
      for (const s of dbSubmissions) merged.set(s.id, s);
      for (const s of cachedSubmissions) merged.set(s.id, s);
      return Array.from(merged.values());
    } catch (err) {
      console.warn(
        "[HomeworkSubmissionRepo] listSubmissionsByAssignmentId DB warning:",
        err
      );
    }
  }

  return cachedSubmissions;
}
