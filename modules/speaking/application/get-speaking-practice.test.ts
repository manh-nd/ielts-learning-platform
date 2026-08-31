import { describe, it, expect, beforeEach } from "bun:test";
import { getSpeakingPractice } from "./get-speaking-practice";
import {
  devSessionCache,
  devResponseCache,
} from "../infrastructure/speaking-practice-repository";
import { NotFoundError, ValidationError } from "@/lib/errors";

describe("getSpeakingPractice Use Case", () => {
  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
  });

  it("should throw ValidationError if sessionId is empty", async () => {
    await expect(
      getSpeakingPractice({
        authenticatedUserId: "learner_1",
        sessionId: "",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should throw NotFoundError if session does not exist", async () => {
    await expect(
      getSpeakingPractice({
        authenticatedUserId: "learner_1",
        sessionId: "ses_missing",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw NotFoundError (404) if session belongs to another learner (preventing enumeration)", async () => {
    devSessionCache.set("ses_victim", {
      id: "ses_victim",
      userId: "learner_victim",
      candidateName: "Victim",
      topicTitle: "Topic",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 30,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      getSpeakingPractice({
        authenticatedUserId: "learner_attacker",
        sessionId: "ses_victim",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("should return practice and responses when owned by authenticated learner", async () => {
    const sessionId = "ses_learner_valid";
    const now = new Date();
    const sessionData = {
      id: sessionId,
      userId: "learner_owner",
      candidateName: "Owner",
      topicTitle: "Family",
      status: "evaluated" as const,
      targetPart: "part_1",
      durationSeconds: 40,
      overallBand: null,
      scorecardJson: { summary: "Great" },
      evidenceJson: { trace: {} },
      createdAt: now,
      updatedAt: now,
    };
    devSessionCache.set(sessionId, sessionData);

    devResponseCache.set(sessionId, [
      {
        id: `resp_${sessionId}_p1_0`,
        sessionId,
        partNumber: 1,
        itemIndex: 0,
        promptQuestion: "Family",
        storageKey: `speaking/learner_owner/${sessionId}/candidate.webm`,
        audioUrl: "/api/speaking/audio.webm",
        mimeType: "audio/webm",
        startMs: 0,
        endMs: 40000,
        durationSeconds: 40,
        liveTranscript: "My family is small.",
        verifiedTranscript: "My family is small.",
        createdAt: now,
      },
    ]);

    const result = await getSpeakingPractice({
      authenticatedUserId: "learner_owner",
      sessionId,
    });

    expect(result.session.id).toBe(sessionId);
    expect(result.session.userId).toBe("learner_owner");
    expect(result.session.status).toBe("evaluated");
    expect(result.responses.length).toBe(1);
    expect(result.responses[0].verifiedTranscript).toBe("My family is small.");
  });
});
