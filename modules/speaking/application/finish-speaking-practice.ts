import { speakingPracticeRepository } from "../infrastructure/speaking-practice-repository";
import {
  getSpeakingAudioBuffer,
  buildSpeakingAudioStorageKey,
  persistSpeakingAudioBuffer,
  isSpeakingAudioStorageKeyOwnedBy,
} from "@/lib/storage/s3-client";
import { evaluateSpeakingPracticePart1 } from "@/lib/gemini/speaking-evaluator";
import { ForbiddenError } from "@/lib/errors";
import type {
  CandidateTurnMarkerInput,
  PracticeEvaluationExecutionResult,
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

  let effectiveStorageKey = storageKey;
  let effectiveMimeType = mimeType;

  // 0. Resolve & verify existing SpeakingPractice owner before loading audio or evaluating
  const { practice: existingPractice, responses: existingResponses } =
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
  }

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

  // 1b. If not yet loaded from storage, check if this is an existing session retry (resolve server-side)
  if (!isAudioPersisted && existingPractice && existingResponses.length > 0) {
    const existingStorageKey = existingResponses[0].storageKey;
    if (existingStorageKey) {
      if (
        !isSpeakingAudioStorageKeyOwnedBy(
          existingStorageKey,
          authenticatedUserId,
          sessionId
        )
      ) {
        throw new ForbiddenError(
          "Cannot retry evaluation using audio outside the session namespace."
        );
      }
      const audioData = await getSpeakingAudioBuffer(existingStorageKey);
      if (audioData && audioData.buffer && audioData.buffer.length > 0) {
        audioBuffer = audioData.buffer;
        effectiveMimeType = audioData.mimeType;
        effectiveStorageKey = existingStorageKey;
        isAudioPersisted = true;
      }
    }
  }

  // 1c. If not yet persisted, resolve audioBuffer from audioBase64 and durably persist it
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

  // 1d. Final invariant validation: must be truly persisted and non-null
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
  const existingEvidence = existingPractice?.evidenceJson as
    | {
        turnMarkers?: CandidateTurnMarkerInput[];
        liveTranscript?: string;
      }
    | undefined;

  const effectiveTopicTitle =
    input.topicTitle || existingPractice?.topicTitle || topicTitle;

  const effectiveCandidateName =
    candidateName || existingPractice?.candidateName || "Học viên";

  const effectiveTurnMarkers =
    typedTurnMarkers.length > 0
      ? typedTurnMarkers
      : existingEvidence?.turnMarkers || [];

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
      : existingEvidence?.liveTranscript || "";

  const effectiveDuration =
    input.durationSeconds ||
    existingPractice?.durationSeconds ||
    durationSeconds;

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

  // STEP B: Run AI evaluation (PracticeEvaluation)
  let practiceResult = null;
  let evaluationError: string | null = null;

  try {
    practiceResult = await evaluateSpeakingPracticePart1({
      practiceId: sessionId,
      topicTitle: effectiveTopicTitle,
      questions: part1Questions,
      audioBuffer,
      audioBase64: !audioBuffer ? audioBase64 : undefined,
      mimeType: effectiveMimeType,
      durationSeconds: effectiveDuration,
      liveTranscript: userTranscripts,
      turnMarkers: effectiveTurnMarkers,
    });
  } catch (evalErr) {
    evaluationError =
      (evalErr as Error)?.message ||
      "Practice AI evaluation failed to complete";
    console.error(
      "[finishSpeakingPractice] Practice AI evaluation failed:",
      evaluationError
    );
  }

  // STEP C: If AI evaluation failed, practice remains 'completed' with error recorded
  if (!practiceResult) {
    const failedEvidence = {
      turnMarkers: effectiveTurnMarkers,
      liveTranscript: userTranscripts,
      evaluationStatus: "failed",
      evaluationError,
    };

    await speakingPracticeRepository.markEvaluationFailed({
      sessionId,
      userId: authenticatedUserId,
      failedEvidence,
    });

    return {
      success: false,
      isPractice: true,
      practiceMode: "part_1",
      error: "EVALUATION_FAILED",
      message: evaluationError,
      sessionId,
      status: "completed",
      httpStatus: 502,
    };
  }

  // STEP D: If AI evaluation succeeded, transition Practice to 'evaluated'
  try {
    await speakingPracticeRepository.markEvaluated({
      sessionId,
      userId: authenticatedUserId,
      scorecardJson: practiceResult.practiceFeedback,
      evidenceJson: {
        transcripts: practiceResult.transcripts,
        trace: practiceResult.trace,
      },
      verifiedTranscript: practiceResult.transcripts.bestTranscript || null,
    });
  } catch (markErr) {
    console.error(
      "[finishSpeakingPractice] Failed to mark practice as evaluated:",
      markErr
    );
    return {
      success: false,
      isPractice: true,
      practiceMode: "part_1",
      sessionId,
      error: "PRACTICE_PERSISTENCE_FAILED",
      message: "Failed to update evaluated practice feedback in database.",
      httpStatus: 500,
    };
  }

  return {
    success: true,
    isPractice: true,
    practiceMode: "part_1",
    result: practiceResult.practiceFeedback,
    transcripts: practiceResult.transcripts,
    trace: practiceResult.trace,
    sessionId,
    httpStatus: 200,
  };
}
