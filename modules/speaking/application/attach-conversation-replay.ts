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
 * Parses duration in seconds from a 44-byte standard RIFF WAV buffer.
 */
export function parseWavDurationSeconds(buffer: Buffer): number | null {
  if (buffer.length < 44) return null;

  try {
    const riff = buffer.toString("ascii", 0, 4);
    const wave = buffer.toString("ascii", 8, 12);
    if (riff !== "RIFF" || wave !== "WAVE") return null;

    const byteRate = buffer.readUInt32LE(28);
    const dataSize = buffer.readUInt32LE(40);

    if (byteRate > 0 && dataSize > 0) {
      const duration = dataSize / byteRate;
      return Math.max(1, Math.round(duration * 10) / 10);
    }
  } catch {
    // Ignore header parsing errors
  }

  return null;
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
 * - Parses/validates duration directly from stored WAV bytes.
 */
export async function attachConversationReplayToSpeakingPractice(
  input: AttachConversationReplayInput
): Promise<AttachConversationReplayResult> {
  const { authenticatedUserId, sessionId, durationSeconds } = input;

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

  // 4. Validate / recompute duration from WAV header
  const parsedDuration = parseWavDurationSeconds(audioData.buffer);
  const effectiveDuration =
    parsedDuration !== null
      ? parsedDuration
      : durationSeconds !== undefined && durationSeconds > 0
        ? Math.round(durationSeconds * 10) / 10
        : 1;

  // 5. Persist derived metadata to speaking_sessions
  await speakingPracticeRepository.attachConversationReplay(sessionId, {
    storageKey: canonicalKey,
    mimeType: "audio/wav",
    durationSeconds: effectiveDuration,
  });

  return {
    success: true,
    attached: true,
    durationSeconds: effectiveDuration,
  };
}

export const attachConversationReplay =
  attachConversationReplayToSpeakingPractice;
