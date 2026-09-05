import { describe, it, expect, beforeEach } from "bun:test";
import {
  restoreSpeakingPractice,
  mapPersistenceToRestoredPracticeState,
} from "./restore-speaking-practice";
import {
  devSessionCache,
  devResponseCache,
} from "../infrastructure/speaking-practice-repository";
import { persistSpeakingAudioBuffer } from "@/lib/storage/s3-client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import type {
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";

describe("restoreSpeakingPractice Use Case & Critical Test Seams (#82)", () => {
  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
  });

  it("should throw ValidationError if sessionId is empty", async () => {
    await expect(
      restoreSpeakingPractice({
        authenticatedUserId: "learner_1",
        sessionId: "",
      })
    ).rejects.toThrow(ValidationError);
  });

  // Critical Seam 1: restore owned practice with feedback ready
  it("Seam 1: restore owned practice with feedback ready", async () => {
    const sessionId = "ses_restore_feedback_ready";
    const userId = "learner_owner_1";
    const now = new Date();

    const mockFeedback = {
      summary: "Excellent fluency and coherence.",
      estimatedPerformance: {
        overallBand: 7.0,
        fluencyAndCoherence: 7.0,
        lexicalResource: 7.0,
        grammaticalRange: 7.0,
        pronunciation: 7.0,
      },
    };

    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Owner",
      topicTitle: "Technology",
      status: "evaluated",
      targetPart: "part_1",
      durationSeconds: 45,
      overallBand: 7.0,
      scorecardJson: mockFeedback,
      evidenceJson: {
        trace: { model: "gemini-3.7-flash", latencyMs: 1200 },
      },
      createdAt: now,
      updatedAt: now,
    });

    devResponseCache.set(sessionId, [
      {
        id: `resp_${sessionId}_0`,
        sessionId,
        partNumber: 1,
        itemIndex: 0,
        promptQuestion: "Technology",
        storageKey: `speaking/${userId}/${sessionId}/candidate.webm`,
        audioUrl: "/api/speaking/audio.webm",
        mimeType: "audio/webm",
        startMs: 0,
        endMs: 45000,
        durationSeconds: 45,
        liveTranscript: "I use technology daily.",
        verifiedTranscript: "I use technology daily.",
        createdAt: now,
      },
    ]);

    const result = await restoreSpeakingPractice({
      authenticatedUserId: userId,
      sessionId,
    });

    expect(result.restoredState.status).toBe("ended_feedback_ready");
    if (result.restoredState.status === "ended_feedback_ready") {
      expect(result.restoredState.sessionId).toBe(sessionId);
      expect(result.restoredState.feedback).toEqual(
        mockFeedback as unknown as PracticeFeedback
      );
      expect(result.restoredState.trace).toEqual({
        model: "gemini-3.7-flash",
        latencyMs: 1200,
      } as unknown as SpeakingEvaluationTrace);
    }
  });

  // Critical Seam 2: restore ended practice with evaluation failed + audio available
  it("Seam 2: restore ended practice with evaluation failed + audio available", async () => {
    const sessionId = "ses_restore_failed_with_audio";
    const userId = "learner_owner_2";
    const storageKey = `speaking/${userId}/${sessionId}/candidate.webm`;
    await persistSpeakingAudioBuffer(
      storageKey,
      Buffer.from("valid-audio-bytes")
    );

    const now = new Date();
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Owner",
      topicTitle: "Travel",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 60,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: {
        evaluationStatus: "failed",
        evaluationError: "AI model temporary overload 503",
      },
      createdAt: now,
      updatedAt: now,
    });

    devResponseCache.set(sessionId, [
      {
        id: `resp_${sessionId}_0`,
        sessionId,
        partNumber: 1,
        itemIndex: 0,
        promptQuestion: "Travel",
        storageKey,
        audioUrl: "/api/speaking/audio.webm",
        mimeType: "audio/webm",
        startMs: 0,
        endMs: 60000,
        durationSeconds: 60,
        liveTranscript: "I love travelling.",
        verifiedTranscript: null,
        createdAt: now,
      },
    ]);

    const result = await restoreSpeakingPractice({
      authenticatedUserId: userId,
      sessionId,
    });

    expect(result.restoredState.status).toBe(
      "ended_evaluation_failed_retryable"
    );
    if (result.restoredState.status === "ended_evaluation_failed_retryable") {
      expect(result.restoredState.sessionId).toBe(sessionId);
      expect(result.restoredState.canRetry).toBe(true);
      expect(result.restoredState.error).toBe(
        "AI model temporary overload 503"
      );
    }
  });

  // Critical Seam 3: restore ended practice with evaluation failed + audio purged/missing
  it("Seam 3a: restore ended practice with evaluation failed + audio missing from storage", async () => {
    const sessionId = "ses_restore_failed_missing_audio";
    const userId = "learner_owner_3";
    const now = new Date();

    // Response exists with storageKey, but NO audio buffer was persisted in storage
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Owner",
      topicTitle: "Sports",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 30,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: {
        evaluationStatus: "failed",
        evaluationError: "Model error",
      },
      createdAt: now,
      updatedAt: now,
    });

    devResponseCache.set(sessionId, [
      {
        id: `resp_${sessionId}_0`,
        sessionId,
        partNumber: 1,
        itemIndex: 0,
        promptQuestion: "Sports",
        storageKey: `speaking/${userId}/${sessionId}/nonexistent.webm`,
        audioUrl: "/api/speaking/audio.webm",
        mimeType: "audio/webm",
        startMs: 0,
        endMs: 30000,
        durationSeconds: 30,
        liveTranscript: "I like sports.",
        verifiedTranscript: null,
        createdAt: now,
      },
    ]);

    const result = await restoreSpeakingPractice({
      authenticatedUserId: userId,
      sessionId,
    });

    expect(result.restoredState.status).toBe("ended_audio_unavailable");
    if (result.restoredState.status === "ended_audio_unavailable") {
      expect(result.restoredState.sessionId).toBe(sessionId);
      expect(result.restoredState.canRetry).toBe(false);
      expect(result.restoredState.error).toContain(
        "Không tìm thấy hoặc bản thu âm gốc đã hết hạn lưu trữ"
      );
    }
  });

  it("Seam 3b: restore ended practice with evaluation failed + practice transitioned to audio_purged", async () => {
    const sessionId = "ses_restore_failed_purged_audio";
    const userId = "learner_owner_3b";
    const now = new Date();

    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Owner",
      topicTitle: "Sports",
      status: "audio_purged",
      targetPart: "part_1",
      durationSeconds: 30,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: {
        evaluationStatus: "failed",
      },
      createdAt: now,
      updatedAt: now,
    });

    const result = await restoreSpeakingPractice({
      authenticatedUserId: userId,
      sessionId,
    });

    expect(result.restoredState.status).toBe("ended_audio_unavailable");
    if (result.restoredState.status === "ended_audio_unavailable") {
      expect(result.restoredState.canRetry).toBe(false);
    }
  });

  // Critical Seam 4: restore another learner's practice -> hidden/not found
  it("Seam 4: restore another learner's practice -> hidden/not found (throws NotFoundError)", async () => {
    const sessionId = "ses_victim_cross_restore";
    const victimUserId = "learner_victim";
    const attackerUserId = "learner_attacker";
    const now = new Date();

    devSessionCache.set(sessionId, {
      id: sessionId,
      userId: victimUserId,
      candidateName: "Victim",
      topicTitle: "Private Topic",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 30,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: now,
      updatedAt: now,
    });

    await expect(
      restoreSpeakingPractice({
        authenticatedUserId: attackerUserId,
        sessionId,
      })
    ).rejects.toThrow(NotFoundError);
  });

  // Critical Seam 5: restore ended practice while evaluation is not yet complete
  it("Seam 5: restore ended practice while evaluation is not yet complete (ended_evaluating)", async () => {
    const sessionId = "ses_restore_in_flight_eval";
    const userId = "learner_owner_5";
    const now = new Date();

    // Ended practice ('completed') but no scorecard and no failure marker (still evaluating)
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Owner",
      topicTitle: "Education",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 50,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = await restoreSpeakingPractice({
      authenticatedUserId: userId,
      sessionId,
    });

    expect(result.restoredState.status).toBe("ended_evaluating");
    if (result.restoredState.status === "ended_evaluating") {
      expect(result.restoredState.sessionId).toBe(sessionId);
    }
  });

  it("should map in_progress practice to in_progress state", async () => {
    const sessionId = "ses_restore_in_progress";
    const userId = "learner_owner_6";
    const now = new Date();

    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Owner",
      topicTitle: "Hobbies",
      status: "in_progress",
      targetPart: "part_1",
      durationSeconds: 0,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = await restoreSpeakingPractice({
      authenticatedUserId: userId,
      sessionId,
    });

    expect(result.restoredState.status).toBe("in_progress");
    expect(result.restoredState.sessionId).toBe(sessionId);
  });

  it("should map abandoned practice to ended_audio_unavailable state", async () => {
    const state = mapPersistenceToRestoredPracticeState({
      practice: {
        id: "ses_abandoned",
        status: "abandoned",
      },
      hasAuthoritativeOriginalAudio: false,
    });

    expect(state.status).toBe("ended_audio_unavailable");
    if (state.status === "ended_audio_unavailable") {
      expect(state.canRetry).toBe(false);
      expect(state.error).toBe("Phiên luyện tập đã bị hủy bỏ.");
    }
  });
});
