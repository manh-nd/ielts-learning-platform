import { speakingPracticeRepository } from "../infrastructure/speaking-practice-repository";
import {
  getSpeakingAudioBuffer,
  buildSpeakingAudioStorageKey,
  deleteSpeakingAudioObject,
} from "@/lib/storage/s3-client";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { canAttachConversationReplay } from "../domain";

export interface AttachConversationReplayInput {
  authenticatedUserId: string;
  sessionId: string;
  durationSeconds?: number;
}

export interface AttachConversationReplayResult {
  success: boolean;
  attached: boolean;
  durationSeconds: number;
}

/**
 * Strictly validates that the buffer is a valid 24kHz 16-bit mono PCM WAV file
 * and returns the duration in seconds. Throws ValidationError if invalid.
 */
export function validateAndParseConversationReplayWav(buffer: Buffer): number {
  if (buffer.length < 44) {
    throw new ValidationError(
      "Conversation replay audio is smaller than 44-byte WAV header"
    );
  }

  const riff = buffer.toString("ascii", 0, 4);
  const wave = buffer.toString("ascii", 8, 12);
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new ValidationError(
      "Invalid WAV header: missing RIFF/WAVE magic bytes"
    );
  }

  const fmt = buffer.toString("ascii", 12, 16);
  if (fmt !== "fmt ") {
    throw new ValidationError("Invalid WAV header: missing fmt subchunk");
  }

  const audioFormat = buffer.readUInt16LE(20);
  if (audioFormat !== 1) {
    throw new ValidationError(
      `Invalid WAV format: expected PCM (1), got ${audioFormat}`
    );
  }

  const numChannels = buffer.readUInt16LE(22);
  if (numChannels !== 1) {
    throw new ValidationError(
      `Invalid WAV channels: expected mono (1), got ${numChannels}`
    );
  }

  const sampleRate = buffer.readUInt32LE(24);
  if (sampleRate !== 24000) {
    throw new ValidationError(
      `Invalid WAV sample rate: expected 24000Hz, got ${sampleRate}Hz`
    );
  }

  const byteRate = buffer.readUInt32LE(28);
  const blockAlign = buffer.readUInt16LE(32);
  const bitsPerSample = buffer.readUInt16LE(34);

  if (bitsPerSample !== 16) {
    throw new ValidationError(
      `Invalid WAV bits per sample: expected 16, got ${bitsPerSample}`
    );
  }

  if (blockAlign !== 2) {
    throw new ValidationError(
      `Invalid WAV block align: expected 2, got ${blockAlign}`
    );
  }

  if (byteRate !== 48000) {
    throw new ValidationError(
      `Invalid WAV byte rate: expected 48000 (24000 * 2), got ${byteRate}`
    );
  }

  const dataTag = buffer.toString("ascii", 36, 40);
  if (dataTag !== "data") {
    throw new ValidationError("Invalid WAV header: missing data chunk header");
  }

  const dataSize = buffer.readUInt32LE(40);
  if (dataSize === 0) {
    throw new ValidationError("Conversation replay audio contains no PCM data");
  }

  if (dataSize > buffer.length - 44) {
    throw new ValidationError(
      "Invalid WAV data size: exceeds buffer byte length"
    );
  }

  const duration = dataSize / byteRate;
  return Math.max(1, Math.round(duration * 10) / 10);
}

/**
 * Parses duration in seconds from a 44-byte standard RIFF WAV buffer.
 * Kept for backwards-compatibility.
 */
export function parseWavDurationSeconds(buffer: Buffer): number | null {
  try {
    return validateAndParseConversationReplayWav(buffer);
  } catch {
    return null;
  }
}

/**
 * Best-effort cleanup helper if practice becomes ineligible after binary upload.
 */
async function safeDeleteReplayArtifact(storageKey: string) {
  try {
    await deleteSpeakingAudioObject(storageKey);
  } catch (err) {
    console.warn(
      `[attachConversationReplay] Best-effort cleanup of "${storageKey}" failed:`,
      err
    );
  }
}

