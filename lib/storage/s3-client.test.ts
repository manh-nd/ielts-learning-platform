import { describe, it, expect } from "bun:test";
import {
  buildSpeakingAudioStorageKey,
  isSpeakingAudioStorageKeyOwnedBy,
  getSpeakingUploadPresignedUrl,
  getSpeakingDownloadPresignedUrl,
  saveDirectAudioDevFallback,
  getDirectAudioDevFallback,
} from "./s3-client";

describe("S3 Storage & Presigned Upload Pipeline (ADR-0004 & ADR-0003)", () => {
  it("should build standardized S3 storage key", () => {
    const key = buildSpeakingAudioStorageKey(
      "usr_123",
      "ses_456",
      "candidate.webm"
    );
    expect(key).toBe("speaking/usr_123/ses_456/candidate.webm");
  });

  it("should correctly verify storage key ownership by userId and sessionId", () => {
    const ownedKey = "speaking/usr_123/ses_456/candidate.webm";
    const otherKey = "speaking/usr_999/ses_456/candidate.webm";
    const otherSessionKey = "speaking/usr_123/ses_999/candidate.webm";

    expect(isSpeakingAudioStorageKeyOwnedBy(ownedKey, "usr_123")).toBe(true);
    expect(
      isSpeakingAudioStorageKeyOwnedBy(ownedKey, "usr_123", "ses_456")
    ).toBe(true);
    expect(
      isSpeakingAudioStorageKeyOwnedBy(otherSessionKey, "usr_123", "ses_456")
    ).toBe(false);
    expect(isSpeakingAudioStorageKeyOwnedBy(otherKey, "usr_123")).toBe(false);
    expect(
      isSpeakingAudioStorageKeyOwnedBy(otherKey, "usr_123", "ses_456")
    ).toBe(false);
    expect(isSpeakingAudioStorageKeyOwnedBy("", "usr_123")).toBe(false);
  });

  it("should fallback gracefully to internal direct upload URL when S3 is not configured in dev/test", async () => {
    const key = buildSpeakingAudioStorageKey(
      "usr_test",
      "ses_test",
      "candidate.webm"
    );
    const uploadInfo = await getSpeakingUploadPresignedUrl(
      key,
      "audio/webm;codecs=opus"
    );

    expect(uploadInfo.storageKey).toBe(key);
    expect(uploadInfo.uploadUrl).toBeDefined();
    expect(typeof uploadInfo.uploadUrl).toBe("string");
  });

  it("should generate download URL for playback", async () => {
    const key = buildSpeakingAudioStorageKey(
      "usr_test",
      "ses_test",
      "candidate.webm"
    );
    const downloadUrl = await getSpeakingDownloadPresignedUrl(key);

    expect(downloadUrl).toBeDefined();
    expect(typeof downloadUrl).toBe("string");
  });

  it("should save and retrieve direct audio fallback buffer in memory/dev cache", async () => {
    const key = "speaking/dev/test/audio.webm";
    const sampleBuffer = Buffer.from("test-audio-content");

    await saveDirectAudioDevFallback(key, sampleBuffer, "audio/webm");
    const retrieved = await getDirectAudioDevFallback(key);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.data.toString()).toBe("test-audio-content");
    expect(retrieved?.mimeType).toBe("audio/webm");
  });
});
