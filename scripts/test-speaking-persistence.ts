import assert from "node:assert/strict";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq, sql } from "drizzle-orm";
const url = process.env.SPEAKING_TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "SPEAKING_TEST_DATABASE_URL must name a dedicated _test database"
  );
process.env.DATABASE_URL = url;
const { db, client } = await import("@/lib/db");
const { user } = await import("@/modules/identity/infrastructure/auth-schema");
const { speakingSessions, speakingResponses } =
  await import("@/modules/speaking/infrastructure/speaking-schema");
const { SpeakingPracticeRepository } =
  await import("@/modules/speaking/infrastructure/speaking-practice-repository");
const repository = new SpeakingPracticeRepository();
const id = crypto.randomUUID();
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db
    .insert(user)
    .values({ id, name: "Speaking integration", email: `${id}@example.test` });
  for (const scope of ["part_1", "part_2", "part_3"] as const) {
    const practiceId = crypto.randomUUID();
    await repository.createInProgress({
      sessionId: practiceId,
      userId: id,
      targetPart: scope,
    });
    const params = {
      sessionId: practiceId,
      userId: id,
      candidateName: "Learner",
      topicTitle: "Topic",
      targetPart: scope,
      durationSeconds: 10,
      storageKey: "original.webm",
    };
    await Promise.all([
      repository.commitCompleted(params),
      repository.commitCompleted({ ...params, storageKey: "second.webm" }),
    ]);
    const found = await repository.findById(practiceId);
    assert.equal(found.responses.length, 1);
    assert.equal(found.responses[0].partNumber, Number(scope.slice(-1)));
    const original = found.responses[0].storageKey;
    await repository.commitCompleted({
      ...params,
      storageKey: "overwrite.webm",
    });
    assert.equal(
      (await repository.findById(practiceId)).responses[0].storageKey,
      original
    );
  }
  const rollbackId = crypto.randomUUID();
  await repository.createInProgress({ sessionId: rollbackId, userId: id });
  // An invalid integer forces the second insert to fail after the session update.
  await assert.rejects(
    repository.commitCompleted({
      sessionId: rollbackId,
      userId: id,
      candidateName: "Learner",
      topicTitle: "Rollback",
      durationSeconds: 3e6,
    })
  );
  assert.equal(
    (await repository.findById(rollbackId)).practice?.status,
    "in_progress"
  );
  assert.equal((await repository.findById(rollbackId)).responses.length, 0);
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(speakingResponses);
  assert.ok(Number(count[0].count) >= 3);
  await db.delete(speakingSessions).where(eq(speakingSessions.id, rollbackId));
  const { admitBetaPractice, assertBetaAccess, withBetaTokenLease } =
    await import("@/modules/speaking/infrastructure/speaking-beta-access");
  const { getPracticePlan } =
    await import("@/modules/speaking/application/get-practice-plan");
  process.env.SPEAKING_BETA_ENABLED = "true";
  process.env.SPEAKING_BETA_LEARNER_IDS = id;
  process.env.SPEAKING_BETA_PARTS = "part_1";
  assertBetaAccess(id, "part_1");
  assert.throws(() => assertBetaAccess("uninvited", "part_1"));
  assert.throws(() => assertBetaAccess(id, "part_2"));
  const input = {
    userId: id,
    candidateName: "Learner",
    targetPart: "part_1" as const,
    plan: getPracticePlan("tech-ai-future", "part_1")!,
  };
  const admissions = await Promise.allSettled(
    [1, 2].map(() =>
      admitBetaPractice({ ...input, sessionId: crypto.randomUUID() })
    )
  );
  assert.equal(admissions.filter((r) => r.status === "fulfilled").length, 1);
  const admitted = admissions.find((r) => r.status === "fulfilled");
  assert.ok(admitted && admitted.status === "fulfilled");
  let minted = 0;
  const tokens = await Promise.allSettled(
    [1, 2].map(() =>
      withBetaTokenLease(id, admitted.value.id, async () => {
        minted++;
        return "test";
      })
    )
  );
  assert.equal(tokens.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(minted, 1);
  await db
    .delete(speakingSessions)
    .where(eq(speakingSessions.id, admitted.value.id));
  process.env.SPEAKING_BETA_DAILY_LIMIT = "3";
  await assert.rejects(
    admitBetaPractice({ ...input, sessionId: crypto.randomUUID() }),
    /Daily practice limit/
  );
  console.log(
    "speaking persistence: PASS (all scopes, concurrency, immutable evidence, rollback)"
  );
} finally {
  await db.delete(speakingSessions).where(eq(speakingSessions.userId, id));
  await db.delete(user).where(eq(user.id, id));
  await client.end();
}
