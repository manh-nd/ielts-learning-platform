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
});
