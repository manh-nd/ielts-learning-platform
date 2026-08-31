import { speakingPracticeRepository } from "../infrastructure/speaking-practice-repository";
import {
  getSpeakingAudioBuffer,
  buildSpeakingAudioStorageKey,
  persistSpeakingAudioBuffer,
  isSpeakingAudioStorageKeyOwnedBy,
} from "@/lib/storage/s3-client";
import { ForbiddenError } from "@/lib/errors";
import {
  CandidateTurnMarkerInput,
  PracticeEvaluationExecutionResult,
  retryPracticeEvaluation,
  executePracticeEvaluation,
} from "./retry-practice-evaluation";

export interface FinishSpeakingPracticeInput {
  authenticatedUserId: string;
  sessionId: string;
  topicTitle?: string;
  candidateName?: string;
  questions?: string[];
  part1Question?: string;
  durationSeconds?: number;
  transcripts?: Array<{ sender: string; text: string }>;
  turnMarkers?: CandidateTurnMarkerInput[];
  audioBase64?: string;
  storageKey?: string;
  mimeType?: string;
}

/**
 * Orchestrates finishing a Part 1 SpeakingPractice session:
 * 1. Verifies authenticated Learner ownership and storage key namespace.
 * 2. Resolves & persists authoritative OriginalAudio evidence.
 * 3. Commits the Practice as 'completed' in DB before AI evaluation (PracticeEnded != PracticeEvaluated).
 * 4. Runs PracticeEvaluation via Gemini.
 * 5. Transitions Practice to 'evaluated' on success, or records failure evidence while leaving status 'completed'.
 */
