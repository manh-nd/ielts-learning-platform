import { db } from "@/lib/db";
import { classrooms, classroomMembers } from "./classroom-schema";
import { user } from "@/modules/identity/infrastructure/auth-schema";
import type {
  Classroom,
  ClassroomWithMemberCount,
  ClassroomMember,
  ClassroomMemberDetail,
  CreateClassroomInput,
} from "../domain/classroom-types";
import { eq, and, desc, count, sql } from "drizzle-orm";

export interface UserLookupResult {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
}

// In-memory cache for development/test isolation
const globalForClassroom = globalThis as unknown as {
  devClassroomCache?: Map<string, Classroom>;
  devMemberCache?: ClassroomMember[];
  devUserCache?: Map<string, UserLookupResult>;
};

export const devClassroomCache: Map<string, Classroom> =
  globalForClassroom.devClassroomCache || new Map<string, Classroom>();

export const devMemberCache: ClassroomMember[] =
  globalForClassroom.devMemberCache || [];

export const devUserCache: Map<string, UserLookupResult> =
  globalForClassroom.devUserCache || new Map<string, UserLookupResult>();

if (process.env.NODE_ENV !== "production") {
  globalForClassroom.devClassroomCache = devClassroomCache;
  globalForClassroom.devMemberCache = devMemberCache;
  globalForClassroom.devUserCache = devUserCache;
}

export function clearDevClassroomCache(): void {
  devClassroomCache.clear();
  devMemberCache.length = 0;
  devUserCache.clear();
}

export function registerDevUser(userData: {
  id: string;
  name: string;
  email: string;
  role: string;
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
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  devClassroomCache.set(record.id, record);
  return record;
}

/**
 * Retrieves a classroom by its unique ID
 */
export async function findClassroomById(
  classroomId: string
): Promise<Classroom | null> {
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

  return devClassroomCache.get(classroomId) || null;
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
export async function findMember(
  classroomId: string,
  learnerId: string
): Promise<ClassroomMember | null> {
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
      console.warn("[ClassroomRepository] findMember DB warning:", err);
    }
  }

  const found = devMemberCache.find(
    (m) => m.classroomId === classroomId && m.learnerId === learnerId
  );
  return found || null;
}

/**
 * Enrolls a learner into a classroom
 */
export async function enrollMember(
  classroomId: string,
  learnerId: string
): Promise<ClassroomMember> {
  const memberId = crypto.randomUUID();
  const now = new Date();

  const record: ClassroomMember = {
    id: memberId,
    classroomId,
    learnerId,
    joinedAt: now,
  };

  if (process.env.DATABASE_URL) {
    try {
      await db.insert(classroomMembers).values({
        id: record.id,
        classroomId: record.classroomId,
        learnerId: record.learnerId,
        joinedAt: record.joinedAt,
      });
    } catch (err) {
      console.warn("[ClassroomRepository] enrollMember DB warning:", err);
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  devMemberCache.push(record);
  return record;
}

/**
 * Removes a learner from a classroom
 */
export async function removeMember(
  classroomId: string,
  learnerId: string
): Promise<boolean> {
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
    } catch (err) {
      console.warn("[ClassroomRepository] removeMember DB warning:", err);
      if (process.env.NODE_ENV === "production") {
        throw err;
      }
    }
  }

  const initialLength = devMemberCache.length;
  const index = devMemberCache.findIndex(
    (m) => m.classroomId === classroomId && m.learnerId === learnerId
  );
  if (index !== -1) {
    devMemberCache.splice(index, 1);
  }

  return devMemberCache.length < initialLength;
}

/**
 * Lists all member details for a given classroom
 */
export async function listClassroomMembers(
  classroomId: string
): Promise<ClassroomMemberDetail[]> {
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
        "[ClassroomRepository] listClassroomMembers DB warning:",
        err
      );
    }
  }

  // Fallback to dev cache
  const members = devMemberCache.filter((m) => m.classroomId === classroomId);
  const details: ClassroomMemberDetail[] = [];

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
