import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { db } from "@/lib/db";
import { homeworkSubmissions } from "./homework-schema";
import {
  claimTeacherReview,
  clearDevHomeworkSubmissionCache,
  commitResubmission,
  createInitialSubmissionWithAttempt,
  devSubmissionCache,
  devAttemptCache,
  findSubmissionById,
  findSubmissionByAssignmentAndLearner,
  listAttemptsBySubmissionId,
  listSubmissionsByAssignmentId,
} from "./homework-submission-repository";
import type { HomeworkSubmission } from "../domain/homework-types";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalUpdate = db.update.bind(db);
const restores: (() => void)[] = [];
let submission: HomeworkSubmission;

beforeEach(async () => {
  delete process.env.DATABASE_URL;
  clearDevHomeworkSubmissionCache();
  ({ submission } = await createInitialSubmissionWithAttempt({
    assignmentId: crypto.randomUUID(),
    learnerId: "learner",
    audioResponses: [],
  }));
});
afterEach(() => {
  for (const restore of restores.splice(0).reverse()) restore();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  clearDevHomeworkSubmissionCache();
});
const resubmit = () =>
  commitResubmission({
    submissionId: submission.id,
    expectedCurrentAttemptNumber: 1,
    audioResponses: [],
  });

// Execute actual Drizzle builders against a stubbed executor. These tests verify
// SQL and callback orchestration, not PostgreSQL locking or physical rollback.
function mockUpdate(rows: HomeworkSubmission[]) {
  let querySql: { sql: string; params: unknown[] } | undefined;
  const update = spyOn(db, "update").mockImplementation((() => {
    const builder = originalUpdate(homeworkSubmissions);
    const originalSet = builder.set.bind(builder);
    builder.set = ((values) => {
      const query = originalSet(values);
      query.execute = (async () => {
        querySql = query.toSQL();
        return rows;
      }) as unknown as typeof query.execute;
      return query;
    }) as typeof builder.set;
    return builder;
  }) as unknown as typeof db.update);
  restores.push(() => update.mockRestore());
  return () => querySql!;
}
function mockSelect(rows: HomeworkSubmission[]) {
  const select = spyOn(db, "select").mockImplementation((() => {
    const query = {
      from: () => query,
      where: () => query,
      limit: () => query,
      orderBy: () => query,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve),
    };
    return query;
  }) as unknown as typeof db.select);
  restores.push(() => select.mockRestore());
}
function mockTransaction() {
  const transaction = spyOn(db, "transaction").mockImplementation(
    async (callback) =>
      callback(
        db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0]
      )
  );
  restores.push(() => transaction.mockRestore());
  return transaction;
}
function mockInsert(error?: Error) {
  const values = async () => {
    if (error) throw error;
    return [];
  };
  const insert = spyOn(db, "insert").mockImplementation((() => ({
    values,
  })) as unknown as typeof db.insert);
  restores.push(() => insert.mockRestore());
  return insert;
}

describe("cache transition parity", () => {
  it("commits exactly one of two resubmissions observing attempt #1", async () => {
    const results = await Promise.all([resubmit(), resubmit()]);
    expect(results.map((r) => r.kind)).toEqual(["committed", "no_transition"]);
    expect(
      (await listAttemptsBySubmissionId(submission.id)).map(
        (a) => a.attemptNumber
      )
    ).toEqual([1, 2]);
  });
  it("review wins: stale resubmission adds no attempt", async () => {
    expect((await claimTeacherReview(submission.id)).kind).toBe("claimed");
    expect((await resubmit()).kind).toBe("no_transition");
    expect(await listAttemptsBySubmissionId(submission.id)).toHaveLength(1);
  });
  it("resubmission wins: review locks #2 and reopening preserves the lock", async () => {
    await resubmit();
    const claimed = await claimTeacherReview(submission.id);
    expect(claimed).toMatchObject({
      kind: "claimed",
      submission: { reviewedAttemptNumber: 2 },
    });
    const reopened = await claimTeacherReview(submission.id);
    expect(reopened).toMatchObject({
      kind: "no_transition",
      submission: { reviewedAttemptNumber: 2 },
    });
    if (claimed.kind === "claimed" && reopened.kind === "no_transition") {
      expect(reopened.submission.updatedAt).toEqual(
        claimed.submission.updatedAt
      );
    }
  });
  it("rejects published and missing submissions", async () => {
    devSubmissionCache.set(submission.id, {
      ...submission,
      status: "published",
      reviewedAttemptNumber: 1,
    });
    expect((await resubmit()).kind).toBe("no_transition");
    expect((await claimTeacherReview(submission.id)).kind).toBe(
      "no_transition"
    );
    devSubmissionCache.delete(submission.id);
    expect((await resubmit()).kind).toBe("not_found");
    expect((await claimTeacherReview(submission.id)).kind).toBe("not_found");
  });
});