export async function finishSpeakingPractice(
  input: FinishSpeakingPracticeInput
): Promise<PracticeEvaluationExecutionResult> {
  const {
    authenticatedUserId,
    sessionId,
    topicTitle = "IELTS Speaking Examination",
    candidateName,
    questions,
    part1Question = "Part 1 Introduction and Interview",
    durationSeconds = 120,
    transcripts = [],
    turnMarkers = [],
    audioBase64,
    storageKey,
    mimeType = "audio/webm;codecs=opus",
  } = input;

  // 0. Resolve & verify existing SpeakingPractice owner before loading audio or evaluating
  const { practice: existingPractice } =
    await speakingPracticeRepository.findById(sessionId);

  if (existingPractice) {
    if (
      !existingPractice.userId ||
      existingPractice.userId !== authenticatedUserId
    ) {
      throw new ForbiddenError(
        "Cannot retry, mutate, or access a speaking practice belonging to another user."
      );
    }

    // Existing owned SpeakingPractice is always treated as RetryEvaluation
    // re-using the same persisted immutable OriginalAudio without re-committing
    return retryPracticeEvaluation({
      authenticatedUserId,
      sessionId,
      topicTitle: input.topicTitle,
      candidateName,
      questions,
      durationSeconds: input.durationSeconds,
      turnMarkers,
    });
  }

  let effectiveStorageKey = storageKey;
  let effectiveMimeType = mimeType;

  // Verify storageKey ownership if client supplied one (must match user and session namespace)
  if (
    effectiveStorageKey &&
    !isSpeakingAudioStorageKeyOwnedBy(
      effectiveStorageKey,
      authenticatedUserId,
      sessionId
    )
  ) {
    throw new ForbiddenError(
      "Cannot evaluate audio with a storage key outside the session namespace."
    );
  }

  // 1. Resolve & Verify Audio Payload (Strict verification: no phantom storageKey bypass)
  let audioBuffer: Buffer | undefined;
  let isAudioPersisted = false;

  // 1a. Try to load from provided storageKey
  if (effectiveStorageKey) {
    const audioData = await getSpeakingAudioBuffer(effectiveStorageKey);
    if (audioData && audioData.buffer && audioData.buffer.length > 0) {
      audioBuffer = audioData.buffer;
      effectiveMimeType = audioData.mimeType;
      isAudioPersisted = true;
    } else {
      console.warn(
        `[finishSpeakingPractice] Storage lookup for key "${effectiveStorageKey}" failed. Treating as unpersisted.`
      );
      isAudioPersisted = false;
    }
  }

  // 1b. If not yet persisted, resolve audioBuffer from audioBase64 and durably persist it
  if (!isAudioPersisted && audioBase64) {
    audioBuffer = Buffer.from(audioBase64, "base64");
    const targetStorageKey =
      effectiveStorageKey ||
      buildSpeakingAudioStorageKey(
        authenticatedUserId,
        sessionId,
        "candidate.webm"
      );

    const persistRes = await persistSpeakingAudioBuffer(
      targetStorageKey,
      audioBuffer,
      effectiveMimeType
    );
    if (persistRes.success) {
      effectiveStorageKey = targetStorageKey;
      isAudioPersisted = true;
    } else {
      console.error(
        "[finishSpeakingPractice] Audio persistence failure: cannot commit practice."
      );
      return {
        success: false,
        isPractice: true,
        practiceMode: "part_1",
        sessionId,
        error: "AUDIO_PERSISTENCE_FAILED",
        message:
          "OriginalAudio could not be durably persisted. Practice cannot be committed.",
        httpStatus: 500,
      };
    }
  }

  // 1c. Final invariant validation: must be truly persisted and non-null
  if (!isAudioPersisted || !audioBuffer || !effectiveStorageKey) {
    return {
      success: false,
      isPractice: true,
      practiceMode: "part_1",
      sessionId,
      error: "ORIGINAL_AUDIO_MISSING",
      message:
        "OriginalAudio evidence is missing or unverified. Cannot evaluate practice.",
      httpStatus: 400,
    };
  }

  // 2. Prepare Effective Metadata
  const typedTurnMarkers = turnMarkers as CandidateTurnMarkerInput[];
  const effectiveTopicTitle = input.topicTitle || topicTitle;
  const effectiveCandidateName = candidateName || "Học viên";
  const effectiveTurnMarkers = typedTurnMarkers;

  const part1Questions: string[] =
    questions ||
    (effectiveTurnMarkers.length > 0
      ? effectiveTurnMarkers.map(
          (m: CandidateTurnMarkerInput) => m.promptQuestion
        )
      : [part1Question]);

  const userTranscripts =
    transcripts.length > 0
      ? (transcripts as Array<{ sender: string; text: string }>)
          .filter((t) => t.sender === "user")
          .map((t) => t.text)
          .join(" ")
      : "";

  const effectiveDuration = input.durationSeconds || durationSeconds;

  // STEP A: Commit completed Practice before AI evaluation (PracticeEnded != PracticeEvaluated)
  const audioUrl = effectiveStorageKey
    ? `/api/speaking/upload-direct?key=${encodeURIComponent(effectiveStorageKey)}`
    : null;

  try {
    await speakingPracticeRepository.commitCompleted({
      sessionId,
      userId: authenticatedUserId,
      candidateName: effectiveCandidateName,
      topicTitle: effectiveTopicTitle,
      durationSeconds: effectiveDuration,
      targetPart: "part_1",
      turnMarkers: effectiveTurnMarkers,
      liveTranscript: userTranscripts,
      storageKey: effectiveStorageKey,
      audioUrl,
      mimeType: effectiveMimeType,
    });
  } catch (commitErr) {
    console.error(
      "[finishSpeakingPractice] Persistence commit failure for completed practice:",
      commitErr
    );
    return {
      success: false,
      isPractice: true,
      practiceMode: "part_1",
      sessionId,
      error: "PRACTICE_PERSISTENCE_FAILED",
      message: "Failed to commit completed practice session to database.",
      httpStatus: 500,
    };
  }

  // STEP B: Run AI evaluation (PracticeEvaluation) & persist result
  return executePracticeEvaluation({
    sessionId,
    authenticatedUserId,
    topicTitle: effectiveTopicTitle,
    questions: part1Questions,
    audioBuffer,
    audioBase64: !audioBuffer ? audioBase64 : undefined,
    mimeType: effectiveMimeType,
    durationSeconds: effectiveDuration,
    liveTranscript: userTranscripts,
    turnMarkers: effectiveTurnMarkers,
  });
}
