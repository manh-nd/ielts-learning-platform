/**
 * Run separately from cache-based tests:
 * HOMEWORK_TEST_DATABASE_URL=postgres://.../ielts_publication_test bun run test:homework:integration
 * The dedicated database must exist. Applies repo migrations and removes only this run's fixtures.
 */
import assert from "node:assert/strict";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";

const testUrl = process.env.HOMEWORK_TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test")) {
  throw new Error(
    "HOMEWORK_TEST_DATABASE_URL must explicitly name a dedicated database ending in _test."
  );
}
process.env.DATABASE_URL = testUrl;
const { db, client } = await import("@/lib/db");
const { user } = await import("@/modules/identity/infrastructure/auth-schema");
const { classrooms } =
  await import("@/modules/classroom/infrastructure/classroom-schema");
const schema =
  await import("@/modules/homework/infrastructure/homework-schema");
const {
  commitHomeworkPublication,
  devTeacherAssessmentCache,
  devPublishedAssessmentCache,
  devEvaluationFeedbackCache,
} =
  await import("@/modules/homework/infrastructure/homework-assessment-repository");
const {
  createInitialSubmissionWithAttempt,
  commitResubmission,
  devSubmissionCache,
} =
  await import("@/modules/homework/infrastructure/homework-submission-repository");
const { publicationFixture } =
  await import("@/tests/fixtures/homework-publication");
const teacherId = crypto.randomUUID();
const learnerId = crypto.randomUUID();
const classroomId = crypto.randomUUID();
const assignmentId = crypto.randomUUID();