/**
 * Application use case for attaching derived ConversationReplay metadata to an ended SpeakingPractice.
 *
 * Invariants:
 * - Client never provides storageKey; canonical key is strictly derived server-side.
 * - Eligibility enforced via canAttachConversationReplay(practice.status).
 * - Purge race guard: if ineligible, best-effort deletes the uploaded canonical artifact.
 * - Parses/strictly validates audio format and duration directly from stored WAV bytes.
 * - Atomically attaches metadata only if session is still completed/evaluated.
 */
export async function attachConversationReplayToSpeakingPractice(
  input: AttachConversationReplayInput
): Promise<AttachConversationReplayResult> {
  const { authenticatedUserId, sessionId } = input;

  if (!sessionId) {
    throw new ValidationError("Missing required sessionId parameter");
  }

  if (!authenticatedUserId) {
    throw new ForbiddenError(
      "Authentication required to attach conversation replay"
    );
  }

  // 1. Resolve and verify SpeakingPractice ownership
  const { practice } = await speakingPracticeRepository.findById(sessionId);

  if (!practice || practice.userId !== authenticatedUserId) {
    // Session not found or owned by another user -> attempt best-effort cleanup of potential orphan
    const canonicalKey = buildSpeakingAudioStorageKey(
      authenticatedUserId,
      sessionId,
      "conversation.wav"
    );
    await safeDeleteReplayArtifact(canonicalKey);
    throw new NotFoundError("Session not found");
  }

  const canonicalKey = buildSpeakingAudioStorageKey(
    authenticatedUserId,
    sessionId,
    "conversation.wav"
  );

  // 2. Enforce attachment eligibility policy
  const eligibility = canAttachConversationReplay(practice.status);
  if (!eligibility.eligible) {
    // Purge race guard: if the binary was uploaded but practice became audio_purged or abandoned,
    // best-effort delete the uploaded artifact so it cannot survive after purge.
    await safeDeleteReplayArtifact(canonicalKey);

    if (eligibility.reason === "AUDIO_PURGED") {
      throw new ValidationError(
        "Practice audio has already been purged. Cannot attach conversation replay."
      );
    }
    if (eligibility.reason === "PRACTICE_ABANDONED") {
      throw new ValidationError(
        "Practice session was abandoned. Cannot attach conversation replay."
      );
    }
    throw new ValidationError(
      "Practice session has not ended. Cannot attach conversation replay."
    );
  }

  // 3. Verify object exists and is non-empty in storage
  const audioData = await getSpeakingAudioBuffer(canonicalKey);
  if (!audioData || !audioData.buffer || audioData.buffer.length === 0) {
    throw new ValidationError(
      "Conversation replay audio object missing or empty in storage."
    );
  }

  // 4. Strictly validate 24kHz 16-bit mono WAV format & compute duration from WAV header
  let effectiveDuration: number;
  try {
    effectiveDuration = validateAndParseConversationReplayWav(audioData.buffer);
  } catch (validationErr) {
    await safeDeleteReplayArtifact(canonicalKey);
    throw validationErr;
  }

  // 5. Atomically persist derived metadata to speaking_sessions (where status IN ('completed', 'evaluated'))
  const attached = await speakingPracticeRepository.attachConversationReplay(
    sessionId,
    {
      storageKey: canonicalKey,
      mimeType: "audio/wav",
      durationSeconds: effectiveDuration,
    }
  );

  if (!attached) {
    // Practice was purged or changed status concurrently between step 2 and 5!
    await safeDeleteReplayArtifact(canonicalKey);
    throw new ValidationError(
      "Practice session is no longer eligible to receive conversation replay."
    );
  }

  return {
    success: true,
    attached: true,
    durationSeconds: effectiveDuration,
  };
}

export const attachConversationReplay =
  attachConversationReplayToSpeakingPractice;
