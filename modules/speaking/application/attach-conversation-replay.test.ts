import { describe, it, expect, beforeEach } from "bun:test";
import { attachConversationReplayToSpeakingPractice } from "./attach-conversation-replay";
import {
  devSessionCache,
  devResponseCache,
  speakingPracticeRepository,
} from "../infrastructure/speaking-practice-repository";
import {
  directAudioDevCache,
  buildSpeakingAudioStorageKey,
} from "@/lib/storage/s3-client";
import { NotFoundError, ValidationError } from "@/lib/errors";

function createValidWavBuffer(durationSeconds = 2, sampleRate = 24000): Buffer {
  const byteRate = sampleRate * 2;
  const dataSize = Math.round(durationSeconds * byteRate);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

describe("attachConversationReplayToSpeakingPractice Use Case", () => {
  const userId = "user_test_replay";
  const sessionId = "ses_test_replay_1";

  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
    directAudioDevCache.clear();
  });

  it("should successfully attach replay when practice is completed", async () => {
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Candidate",
      topicTitle: "Technology",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 120,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const canonicalKey = buildSpeakingAudioStorageKey(
      userId,
      sessionId,
      "conversation.wav"
    );
    const wavBuffer = createValidWavBuffer(2.5, 24000);
    directAudioDevCache.set(canonicalKey, {
      data: wavBuffer,
      mimeType: "audio/wav",
      updatedAt: Date.now(),
    });

    const res = await attachConversationReplayToSpeakingPractice({
      authenticatedUserId: userId,
      sessionId,
    });

    expect(res.success).toBe(true);
    expect(res.attached).toBe(true);
    expect(res.durationSeconds).toBe(2.5);

    const updated = devSessionCache.get(sessionId);
    expect(updated?.conversationReplayStorageKey).toBe(canonicalKey);
    expect(updated?.conversationReplayMimeType).toBe("audio/wav");
    expect(updated?.conversationReplayDurationSeconds).toBe(2.5);
  });

  it("should successfully attach replay when practice is evaluated (legacy status)", async () => {
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Candidate",
      topicTitle: "Technology",
      status: "evaluated",
      targetPart: "part_1",
      durationSeconds: 120,
      overallBand: 7.0,
      scorecardJson: {},
      evidenceJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const canonicalKey = buildSpeakingAudioStorageKey(
      userId,
      sessionId,
      "conversation.wav"
    );
    directAudioDevCache.set(canonicalKey, {
      data: createValidWavBuffer(3.0),
      mimeType: "audio/wav",
      updatedAt: Date.now(),
    });

    const res = await attachConversationReplayToSpeakingPractice({
      authenticatedUserId: userId,
      sessionId,
    });

    expect(res.success).toBe(true);
    expect(res.durationSeconds).toBe(3.0);
  });

  it("should reject attachment when practice is in_progress", async () => {
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Candidate",
      topicTitle: "Technology",
      status: "in_progress",
      targetPart: "part_1",
      durationSeconds: 0,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      attachConversationReplayToSpeakingPractice({
        authenticatedUserId: userId,
        sessionId,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject attachment when practice is abandoned", async () => {
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Candidate",
      topicTitle: "Technology",
      status: "abandoned",
      targetPart: "part_1",
      durationSeconds: 0,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      attachConversationReplayToSpeakingPractice({
        authenticatedUserId: userId,
        sessionId,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject attachment and clean up uploaded object when practice is audio_purged (purge race guard)", async () => {
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Candidate",
      topicTitle: "Technology",
      status: "audio_purged",
      targetPart: "part_1",
      durationSeconds: 120,
      overallBand: 7.0,
      scorecardJson: {},
      evidenceJson: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const canonicalKey = buildSpeakingAudioStorageKey(
      userId,
      sessionId,
      "conversation.wav"
    );
    directAudioDevCache.set(canonicalKey, {
      data: createValidWavBuffer(2.0),
      mimeType: "audio/wav",
      updatedAt: Date.now(),
    });

    await expect(
      attachConversationReplayToSpeakingPractice({
        authenticatedUserId: userId,
        sessionId,
      })
    ).rejects.toThrow(ValidationError);

    // Verify purge race guard cleaned up the uploaded artifact from storage
    expect(directAudioDevCache.has(canonicalKey)).toBe(false);
  });

  it("should reject attachment for a practice session belonging to another user", async () => {
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId: "other_user",
      candidateName: "Candidate",
      topicTitle: "Technology",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 120,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      attachConversationReplayToSpeakingPractice({
        authenticatedUserId: userId,
        sessionId,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("should fail with ValidationError if the storage object is missing or empty", async () => {
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Candidate",
      topicTitle: "Technology",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 120,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Storage has no object for canonical key
    await expect(
      attachConversationReplayToSpeakingPractice({
        authenticatedUserId: userId,
        sessionId,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("should reject non-WAV or invalid WAV formats and safely delete uploaded object", async () => {
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Candidate",
      topicTitle: "Technology",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 120,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const canonicalKey = buildSpeakingAudioStorageKey(
      userId,
      sessionId,
      "conversation.wav"
    );

    // Case 1: Corrupt / truncated buffer
    directAudioDevCache.set(canonicalKey, {
      data: Buffer.from("NOT_A_WAV_HEADER"),
      mimeType: "audio/wav",
      updatedAt: Date.now(),
    });

    await expect(
      attachConversationReplayToSpeakingPractice({
        authenticatedUserId: userId,
        sessionId,
      })
    ).rejects.toThrow(ValidationError);

    expect(directAudioDevCache.has(canonicalKey)).toBe(false);

    // Case 2: 16kHz WAV instead of 24kHz
    const wav16k = createValidWavBuffer(2.0, 16000);
    directAudioDevCache.set(canonicalKey, {
      data: wav16k,
      mimeType: "audio/wav",
      updatedAt: Date.now(),
    });

    await expect(
      attachConversationReplayToSpeakingPractice({
        authenticatedUserId: userId,
        sessionId,
      })
    ).rejects.toThrow(/24000Hz/);

    expect(directAudioDevCache.has(canonicalKey)).toBe(false);
  });

  it("should fail and clean up artifact if session status changed concurrently before repository attach (atomic update failure)", async () => {
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId,
      candidateName: "Candidate",
      topicTitle: "Technology",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 120,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const canonicalKey = buildSpeakingAudioStorageKey(
      userId,
      sessionId,
      "conversation.wav"
    );
    directAudioDevCache.set(canonicalKey, {
      data: createValidWavBuffer(2.0, 24000),
      mimeType: "audio/wav",
      updatedAt: Date.now(),
    });

    const cached = devSessionCache.get(sessionId)!;
    // Spy / intercept findById to simulate status being completed during check, but purged during attachConversationReplay
    const originalAttach =
      speakingPracticeRepository.attachConversationReplay.bind(
        speakingPracticeRepository
      );
    speakingPracticeRepository.attachConversationReplay = async (sId, data) => {
      // Simulate status became audio_purged right when attach was called
      cached.status = "audio_purged";
      return originalAttach(sId, data);
    };

    try {
      await expect(
        attachConversationReplayToSpeakingPractice({
          authenticatedUserId: userId,
          sessionId,
        })
      ).rejects.toThrow(/no longer eligible/);

      expect(directAudioDevCache.has(canonicalKey)).toBe(false);
    } finally {
      speakingPracticeRepository.attachConversationReplay = originalAttach;
    }
  });
});