describe("database conditional transitions", () => {
  it("guards resubmission by id, status and expected attempt, then inserts in the transaction", async () => {
    process.env.DATABASE_URL = "postgresql://mock/test";
    const sql = mockUpdate([{ ...submission, currentAttemptNumber: 2 }]);
    const transaction = mockTransaction();
    const insert = mockInsert();
    expect((await resubmit()).kind).toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(sql().sql).toContain('"homework_submissions"."id" =');
    expect(sql().sql).toContain('"homework_submissions"."status" =');
    expect(sql().sql).toContain(
      '"homework_submissions"."current_attempt_number" ='
    );
    expect(sql().sql).toContain("returning");
    expect(sql().params).toEqual([
      2,
      expect.any(String),
      submission.id,
      "submitted",
      1,
    ]);
    expect(devSubmissionCache.get(submission.id)?.currentAttemptNumber).toBe(1);
  });
  it("zero updated rows skips insertion and reports authoritative review state", async () => {
    process.env.DATABASE_URL = "postgresql://mock/test";
    mockUpdate([]);
    mockTransaction();
    mockSelect([
      { ...submission, status: "in_review", reviewedAttemptNumber: 1 },
    ]);
    const insert = mockInsert();
    expect(await resubmit()).toMatchObject({
      kind: "no_transition",
      submission: { status: "in_review" },
    });
    expect(insert).not.toHaveBeenCalled();
    expect(devAttemptCache.get(submission.id)).toHaveLength(1);
  });
  it("insert failure escapes the transaction callback without changing cache", async () => {
    process.env.DATABASE_URL = "postgresql://mock/test";
    mockUpdate([{ ...submission, currentAttemptNumber: 2 }]);
    mockTransaction();
    const failure = new Error("attempt insert failed");
    mockInsert(failure);
    await expect(resubmit()).rejects.toThrow(failure);
    expect(devSubmissionCache.get(submission.id)).toEqual(submission);
    expect(devAttemptCache.get(submission.id)).toHaveLength(1);
  });
  it("claims with a SQL column reference and returns the persisted latest attempt", async () => {
    process.env.DATABASE_URL = "postgresql://mock/test";
    const sql = mockUpdate([
      {
        ...submission,
        status: "in_review",
        currentAttemptNumber: 2,
        reviewedAttemptNumber: 2,
      },
    ]);
    expect(await claimTeacherReview(submission.id)).toMatchObject({
      kind: "claimed",
      submission: { reviewedAttemptNumber: 2 },
    });
    expect(sql().sql).toContain(
      '"reviewed_attempt_number" = "homework_submissions"."current_attempt_number"'
    );
    expect(sql().sql).toContain('"homework_submissions"."status" =');
    expect(sql().params).toEqual([
      "in_review",
      expect.any(String),
      submission.id,
      "submitted",
    ]);
  });
  it("does not reopen or resubmit published database rows", async () => {
    process.env.DATABASE_URL = "postgresql://mock/test";
    mockUpdate([]);
    mockTransaction();
    mockSelect([
      { ...submission, status: "published", reviewedAttemptNumber: 1 },
    ]);
    expect(await claimTeacherReview(submission.id)).toMatchObject({
      kind: "no_transition",
      submission: { status: "published" },
    });
    expect(await resubmit()).toMatchObject({
      kind: "no_transition",
      submission: { status: "published" },
    });
  });

  it("reports missing database rows without using existing cache entries", async () => {
    process.env.DATABASE_URL = "postgresql://mock/test";
    mockUpdate([]);
    mockSelect([]);
    mockTransaction();
    expect(await claimTeacherReview(submission.id)).toEqual({
      kind: "not_found",
    });
    expect(await resubmit()).toEqual({ kind: "not_found" });
  });

  it("propagates review update failures without modifying cached submission", async () => {
    process.env.DATABASE_URL = "postgresql://mock/test";
    const failure = new Error("review write failed");
    const update = spyOn(db, "update").mockImplementation(() => {
      throw failure;
    });
    restores.push(() => update.mockRestore());
    await expect(claimTeacherReview(submission.id)).rejects.toThrow(failure);
    expect(devSubmissionCache.get(submission.id)).toEqual(submission);
  });

  it("reads the database rather than stale cache on every submission lookup", async () => {
    process.env.DATABASE_URL = "postgresql://mock/test";
    mockSelect([]);
    expect(await findSubmissionById(submission.id)).toBeNull();
    expect(
      await findSubmissionByAssignmentAndLearner(
        submission.assignmentId,
        submission.learnerId
      )
    ).toBeNull();
    expect(
      await listSubmissionsByAssignmentId(submission.assignmentId)
    ).toEqual([]);
    expect(await listAttemptsBySubmissionId(submission.id)).toEqual([]);
  });
  it("propagates failed database reads and initial writes instead of falling back", async () => {
    process.env.DATABASE_URL = "postgresql://mock/test";
    const failure = new Error("database unavailable");
    const select = spyOn(db, "select").mockImplementation(() => {
      throw failure;
    });
    const transaction = spyOn(db, "transaction").mockRejectedValue(failure);
    restores.push(
      () => select.mockRestore(),
      () => transaction.mockRestore()
    );
    await expect(findSubmissionById(submission.id)).rejects.toThrow(failure);
    await expect(
      createInitialSubmissionWithAttempt({
        assignmentId: "new",
        learnerId: "new",
        audioResponses: [],
      })
    ).rejects.toThrow(failure);
    await expect(resubmit()).rejects.toThrow(failure);
    expect(devSubmissionCache.size).toBe(1);
  });
});