// Every fixture needs a distinct learner because assignment/learner is unique.
const learnerIds: string[] = [];
async function prepare() {
  const id = crypto.randomUUID();
  learnerIds.push(id);
  await db
    .insert(user)
    .values({ id, name: "Integration learner", email: id + "@example.test" });
  const { submission } = await createInitialSubmissionWithAttempt({
    assignmentId,
    learnerId: id,
    audioResponses: [],
  });
  return publicationFixture(submission, teacherId);
}
async function countRecords(submissionId: string) {
  const rows = await Promise.all(
    [
      schema.teacherAssessments,
      schema.publishedAssessments,
      schema.evaluationFeedbacks,
    ].map((table) =>
      db.select().from(table).where(eq(table.submissionId, submissionId))
    )
  );
  return rows.map((r) => r.length);
}
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.insert(user).values([
    {
      id: teacherId,
      name: "Integration teacher",
      email: teacherId + "@example.test",
      role: "teacher",
    },
    {
      id: learnerId,
      name: "Integration learner",
      email: learnerId + "@example.test",
    },
  ]);
  await db
    .insert(classrooms)
    .values({ id: classroomId, teacherId, name: "Publication integration" });
  await db.insert(schema.homeworkAssignments).values({
    id: assignmentId,
    classroomId,
    teacherId,
    title: "Publication integration",
    prompts: [],
    submissionDeadline: new Date(Date.now() + 60000),
    status: "published",
  });

  const normal = await prepare();
  const attempt = await db
    .select()
    .from(schema.submissionAttempts)
    .where(
      eq(schema.submissionAttempts.submissionId, normal.expectedSubmission.id)
    );
  const proposalId = crypto.randomUUID();
  await db.insert(schema.aiAssessmentProposals).values({
    id: proposalId,
    submissionId: normal.expectedSubmission.id,
    attemptId: attempt[0].id,
    attemptNumber: 1,
    status: "ready",
    scores: {
      fluencyAndCoherence: 6,
      lexicalResource: 6,
      grammaticalRangeAndAccuracy: 6,
      pronunciation: 6,
    },
    overallBand: 6,
  });
  normal.evaluationFeedback.aiProposalId = proposalId;
  const proposalBefore = await db
    .select()
    .from(schema.aiAssessmentProposals)
    .where(eq(schema.aiAssessmentProposals.id, proposalId));
  assert.equal((await commitHomeworkPublication(normal)).kind, "committed");
  assert.deepEqual(await countRecords(normal.expectedSubmission.id), [1, 1, 1]);
  const official = await db
    .select()
    .from(schema.publishedAssessments)
    .where(
      eq(schema.publishedAssessments.submissionId, normal.expectedSubmission.id)
    );
  assert.equal(official[0].teacherAssessmentId, normal.teacherAssessment.id);
  assert.equal(official[0].attemptNumber, 1);
  assert.deepEqual(
    await db
      .select()
      .from(schema.aiAssessmentProposals)
      .where(eq(schema.aiAssessmentProposals.id, proposalId)),
    proposalBefore
  );

  const [publishedSubmission] = await db
    .select()
    .from(schema.homeworkSubmissions)
    .where(eq(schema.homeworkSubmissions.id, normal.expectedSubmission.id));
  assert.equal(publishedSubmission.status, "published");
  assert.equal(publishedSubmission.reviewedAttemptNumber, 1);
  const readers =
    await import("@/modules/homework/infrastructure/homework-assessment-repository");
  // Deliberately poison caches: DB-mode reads must still return committed truth.
  devTeacherAssessmentCache.set(normal.expectedSubmission.id, {
    ...normal.teacherAssessment,
    status: "draft",
  });
  devPublishedAssessmentCache.set(normal.expectedSubmission.id, {
    ...normal.publishedAssessment,
    overallBand: 1,
  });
  devEvaluationFeedbackCache.set(normal.expectedSubmission.id, [
    { ...normal.evaluationFeedback, activeReviewDurationMs: 0 },
  ]);
  assert.equal(
    (
      await readers.findTeacherAssessmentBySubmission(
        normal.expectedSubmission.id
      )
    )?.status,
    "published"
  );
  assert.equal(
    (
      await readers.findPublishedAssessmentBySubmission(
        normal.expectedSubmission.id
      )
    )?.overallBand,
    7
  );
  assert.equal(
    (
      await readers.findPublishedAssessmentByAssignmentAndLearner(
        assignmentId,
        normal.publishedAssessment.learnerId
      )
    )?.overallBand,
    7
  );
  assert.equal(
    (
      await readers.listEvaluationFeedbacksBySubmissionId(
        normal.expectedSubmission.id
      )
    )[0].activeReviewDurationMs,
    1000
  );
  console.log("PASS complete publication and unchanged AI proposal");

  for (const table of ["published_assessments", "evaluation_feedbacks"]) {
    const input = await prepare();
    // A fixture-scoped trigger causes a real server-side failure after earlier transaction writes.
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const fn = "publication_failure_" + suffix;
    await client.unsafe(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.submission_id = '${input.expectedSubmission.id}'::uuid THEN RAISE EXCEPTION 'publication test failure'; END IF; RETURN NEW; END $$`
    );
    await client.unsafe(
      `CREATE TRIGGER ${fn} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION ${fn}()`
    );
    devSubmissionCache.set(input.expectedSubmission.id, {
      ...input.expectedSubmission,
      assignmentId,
      learnerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const cachedBefore = devSubmissionCache.get(input.expectedSubmission.id);
    try {
      await assert.rejects(commitHomeworkPublication(input));
      assert.deepEqual(
        await countRecords(input.expectedSubmission.id),
        [0, 0, 0]
      );
      const [unchanged] = await db
        .select()
        .from(schema.homeworkSubmissions)
        .where(eq(schema.homeworkSubmissions.id, input.expectedSubmission.id));
      assert.equal(unchanged.status, "submitted");
      assert.equal(unchanged.reviewedAttemptNumber, null);
      assert.deepEqual(
        devSubmissionCache.get(input.expectedSubmission.id),
        cachedBefore
      );
      assert.equal(
        devTeacherAssessmentCache.has(input.expectedSubmission.id),
        false
      );
      assert.equal(
        devPublishedAssessmentCache.has(input.expectedSubmission.id),
        false
      );
      assert.equal(
        devEvaluationFeedbackCache.has(input.expectedSubmission.id),
        false
      );
    } finally {
      await client.unsafe(`DROP TRIGGER ${fn} ON ${table}`);
      await client.unsafe(`DROP FUNCTION ${fn}()`);
    }
    console.log("PASS physical rollback on " + table + " failure");
  }

  const concurrent = await prepare();
  const competitor = publicationFixture(
    {
      ...concurrent.expectedSubmission,
      assignmentId,
      learnerId: concurrent.publishedAssessment.learnerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    teacherId
  );
  const outcomes = await Promise.all([
    commitHomeworkPublication(concurrent),
    commitHomeworkPublication(competitor),
  ]);
  assert.deepEqual(outcomes.map((r) => r.kind).sort(), [
    "committed",
    "no_transition",
  ]);
  assert.deepEqual(
    await countRecords(concurrent.expectedSubmission.id),
    [1, 1, 1]
  );
  console.log("PASS concurrent publishers yield one official publication");

  const stale = await prepare();
  await commitResubmission({
    submissionId: stale.expectedSubmission.id,
    expectedCurrentAttemptNumber: 1,
    audioResponses: [],
  });
  assert.equal((await commitHomeworkPublication(stale)).kind, "no_transition");
  assert.deepEqual(await countRecords(stale.expectedSubmission.id), [0, 0, 0]);
  console.log("PASS stale direct publication after resubmission");
} finally {
  await db.delete(user).where(eq(user.id, teacherId));
  for (const id of [learnerId, ...learnerIds])
    await db.delete(user).where(eq(user.id, id));
  await client.end();
}
