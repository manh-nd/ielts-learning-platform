import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { db } from "@/lib/db";
import { publicationFixture } from "@/tests/fixtures/homework-publication";
import {
  commitHomeworkPublication,
  clearDevHomeworkAssessmentCache,
  devTeacherAssessmentCache,
  devPublishedAssessmentCache,
  devEvaluationFeedbackCache,
} from "./homework-assessment-repository";
import {
  createInitialSubmissionWithAttempt,
  clearDevHomeworkSubmissionCache,
  devSubmissionCache,
  commitResubmission,
} from "./homework-submission-repository";
import {
  homeworkSubmissions,
  teacherAssessments,
  publishedAssessments,
  evaluationFeedbacks,
} from "./homework-schema";

const originalUrl = process.env.DATABASE_URL;
let input: ReturnType<typeof publicationFixture>;
beforeEach(async () => {
  delete process.env.DATABASE_URL;
  clearDevHomeworkSubmissionCache();
  clearDevHomeworkAssessmentCache();
  const { submission } = await createInitialSubmissionWithAttempt({
    assignmentId: crypto.randomUUID(),
    learnerId: "learner",
    audioResponses: [],
  });
  input = publicationFixture(submission);
});
afterEach(() => {
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
  clearDevHomeworkSubmissionCache();
  clearDevHomeworkAssessmentCache();
});

it("commits all four caches once and rejects a competing publication", async () => {
  const results = await Promise.all([
    commitHomeworkPublication(input),
    commitHomeworkPublication(input),
  ]);
  expect(results.map((r) => r.kind)).toEqual(["committed", "no_transition"]);
  expect(devSubmissionCache.get(input.expectedSubmission.id)?.status).toBe(
    "published"
  );
  expect(devTeacherAssessmentCache.get(input.expectedSubmission.id)).toEqual(
    input.teacherAssessment
  );
  expect(devPublishedAssessmentCache.get(input.expectedSubmission.id)).toEqual(
    input.publishedAssessment
  );
  expect(devEvaluationFeedbackCache.get(input.expectedSubmission.id)).toEqual([
    input.evaluationFeedback,
  ]);
});
it("rejects stale attempts and missing submissions without writes", async () => {
  await commitResubmission({
    submissionId: input.expectedSubmission.id,
    expectedCurrentAttemptNumber: 1,
    audioResponses: [],
  });
  expect((await commitHomeworkPublication(input)).kind).toBe("no_transition");
  expect(devTeacherAssessmentCache.size).toBe(0);
  devSubmissionCache.clear();
  expect((await commitHomeworkPublication(input)).kind).toBe("not_found");
});

for (const failureTable of [
  undefined,
  publishedAssessments,
  evaluationFeedbacks,
]) {
  it(`uses transaction executor and preserves caches on ${failureTable ? "insert failure" : "commit"}`, async () => {
    process.env.DATABASE_URL = "postgres://test";
    const before = devSubmissionCache.get(input.expectedSubmission.id);
    const writes: unknown[] = [];
    let sqlText = "";
    // Real Drizzle builder, stubbed executor: verifies predicates, not physical rollback.
    const tx = {
      update: (table: typeof homeworkSubmissions) => ({
        set: (values: Record<string, unknown>) => ({
          where: (
            predicate: Parameters<
              ReturnType<ReturnType<typeof db.update>["set"]>["where"]
            >[0]
          ) => ({
            returning: async () => {
              sqlText = db
                .update(table)
                .set(values)
                .where(predicate)
                .returning()
                .toSQL().sql;
              return [
                { ...before!, status: "published", reviewedAttemptNumber: 1 },
              ];
            },
          }),
        }),
      }),
      insert: (table: unknown) => ({
        values: async () => {
          writes.push(table);
          if (table === failureTable) throw new Error("insert failed");
        },
      }),
    };
    const transaction = spyOn(db, "transaction").mockImplementation(
      async (callback) =>
        callback(
          tx as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0]
        )
    );
    try {
      if (failureTable) {
        await expect(commitHomeworkPublication(input)).rejects.toThrow(
          "insert failed"
        );
        expect(devSubmissionCache.get(input.expectedSubmission.id)).toEqual(
          before
        );
      } else {
        expect((await commitHomeworkPublication(input)).kind).toBe("committed");
        expect(writes).toEqual([
          teacherAssessments,
          publishedAssessments,
          evaluationFeedbacks,
        ]);
        expect(devSubmissionCache.has(input.expectedSubmission.id)).toBe(false);
      }
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(sqlText).toContain('"status" =');
      expect(sqlText).toContain('"current_attempt_number" =');
      expect(sqlText).toContain('"reviewed_attempt_number" is null');
      expect(devTeacherAssessmentCache.size).toBe(0);
      expect(devPublishedAssessmentCache.size).toBe(0);
      expect(devEvaluationFeedbackCache.size).toBe(0);
    } finally {
      transaction.mockRestore();
    }
  });
}

it("rejects a terminal expected state without replacing official records", async () => {
  const first = await commitHomeworkPublication(input);
  if (first.kind !== "committed") throw new Error("Expected commit");
  const retry = publicationFixture(first.submission);
  expect((await commitHomeworkPublication(retry)).kind).toBe("no_transition");
  expect(devPublishedAssessmentCache.get(first.submission.id)?.id).toBe(
    input.publishedAssessment.id
  );
});

for (const missing of [true, false]) {
  it("returns a DB conditional miss without inserting any assessments", async () => {
    process.env.DATABASE_URL = "postgres://test";
    input.expectedSubmission.status = "in_review";
    input.expectedSubmission.reviewedAttemptNumber = 1;
    let querySql = "";
    const insert = () => {
      throw new Error("Must not insert after conditional miss");
    };
    const tx = {
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: (
            predicate: Parameters<
              ReturnType<ReturnType<typeof db.update>["set"]>["where"]
            >[0]
          ) => ({
            returning: async () => {
              querySql = db
                .update(homeworkSubmissions)
                .set(values)
                .where(predicate)
                .returning()
                .toSQL().sql;
              return [];
            },
          }),
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () =>
              missing
                ? []
                : [devSubmissionCache.get(input.expectedSubmission.id)!],
          }),
        }),
      }),
      insert,
    };
    const transaction = spyOn(db, "transaction").mockImplementation(
      async (callback) =>
        callback(
          tx as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0]
        )
    );
    try {
      expect((await commitHomeworkPublication(input)).kind).toBe(
        missing ? "not_found" : "no_transition"
      );
      expect(querySql).toContain('"reviewed_attempt_number" =');
      expect(devSubmissionCache.get(input.expectedSubmission.id)?.status).toBe(
        "submitted"
      );
    } finally {
      transaction.mockRestore();
    }
  });
}
