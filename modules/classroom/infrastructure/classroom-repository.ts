import { db } from "@/lib/db";
import { classrooms, classroomMembers } from "./classroom-schema";
import {
  user,
  type UserRole,
} from "@/modules/identity/infrastructure/auth-schema";
import type { Classroom, Membership } from "../domain/classroom-types";
import type {
  ClassroomWithMemberCount,
  ClassroomRosterItem,
} from "../application/classroom-read-models";
import type {
  CreateClassroomInput,
  UpdateClassroomInput,
} from "../application/classroom-inputs";
import { eq, and, desc, count, sql } from "drizzle-orm";

export interface UserLookupResult {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image: string | null;
}

// In-memory cache for development/test isolation
const globalForClassroom = globalThis as unknown as {
  devClassroomCache?: Map<string, Classroom>;
  devMemberCache?: Membership[];
  devUserCache?: Map<string, UserLookupResult>;
};

export const devClassroomCache: Map<string, Classroom> =
  globalForClassroom.devClassroomCache || new Map<string, Classroom>();

export const devMemberCache: Membership[] =
  globalForClassroom.devMemberCache || [];

export const devUserCache: Map<string, UserLookupResult> =
  globalForClassroom.devUserCache || new Map<string, UserLookupResult>();

if (
  process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_E2E_MOCK_AUTH === "true"
) {
  globalForClassroom.devClassroomCache = devClassroomCache;
  globalForClassroom.devMemberCache = devMemberCache;
  globalForClassroom.devUserCache = devUserCache;

  if (!devUserCache.has("teacher@ielts.liuhocngoaingu.com")) {
    devUserCache.set("teacher@ielts.liuhocngoaingu.com", {
      id: "usr_mock_teacher_01",
      name: "IELTS Teacher Dev",
      email: "teacher@ielts.liuhocngoaingu.com",
      role: "teacher",
      image: null,
    });
  }
  if (!devUserCache.has("learner@ielts-prep.vn")) {
    devUserCache.set("learner@ielts-prep.vn", {
      id: "usr_mock_learner_01",
      name: "IELTS Learner Dev",
      email: "learner@ielts-prep.vn",
      role: "learner",
      image: null,
    });
  }
}

export function clearDevClassroomCache(): void {
  devClassroomCache.clear();
  devMemberCache.length = 0;
  devUserCache.clear();
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_E2E_MOCK_AUTH === "true"
  ) {
    devUserCache.set("teacher@ielts.liuhocngoaingu.com", {
      id: "usr_mock_teacher_01",
      name: "IELTS Teacher Dev",
      email: "teacher@ielts.liuhocngoaingu.com",
      role: "teacher",
      image: null,
    });
    devUserCache.set("learner@ielts-prep.vn", {
      id: "usr_mock_learner_01",
      name: "IELTS Learner Dev",
      email: "learner@ielts-prep.vn",
      role: "learner",
      image: null,
    });
  }
}

export function registerDevUser(userData: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string | null;
}): void {
  devUserCache.set(userData.email.toLowerCase().trim(), {
    id: userData.id,
    name: userData.name,
    email: userData.email.toLowerCase().trim(),
    role: userData.role,
    image: userData.image ?? null,
  });
}

/**
 * Finds an identity user by email (case-insensitive)
 */
export async function findUserByEmail(
  email: string
): Promise<UserLookupResult | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check dev cache first
  const cached = devUserCache.get(normalizedEmail);
  if (cached) {
    return cached;
  }

  // 2. Query Postgres if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        })
        .from(user)
        .where(eq(sql`lower(${user.email})`, normalizedEmail))
        .limit(1);

      if (rows.length > 0) {
        return rows[0];
      }
    } catch (err) {
      console.warn(
        "[ClassroomRepository] findUserByEmail database warning:",
        err
      );
    }
  }

  return null;
}

/**
 * Finds an identity user by ID
 */
export async function findUserById(
  userId: string
): Promise<UserLookupResult | null> {
  // 1. Check dev cache first
  for (const u of devUserCache.values()) {
    if (u.id === userId) {
      return u;
    }
  }

  // 2. Query Postgres if DATABASE_URL is available
  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (rows.length > 0) {
        return rows[0];
      }
    } catch (err) {
      console.warn("[ClassroomRepository] findUserById database warning:", err);
    }
  }

  return null;
}

/**
 * Creates a new classroom owned by the specified teacher
 */
