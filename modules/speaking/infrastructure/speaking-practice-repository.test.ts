import { describe, it, expect, beforeEach } from "bun:test";
import {
  SpeakingPracticeRepository,
  devSessionCache,
  devResponseCache,
} from "./speaking-practice-repository";

describe("SpeakingPracticeRepository", () => {
  const repository = new SpeakingPracticeRepository();

  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
  });

  it("should return null practice and empty responses when session is not found", async () => {
    const res = await repository.findById("ses_non_existent");
    expect(res.practice).toBeNull();
    expect(res.responses).toEqual([]);
  });

  it("should commit completed practice session to dev cache", async () => {
    const sessionId = "ses_repo_test_1";
    await repository.commitCompleted({
      sessionId,
      userId: "user_learner_1",
      candidateName: "Learner One",
      topicTitle: "Hometown",
      durationSeconds: 45,
      targetPart: "part_1",
      turnMarkers: [
        { promptQuestion: "Where are you from?", startMs: 0, endMs: 45000 },
      ],
      liveTranscript: "I am from Da Nang.",
      storageKey: "speaking/user_learner_1/ses_repo_test_1/candidate.webm",
      audioUrl:
        "/api/speaking/upload-direct?key=speaking%2Fuser_learner_1%2Fses_repo_test_1%2Fcandidate.webm",
    });

    const found = await repository.findById(sessionId);
    expect(found.practice).not.toBeNull();
    expect(found.practice?.id).toBe(sessionId);
    expect(found.practice?.userId).toBe("user_learner_1");
    expect(found.practice?.status).toBe("completed");
    expect(found.practice?.durationSeconds).toBe(45);
    expect(found.responses.length).toBe(1);
    expect(found.responses[0].sessionId).toBe(sessionId);
    expect(found.responses[0].storageKey).toBe(
      "speaking/user_learner_1/ses_repo_test_1/candidate.webm"
    );
  });

  it("should mark practice as evaluated and update feedback", async () => {
    const sessionId = "ses_repo_test_2";
    await repository.commitCompleted({
      sessionId,
      userId: "user_learner_2",
      candidateName: "Learner Two",
      topicTitle: "Studies",
      durationSeconds: 30,
    });

    const mockScorecard = { summary: "Good job", overallBand: 7.0 };
    const mockEvidence = { trace: { latencyMs: 120 } };

    await repository.markEvaluated({
      sessionId,
      userId: "user_learner_2",
      scorecardJson: mockScorecard,
      evidenceJson: mockEvidence,
      verifiedTranscript: "I study computer science in Hanoi.",
    });

    const found = await repository.findById(sessionId);
    expect(found.practice?.status).toBe("evaluated");
    expect(found.practice?.scorecardJson).toEqual(mockScorecard);
    expect(found.practice?.evidenceJson).toEqual(mockEvidence);
    expect(found.responses[0].verifiedTranscript).toBe(
      "I study computer science in Hanoi."
    );
  });

  it("should record failure evidence and retain status as completed when evaluation fails", async () => {
    const sessionId = "ses_repo_test_3";
    await repository.commitCompleted({
      sessionId,
      userId: "user_learner_3",
      candidateName: "Learner Three",
      topicTitle: "Work",
      durationSeconds: 50,
    });

    const failedEvidence = {
      evaluationStatus: "failed",
      evaluationError: "503 Overloaded",
    };

    await repository.markEvaluationFailed({
      sessionId,
      userId: "user_learner_3",
      failedEvidence,
    });

    const found = await repository.findById(sessionId);
    expect(found.practice?.status).toBe("completed");
    expect(found.practice?.evidenceJson).toEqual(failedEvidence);
  });

  it("should create in_progress practice session idempotently", async () => {
    const sessionId = "ses_repo_in_progress";
    const created = await repository.createInProgress({
      sessionId,
      userId: "user_learner_ip",
      candidateName: "In Progress User",
      topicTitle: "Hobbies",
    });

    expect(created.id).toBe(sessionId);
    expect(created.status).toBe("in_progress");
    expect(created.userId).toBe("user_learner_ip");

    const found = await repository.findById(sessionId);
    expect(found.practice?.status).toBe("in_progress");

    // Idempotent: does not overwrite if called again
    const secondCall = await repository.createInProgress({
      sessionId,
      userId: "user_learner_ip",
      topicTitle: "Changed Topic",
    });
    expect(secondCall.topicTitle).toBe("Hobbies");
  });

  it("should identify abandoned in_progress sessions older than 24 hours", async () => {
    const now = Date.now();
    const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);

    await repository.createInProgress({
      sessionId: "ses_abandoned_old",
      userId: "user_old",
      createdAt: twentyFiveHoursAgo,
    });
    // simulate older updatedAt
    const oldSession = devSessionCache.get("ses_abandoned_old")!;
    oldSession.updatedAt = twentyFiveHoursAgo;

    await repository.createInProgress({
      sessionId: "ses_abandoned_recent",
      userId: "user_recent",
      createdAt: twoHoursAgo,
    });

    const abandoned = await repository.findAbandonedSessions(
      24 * 60 * 60 * 1000
    );
    const abandonedIds = abandoned.map((a) => a.practice.id);

    expect(abandonedIds).toContain("ses_abandoned_old");
    expect(abandonedIds).not.toContain("ses_abandoned_recent");
  });

  it("should transition abandoned session to abandoned and purge storage audio", async () => {
    const sessionId = "ses_to_abandon";
    await repository.createInProgress({
      sessionId,
      userId: "user_to_abandon",
    });

    await repository.markAbandonedAndPurgeAudio(sessionId);

    const found = await repository.findById(sessionId);
    expect(found.practice?.status).toBe("abandoned");
  });

  it("should identify completed/evaluated sessions older than 14 days for audio purge", async () => {
    const now = Date.now();
    const fifteenDaysAgo = new Date(now - 15 * 24 * 60 * 60 * 1000);
    const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000);

    await repository.commitCompleted({
      sessionId: "ses_14d_old",
      userId: "user_old_14d",
      candidateName: "Old",
      topicTitle: "Old Topic",
      durationSeconds: 60,
    });
    const oldSession = devSessionCache.get("ses_14d_old")!;
    oldSession.createdAt = fifteenDaysAgo;
    oldSession.updatedAt = fifteenDaysAgo;

    await repository.commitCompleted({
      sessionId: "ses_14d_recent",
      userId: "user_recent_14d",
      candidateName: "Recent",
      topicTitle: "Recent Topic",
      durationSeconds: 60,
    });
    const recentSession = devSessionCache.get("ses_14d_recent")!;
    recentSession.createdAt = fiveDaysAgo;
    recentSession.updatedAt = fiveDaysAgo;

    const toPurge = await repository.findCompletedSessionsForAudioPurge(
      14 * 24 * 60 * 60 * 1000
    );
    const toPurgeIds = toPurge.map((p) => p.practice.id);

    expect(toPurgeIds).toContain("ses_14d_old");
    expect(toPurgeIds).not.toContain("ses_14d_recent");
  });

  it("should purge completed session audio, transition to audio_purged, scrub candidateName, and retain userId/score metadata", async () => {
    const sessionId = "ses_purge_completed";
    await repository.commitCompleted({
      sessionId,
      userId: "user_retention",
      candidateName: "Retention Candidate",
      topicTitle: "Technology",
      durationSeconds: 90,
      storageKey: "speaking/user_retention/ses_purge_completed/candidate.webm",
      audioUrl: "/api/speaking/upload-direct?key=...",
    });

    await repository.markEvaluated({
      sessionId,
      userId: "user_retention",
      scorecardJson: { overallBand: 7.5, fluency: 7.0 },
      evidenceJson: { turnMarkers: [] },
      verifiedTranscript: "Technology is evolving rapidly.",
    });

    await repository.purgeCompletedSessionAudio(sessionId);

    const found = await repository.findById(sessionId);
    expect(found.practice?.status).toBe("audio_purged");
    // candidateName scrubbed for score anonymization per ADR-0010
    expect(found.practice?.candidateName).toBeNull();
    // userId retained so learner can see past results on dashboard
    expect(found.practice?.userId).toBe("user_retention");
    // Scores and transcripts must be preserved!
    expect(found.practice?.scorecardJson).toEqual({
      overallBand: 7.5,
      fluency: 7.0,
    });
    expect(found.practice?.durationSeconds).toBe(90);
    expect(found.responses[0].verifiedTranscript).toBe(
      "Technology is evolving rapidly."
    );
    expect(found.responses[0].audioUrl).toBeNull();
    expect(found.responses[0].storageKey).toBeNull();
  });

  it("should hard delete practice session and responses completely", async () => {
    const sessionId = "ses_to_delete";
    await repository.commitCompleted({
      sessionId,
      userId: "user_owner",
      candidateName: "Owner",
      topicTitle: "Art",
      durationSeconds: 40,
    });

    // Cross-user deletion fails
    const unauthorizedDelete = await repository.hardDeleteSession(
      sessionId,
      "user_intruder"
    );
    expect(unauthorizedDelete).toBe(false);
    expect((await repository.findById(sessionId)).practice).not.toBeNull();

    // Owner deletion succeeds
    const ownerDelete = await repository.hardDeleteSession(
      sessionId,
      "user_owner"
    );
    expect(ownerDelete).toBe(true);

    const afterDelete = await repository.findById(sessionId);
    expect(afterDelete.practice).toBeNull();
    expect(afterDelete.responses).toEqual([]);
  });
});
