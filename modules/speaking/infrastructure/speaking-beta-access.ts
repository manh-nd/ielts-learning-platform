import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { speakingSessions } from "./speaking-schema";
import type { SpeakingPracticeScope } from "../domain";
import type { PracticePlan } from "../domain/practice-plan";

export function assertBetaAccess(userId: string, scope: SpeakingPracticeScope) {
  const enabled = process.env.SPEAKING_BETA_ENABLED === "true";
  if (!enabled && process.env.NODE_ENV !== "production") return;
  if (
    !enabled ||
    !(process.env.SPEAKING_BETA_LEARNER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .includes(userId) ||
    !(process.env.SPEAKING_BETA_PARTS ?? "")
      .split(",")
      .map((s) => s.trim())
      .includes(scope)
  ) {
    throw new ForbiddenError(
      "Speaking practice is not enabled for this learner and part."
    );
  }
}
function limit(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}
/** All admissions serialize across processes; no process-local quota counters. */
export async function admitBetaPractice(input: {
  userId: string;
  candidateName: string;
  sessionId: string;
  targetPart: SpeakingPracticeScope;
  plan: PracticePlan;
}) {
  if (!process.env.DATABASE_URL)
    throw new Error("Private beta requires durable database storage.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7183801)`);
    const [existing] = await tx
      .select()
      .from(speakingSessions)
      .where(eq(speakingSessions.id, input.sessionId));
    if (existing) {
      if (existing.userId !== input.userId)
        throw new ForbiddenError("Practice belongs to another learner.");
      if (existing.status !== "in_progress")
        throw new ValidationError("Start a new practice.");
      return existing;
    }
    const now = new Date();
    const active = await tx
      .select()
      .from(speakingSessions)
      .where(
        and(
          eq(speakingSessions.status, "in_progress"),
          gte(speakingSessions.updatedAt, new Date(now.getTime() - 30 * 60000))
        )
      );
    if (active.some((p) => p.userId === input.userId))
      throw new ValidationError("You already have an active practice.");
    if (active.length >= limit("SPEAKING_BETA_CONCURRENT_LIMIT", 1))
      throw new ValidationError("The practice room is busy. Please try later.");
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    const today = await tx
      .select({ id: speakingSessions.id })
      .from(speakingSessions)
      .where(
        and(
          eq(speakingSessions.userId, input.userId),
          gte(speakingSessions.createdAt, day)
        )
      );
    if (today.length >= limit("SPEAKING_BETA_DAILY_LIMIT", 5))
      throw new ValidationError("Daily practice limit reached.");
    const [record] = await tx
      .insert(speakingSessions)
      .values({
        id: input.sessionId,
        userId: input.userId,
        candidateName: input.candidateName,
        topicTitle: input.plan.title,
        targetPart: input.targetPart,
        status: "in_progress",
        evidenceJson: { version: 1, plan: input.plan },
      })
      .returning();
    return record;
  });
}

export async function withBetaTokenLease<T>(
  userId: string,
  practiceId: string,
  mint: () => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${practiceId}))`
    );
    const [practice] = await tx
      .select()
      .from(speakingSessions)
      .where(eq(speakingSessions.id, practiceId));
    if (
      !practice ||
      practice.userId !== userId ||
      practice.status !== "in_progress"
    )
      throw new ForbiddenError("An owned active practice is required.");
    const evidence = practice.evidenceJson as Record<string, unknown> | null;
    if (evidence?.liveTokenIssuedAt)
      throw new ValidationError(
        "This practice already has a live connection. Save it and start a new practice."
      );
    const token = await mint();
    await tx
      .update(speakingSessions)
      .set({
        evidenceJson: {
          ...evidence,
          liveTokenIssuedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(speakingSessions.id, practiceId));
    return token;
  });
}