export async function createClassroom(
  teacherId: string,
  input: CreateClassroomInput
): Promise<Classroom> {
  const classroomId = crypto.randomUUID();
  const now = new Date();

  const record: Classroom = {
    id: classroomId,
    teacherId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };

  if (process.env.DATABASE_URL) {
    try {
      await db.insert(classrooms).values({
        id: record.id,
        teacherId: record.teacherId,
        name: record.name,
        description: record.description,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    } catch (err) {
      console.warn("[ClassroomRepository] createClassroom DB warning:", err);
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  devClassroomCache.set(record.id, record);
  return record;
}

/**
 * Updates an existing classroom's name and/or description
 */
export async function updateClassroom(
  classroomId: string,
  input: UpdateClassroomInput
): Promise<Classroom> {
  const existing = await findClassroomById(classroomId);
  if (!existing) {
    throw new Error(`Classroom with id "${classroomId}" not found.`);
  }

  const now = new Date();
  const updatedName =
    input.name !== undefined ? input.name.trim() : existing.name;
  const updatedDesc =
    input.description !== undefined
      ? input.description === null
        ? null
        : input.description.trim() || null
      : existing.description;

  const updatedRecord: Classroom = {
    ...existing,
    name: updatedName,
    description: updatedDesc,
    updatedAt: now,
  };

  if (process.env.DATABASE_URL) {
    try {
      await db
        .update(classrooms)
        .set({
          name: updatedRecord.name,
          description: updatedRecord.description,
          updatedAt: updatedRecord.updatedAt,
        })
        .where(eq(classrooms.id, classroomId));
    } catch (err) {
      console.warn("[ClassroomRepository] updateClassroom DB warning:", err);
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  devClassroomCache.set(classroomId, updatedRecord);
  return updatedRecord;
}

/**
 * Retrieves a classroom by its unique ID
 */
export async function findClassroomById(
  classroomId: string
): Promise<Classroom | null> {
  if (devClassroomCache.has(classroomId)) {
    return devClassroomCache.get(classroomId) || null;
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.id, classroomId))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        return {
          id: r.id,
          teacherId: r.teacherId,
          name: r.name,
          description: r.description,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        };
      }
    } catch (err) {
      console.warn("[ClassroomRepository] findClassroomById DB warning:", err);
    }
  }

  return null;
}

/**
 * Lists all classrooms owned by a specific teacher, including member counts
 */
export async function listClassroomsByTeacherId(
  teacherId: string
): Promise<ClassroomWithMemberCount[]> {
  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select({
          id: classrooms.id,
          teacherId: classrooms.teacherId,
          name: classrooms.name,
          description: classrooms.description,
          createdAt: classrooms.createdAt,
          updatedAt: classrooms.updatedAt,
          memberCount: count(classroomMembers.id),
        })
        .from(classrooms)
        .leftJoin(
          classroomMembers,
          eq(classrooms.id, classroomMembers.classroomId)
        )
        .where(eq(classrooms.teacherId, teacherId))
        .groupBy(classrooms.id)
        .orderBy(desc(classrooms.createdAt));

      return rows.map((r) => ({
        id: r.id,
        teacherId: r.teacherId,
        name: r.name,
        description: r.description,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        memberCount: Number(r.memberCount) || 0,
      }));
    } catch (err) {
      console.warn(
        "[ClassroomRepository] listClassroomsByTeacherId DB warning:",
        err
      );
    }
  }

  // Fallback to dev cache
  const results: ClassroomWithMemberCount[] = [];
  for (const c of devClassroomCache.values()) {
    if (c.teacherId === teacherId) {
      const memberCount = devMemberCache.filter(
        (m) => m.classroomId === c.id
      ).length;
      results.push({ ...c, memberCount });
    }
  }

  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Finds a membership record by classroomId and learnerId
 */
export async function findMembership(
  classroomId: string,
  learnerId: string
): Promise<Membership | null> {
  const cached = devMemberCache.find(
    (m) => m.classroomId === classroomId && m.learnerId === learnerId
  );
  if (cached) return cached;

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select()
        .from(classroomMembers)
        .where(
          and(
            eq(classroomMembers.classroomId, classroomId),
            eq(classroomMembers.learnerId, learnerId)
          )
        )
        .limit(1);

      if (rows.length > 0) {
        return rows[0];
      }
    } catch (err) {
      console.warn("[ClassroomRepository] findMembership DB warning:", err);
    }
  }

  return null;
}

