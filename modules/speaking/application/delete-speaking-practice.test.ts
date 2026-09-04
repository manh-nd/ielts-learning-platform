import { describe, it, expect, beforeEach } from "bun:test";
import { deleteSpeakingPractice } from "./delete-speaking-practice";
import {
  speakingPracticeRepository,
  devSessionCache,
  devResponseCache,
} from "../infrastructure/speaking-practice-repository";
import {
  devTelemetryCache,
  clearDevTelemetryCache,
} from "@/modules/telemetry/infrastructure/telemetry-repository";
import {
  saveDirectAudioDevFallback,
  getDirectAudioDevFallback,
} from "@/lib/storage/s3-client";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";

describe("deleteSpeakingPractice Use Case", () => {
  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
    clearDevTelemetryCache();
  });

  it("should throw ValidationError if sessionId is missing", async () => {
    expect(
      deleteSpeakingPractice({
        sessionId: "",
        authenticatedUserId: "user_123",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should throw NotFoundError if session does not exist", async () => {
    expect(
      deleteSpeakingPractice({
        sessionId: "ses_non_existent",
        authenticatedUserId: "user_123",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw ForbiddenError if practice belongs to another learner", async () => {
    await speakingPracticeRepository.commitCompleted({
      sessionId: "ses_victim",
      userId: "user_victim",
      candidateName: "Victim",
      topicTitle: "Privacy",
      durationSeconds: 60,
    });

    expect(
      deleteSpeakingPractice({
        sessionId: "ses_victim",
        authenticatedUserId: "user_attacker",
      })
    ).rejects.toThrow(ForbiddenError);

    // Verify session remains intact
    const found = await speakingPracticeRepository.findById("ses_victim");
    expect(found.practice).not.toBeNull();
  });

  it("should permanently delete practice session, storage audio, and log telemetry event", async () => {
    const sessionId = "ses_to_hard_delete";
    const userId = "user_owner";
    const storageKey = `speaking/${userId}/${sessionId}/candidate.webm`;

    await speakingPracticeRepository.commitCompleted({
      sessionId,
      userId,
      candidateName: "Owner Candidate",
      topicTitle: "Travel",
      durationSeconds: 120,
      storageKey,
      audioUrl: `/api/speaking/upload-direct?key=${encodeURIComponent(storageKey)}`,
    });

    await saveDirectAudioDevFallback(
      storageKey,
      Buffer.from("raw-audio-data"),
      "audio/webm"
    );
    expect(await getDirectAudioDevFallback(storageKey)).not.toBeNull();

    const result = await deleteSpeakingPractice({
      sessionId,
      authenticatedUserId: userId,
    });

    expect(result.success).toBe(true);
    expect(result.sessionId).toBe(sessionId);

    // 1. Database/cache record removed
    const found = await speakingPracticeRepository.findById(sessionId);
    expect(found.practice).toBeNull();
    expect(found.responses).toEqual([]);

    // 2. Storage audio purged
    expect(await getDirectAudioDevFallback(storageKey)).toBeNull();

    // 3. Telemetry event logged
    const purgedEvents = devTelemetryCache.filter(
      (e) => e.eventName === "practice_purged" && e.contextId === sessionId
    );
    expect(purgedEvents.length).toBe(1);
    expect(purgedEvents[0].userId).toBe(userId);
    expect(purgedEvents[0].userRole).toBe("learner");
    expect(purgedEvents[0].properties.reason).toBe("learner_hard_delete");
  });
});
