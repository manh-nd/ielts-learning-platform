import { db } from "@/lib/db";
import { homeworkAssignments } from "./homework-schema";
import type {
  HomeworkAssignment,
  HomeworkPromptItem,
  HomeworkAssignmentStatus,
} from "../domain/homework-types";
import { eq, desc } from "drizzle-orm";

// In-memory cache for development and test isolation
const globalForHomework = globalThis as unknown as {
  devHomeworkAssignmentCache?: Map<string, HomeworkAssignment>;
};

export const devHomeworkAssignmentCache: Map<string, HomeworkAssignment> =
  globalForHomework.devHomeworkAssignmentCache ||
  new Map<string, HomeworkAssignment>();

if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_E2E_MOCK_AUTH === "true"
) {
  globalForHomework.devHomeworkAssignmentCache = devHomeworkAssignmentCache;
}

export function clearDevHomeworkCache(): void {
  devHomeworkAssignmentCache.clear();
}

export interface CreateAssignmentData {
  id?: string;
  classroomId: string;
  teacherId: string;
  title: string;
  instructions?: string | null;
  prompts: HomeworkPromptItem[];
  submissionDeadline: Date;
  status?: HomeworkAssignmentStatus;
}

/**
 * Creates a new homework assignment.
 */
export async function createAssignment(
  data: CreateAssignmentData
): Promise<HomeworkAssignment> {
  const assignmentId = data.id || crypto.randomUUID();
  const now = new Date();

  const record: HomeworkAssignment = {
    id: assignmentId,
    classroomId: data.classroomId,
    teacherId: data.teacherId,
    title: data.title.trim(),
    instructions: data.instructions?.trim() || null,
    prompts: data.prompts,
    submissionDeadline:
      data.submissionDeadline instanceof Date
        ? data.submissionDeadline
        : new Date(data.submissionDeadline),
    status: data.status || "draft",
    createdAt: now,
    updatedAt: now,
  };

  if (process.env.DATABASE_URL) {
    try {
      await db.insert(homeworkAssignments).values({
        id: record.id,
        classroomId: record.classroomId,
        teacherId: record.teacherId,
        title: record.title,
        instructions: record.instructions,
        prompts: record.prompts,
        submissionDeadline: record.submissionDeadline,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    } catch (err) {
      console.warn("[HomeworkRepository] createAssignment DB warning:", err);
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  devHomeworkAssignmentCache.set(assignmentId, record);
  return record;
}

/**
 * Finds a homework assignment by ID.
 */
export async function findAssignmentById(
  id: string
): Promise<HomeworkAssignment | null> {
  if (devHomeworkAssignmentCache.has(id)) {
    return devHomeworkAssignmentCache.get(id) || null;
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(homeworkAssignments)
        .where(eq(homeworkAssignments.id, id))
        .limit(1);

      if (rows.length > 0) {
        const row = rows[0];
        const record: HomeworkAssignment = {
          id: row.id,
          classroomId: row.classroomId,
          teacherId: row.teacherId,
          title: row.title,
          instructions: row.instructions,
          prompts: row.prompts as HomeworkPromptItem[],
          submissionDeadline: new Date(row.submissionDeadline),
          status: row.status as HomeworkAssignmentStatus,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        };
        devHomeworkAssignmentCache.set(record.id, record);
        return record;
      }
    } catch (err) {
      console.warn("[HomeworkRepository] findAssignmentById DB warning:", err);
    }
  }

  return null;
}

/**
 * Helper to map DB rows to domain entities and merge with in-memory cache.
 */
function mapDbRowsAndMergeCache(
  rows: (typeof homeworkAssignments.$inferSelect)[],
  cached: HomeworkAssignment[]
): HomeworkAssignment[] {
  const fromDb = rows.map((row) => ({
    id: row.id,
    classroomId: row.classroomId,
    teacherId: row.teacherId,
    title: row.title,
    instructions: row.instructions,
    prompts: row.prompts as HomeworkPromptItem[],
    submissionDeadline: new Date(row.submissionDeadline),
    status: row.status as HomeworkAssignmentStatus,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));

  const map = new Map<string, HomeworkAssignment>();
  for (const item of fromDb) {
    map.set(item.id, item);
    devHomeworkAssignmentCache.set(item.id, item);
  }
  for (const item of cached) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/**
 * Lists all homework assignments for a specific classroom, sorted by newest first.
 */
export async function listAssignmentsByClassroomId(
  classroomId: string
): Promise<HomeworkAssignment[]> {
  const cached = Array.from(devHomeworkAssignmentCache.values()).filter(
    (a) => a.classroomId === classroomId
  );

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(homeworkAssignments)
        .where(eq(homeworkAssignments.classroomId, classroomId))
        .orderBy(desc(homeworkAssignments.createdAt));

      return mapDbRowsAndMergeCache(rows, cached);
    } catch (err) {
      console.warn(
        "[HomeworkRepository] listAssignmentsByClassroomId DB warning:",
        err
      );
    }
  }

  return cached.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Lists all homework assignments created by a specific teacher.
 */
export async function listAssignmentsByTeacherId(
  teacherId: string
): Promise<HomeworkAssignment[]> {
  const cached = Array.from(devHomeworkAssignmentCache.values()).filter(
    (a) => a.teacherId === teacherId
  );

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(homeworkAssignments)
        .where(eq(homeworkAssignments.teacherId, teacherId))
        .orderBy(desc(homeworkAssignments.createdAt));

      return mapDbRowsAndMergeCache(rows, cached);
    } catch (err) {
      console.warn(
        "[HomeworkRepository] listAssignmentsByTeacherId DB warning:",
        err
      );
    }
  }

  return cached.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Updates an existing homework assignment.
 */
export async function updateAssignment(
  id: string,
  data: Partial<
    Pick<
      HomeworkAssignment,
      "title" | "instructions" | "prompts" | "submissionDeadline" | "status"
    >
  >
): Promise<HomeworkAssignment> {
  const existing = await findAssignmentById(id);
  if (!existing) {
    throw new Error(`Assignment ${id} not found.`);
  }

  const now = new Date();
  const updated: HomeworkAssignment = {
    ...existing,
    title: data.title !== undefined ? data.title.trim() : existing.title,
    instructions:
      data.instructions !== undefined
        ? data.instructions?.trim() || null
        : existing.instructions,
    prompts: data.prompts !== undefined ? data.prompts : existing.prompts,
    submissionDeadline:
      data.submissionDeadline !== undefined
        ? data.submissionDeadline instanceof Date
          ? data.submissionDeadline
          : new Date(data.submissionDeadline)
        : existing.submissionDeadline,
    status: data.status !== undefined ? data.status : existing.status,
    updatedAt: now,
  };

  if (process.env.DATABASE_URL) {
    try {
      await db
        .update(homeworkAssignments)
        .set({
          title: updated.title,
          instructions: updated.instructions,
          prompts: updated.prompts,
          submissionDeadline: updated.submissionDeadline,
          status: updated.status,
          updatedAt: updated.updatedAt,
        })
        .where(eq(homeworkAssignments.id, id));
    } catch (err) {
      console.warn("[HomeworkRepository] updateAssignment DB warning:", err);
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  devHomeworkAssignmentCache.set(id, updated);
  return updated;
}

/**
 * Permanently deletes an assignment (only permitted for draft assignments).
 */
export async function deleteAssignment(id: string): Promise<void> {
  if (process.env.DATABASE_URL) {
    try {
      await db
        .delete(homeworkAssignments)
        .where(eq(homeworkAssignments.id, id));
    } catch (err) {
      console.warn("[HomeworkRepository] deleteAssignment DB warning:", err);
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  devHomeworkAssignmentCache.delete(id);
}