/**
 * Adds a learner to a classroom as a member (Issue #73, ADR-0009)
 */
export async function addMembership(
  classroomId: string,
  learnerId: string
): Promise<Membership> {
  const memberId = crypto.randomUUID();
  const now = new Date();

  const record: Membership = {
    id: memberId,
    classroomId,
    learnerId,
    joinedAt: now,
  };

  devMemberCache.push(record);

  if (process.env.DATABASE_URL) {
    try {
      await db.insert(classroomMembers).values({
        id: record.id,
        classroomId: record.classroomId,
        learnerId: record.learnerId,
        joinedAt: record.joinedAt,
      });
    } catch (err) {
      console.warn("[ClassroomRepository] addMembership DB warning:", err);
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  return record;
}

/**
 * Removes a learner from a classroom
 */
export async function removeMembership(
  classroomId: string,
  learnerId: string
): Promise<boolean> {
  let removed = false;

  if (process.env.DATABASE_URL) {
    try {
      await db
        .delete(classroomMembers)
        .where(
          and(
            eq(classroomMembers.classroomId, classroomId),
            eq(classroomMembers.learnerId, learnerId)
          )
        );
      removed = true;
    } catch (err) {
      console.warn("[ClassroomRepository] removeMembership DB warning:", err);
      if (
        process.env.NODE_ENV === "production" &&
        process.env.ENABLE_E2E_MOCK_AUTH !== "true"
      ) {
        throw err;
      }
    }
  }

  const index = devMemberCache.findIndex(
    (m) => m.classroomId === classroomId && m.learnerId === learnerId
  );
  if (index !== -1) {
    devMemberCache.splice(index, 1);
    removed = true;
  }

  return removed;
}

/**
 * Lists all roster items for a given classroom
 */
export async function listClassroomRoster(
  classroomId: string
): Promise<ClassroomRosterItem[]> {
  const cachedMembers = devMemberCache.filter(
    (m) => m.classroomId === classroomId
  );
  if (
    cachedMembers.length > 0 &&
    (process.env.ENABLE_E2E_MOCK_AUTH === "true" ||
      process.env.NODE_ENV !== "production")
  ) {
    const details: ClassroomRosterItem[] = [];
    for (const m of cachedMembers) {
      let learnerName = "Learner";
      let learnerEmail = "learner@example.com";
      let learnerImage: string | null = null;

      for (const u of devUserCache.values()) {
        if (u.id === m.learnerId) {
          learnerName = u.name;
          learnerEmail = u.email;
          learnerImage = u.image;
          break;
        }
      }

      details.push({
        id: m.id,
        classroomId: m.classroomId,
        learnerId: m.learnerId,
        joinedAt: m.joinedAt,
        learnerName,
        learnerEmail,
        learnerImage,
      });
    }

    return details.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select({
          id: classroomMembers.id,
          classroomId: classroomMembers.classroomId,
          learnerId: classroomMembers.learnerId,
          joinedAt: classroomMembers.joinedAt,
          learnerName: user.name,
          learnerEmail: user.email,
          learnerImage: user.image,
        })
        .from(classroomMembers)
        .innerJoin(user, eq(classroomMembers.learnerId, user.id))
        .where(eq(classroomMembers.classroomId, classroomId))
        .orderBy(desc(classroomMembers.joinedAt));

      return rows.map((r) => ({
        id: r.id,
        classroomId: r.classroomId,
        learnerId: r.learnerId,
        joinedAt: r.joinedAt,
        learnerName: r.learnerName,
        learnerEmail: r.learnerEmail,
        learnerImage: r.learnerImage,
      }));
    } catch (err) {
      console.warn(
        "[ClassroomRepository] listClassroomRoster DB warning:",
        err
      );
    }
  }

  // Fallback to dev cache
  const members = devMemberCache.filter((m) => m.classroomId === classroomId);
  const details: ClassroomRosterItem[] = [];

  for (const m of members) {
    let learnerName = "Learner";
    let learnerEmail = "learner@example.com";
    let learnerImage: string | null = null;

    for (const u of devUserCache.values()) {
      if (u.id === m.learnerId) {
        learnerName = u.name;
        learnerEmail = u.email;
        learnerImage = u.image;
        break;
      }
    }

    details.push({
      id: m.id,
      classroomId: m.classroomId,
      learnerId: m.learnerId,
      joinedAt: m.joinedAt,
      learnerName,
      learnerEmail,
      learnerImage,
    });
  }

  return details.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
}
