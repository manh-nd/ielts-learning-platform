import { describe, it, expect } from "bun:test";
import {
  buildSpeakingAudioStorageKey,
  isSpeakingAudioStorageKeyOwnedBy,
  getSpeakingUploadPresignedUrl,
  getSpeakingDownloadPresignedUrl,
  saveDirectAudioDevFallback,
  getDirectAudioDevFallback,
  deleteSpeakingAudioObject,
  deleteSpeakingAudioSession,
  setSimulatedDeletionFailure,
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

  it("should idempotently delete single audio object from dev cache", async () => {
    const key = "speaking/dev/delete_test/audio.webm";
    await saveDirectAudioDevFallback(
      key,
      Buffer.from("to-delete"),
      "audio/webm"
    );
    expect(await getDirectAudioDevFallback(key)).not.toBeNull();

    const deleteResult = await deleteSpeakingAudioObject(key);
    expect(deleteResult).toBe(true);
    expect(await getDirectAudioDevFallback(key)).toBeNull();

    // Idempotency: deleting non-existent key returns true
    const secondDelete = await deleteSpeakingAudioObject(key);
    expect(secondDelete).toBe(true);
  });

  it("should delete all audio objects for a session prefix while preserving others", async () => {
    const key1 = "speaking/usr_a/ses_target/clip1.webm";
    const key2 = "speaking/usr_a/ses_target/clip2.webm";
    const keyOther = "speaking/usr_a/ses_other/clip1.webm";

    await saveDirectAudioDevFallback(key1, Buffer.from("c1"), "audio/webm");
    await saveDirectAudioDevFallback(key2, Buffer.from("c2"), "audio/webm");
    await saveDirectAudioDevFallback(keyOther, Buffer.from("co"), "audio/webm");

    const deletedCount = await deleteSpeakingAudioSession(
      "usr_a",
      "ses_target"
    );
    expect(deletedCount).toBe(2);

    expect(await getDirectAudioDevFallback(key1)).toBeNull();
    expect(await getDirectAudioDevFallback(key2)).toBeNull();
    expect(await getDirectAudioDevFallback(keyOther)).not.toBeNull();
  });

  it("should propagate errors when storage deletion encounters failures", async () => {
    setSimulatedDeletionFailure(true);

    try {
      expect(
        deleteSpeakingAudioObject("speaking/usr_fail/ses_1/clip.webm")
      ).rejects.toThrow("Simulated storage deletion failure");

      expect(deleteSpeakingAudioSession("usr_fail", "ses_1")).rejects.toThrow(
        "Simulated storage deletion failure"
      );
    } finally {
      setSimulatedDeletionFailure(false);
    }
  });
});
