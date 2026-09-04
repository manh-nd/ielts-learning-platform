import { speakingPracticeRepository } from "../infrastructure/speaking-practice-repository";
import {
  getSpeakingAudioBuffer,
  isSpeakingAudioStorageKeyOwnedBy,
} from "@/lib/storage/s3-client";
import { evaluateSpeakingPracticePart1 } from "@/lib/gemini/speaking-evaluator";
import type { PracticeFeedback } from "@/lib/gemini/speaking-schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  CANONICAL_SPEAKING_PRACTICE_SCOPE,
  SpeakingPracticeScope,
  SpeakingPracticeStatus,
  PracticeEvaluationStatus,
  checkPracticeEvaluationRetryEligibility,
} from "../domain";

export interface CandidateTurnMarkerInput {
  partNumber: number;
  itemIndex: number;
  promptQuestion: string;
  startMs: number;
  endMs: number;
  liveTranscript?: string;
}

export interface RetryPracticeEvaluationInput {
  authenticatedUserId: string;
  sessionId: string;
  topicTitle?: string;
  candidateName?: string;
  questions?: string[];
  durationSeconds?: number;
  turnMarkers?: CandidateTurnMarkerInput[];
}

export interface PracticeEvaluationExecutionResult {
  success: boolean;
  isPractice: boolean;
  practiceMode: SpeakingPracticeScope;
  result?: PracticeFeedback;
  transcripts?: unknown;
  trace?: unknown;
  sessionId: string;
  error?: string;
  message?: string | null;
  status?: string;
  httpStatus: number;
}

/**
 * Maps persistence representation to pure domain statuses at the application boundary.
 * Legacy persistence 'evaluated' status maps to domain SpeakingPracticeStatus 'completed',
 * since AI evaluation completion is decoupled from practice completion (PracticeEnded != PracticeEvaluated).
 */
export function mapSpeakingPracticePersistenceToDomain(practice: {
  status: string;
  scorecardJson?: unknown;
  evidenceJson?: unknown;
}): {
  practiceStatus: SpeakingPracticeStatus;
  evaluationStatus: PracticeEvaluationStatus;
} {
  const evidence = practice.evidenceJson as
    { evaluationStatus?: string; evaluationError?: string } | undefined;

  let practiceStatus: SpeakingPracticeStatus = "completed";
  if (practice.status === "in_progress") {
    practiceStatus = "in_progress";
  } else if (practice.status === "abandoned") {
    practiceStatus = "abandoned";
  } else if (practice.status === "audio_purged") {
    practiceStatus = "audio_purged";
  } else {
    // DB "completed" and legacy DB "evaluated" both map to domain "completed"
    practiceStatus = "completed";
  }

  let evaluationStatus: PracticeEvaluationStatus = "pending";
  if (practice.status === "evaluated" || practice.scorecardJson) {
    evaluationStatus = "ready";
  } else if (evidence?.evaluationStatus === "failed") {
    evaluationStatus = "failed";
  } else {
    evaluationStatus = "pending";
  }

  return { practiceStatus, evaluationStatus };
}

export interface ExecuteEvaluationParams {
  sessionId: string;
  authenticatedUserId: string;
  topicTitle: string;
  questions: string[];
  audioBuffer: Buffer;
  audioBase64?: string;
  mimeType: string;
  durationSeconds: number;
  liveTranscript: string;
  turnMarkers: CandidateTurnMarkerInput[];
}

/**
 * Shared evaluation lifecycle runner:
 * Runs AI evaluation, persists failure or success, and returns formatted result.
 */
export async function executePracticeEvaluation(
  params: ExecuteEvaluationParams
): Promise<PracticeEvaluationExecutionResult> {
  const {
    sessionId,
    authenticatedUserId,
    topicTitle,
    questions,
    audioBuffer,
    audioBase64,
    mimeType,
    durationSeconds,
    liveTranscript,
    turnMarkers,
  } = params;

  let practiceResult = null;
  let evaluationError: string | null = null;

  try {
    practiceResult = await evaluateSpeakingPracticePart1({
      practiceId: sessionId,
      topicTitle,
      questions,
      audioBuffer,
      audioBase64: !audioBuffer ? audioBase64 : undefined,
      mimeType,
      durationSeconds,
      liveTranscript,
      turnMarkers,
    });
  } catch (evalErr) {
    evaluationError =
      (evalErr as Error)?.message ||
      "Practice AI evaluation failed to complete";
    console.error(
      "[executePracticeEvaluation] Practice AI evaluation failed:",
      evaluationError
    );
  }

  if (!practiceResult) {
    const failedEvidence = {
      turnMarkers,
      liveTranscript,
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
      practiceMode: CANONICAL_SPEAKING_PRACTICE_SCOPE,
      error: "EVALUATION_FAILED",
      message: evaluationError,
      sessionId,
      status: "completed",
      httpStatus: 502,
    };
  }

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
      "[executePracticeEvaluation] Failed to mark practice as evaluated:",
      markErr
    );
    return {
      success: false,
      isPractice: true,
      practiceMode: CANONICAL_SPEAKING_PRACTICE_SCOPE,
      sessionId,
      error: "PRACTICE_PERSISTENCE_FAILED",
      message: "Failed to update evaluated practice feedback in database.",
      httpStatus: 500,
    };
  }

  return {
    success: true,
    isPractice: true,
    practiceMode: CANONICAL_SPEAKING_PRACTICE_SCOPE,
    result: practiceResult.practiceFeedback,
    transcripts: practiceResult.transcripts,
    trace: practiceResult.trace,
    sessionId,
    httpStatus: 200,
  };
}

/**
 * Retries AI evaluation on an existing, owned SpeakingPractice using its persisted immutable OriginalAudio.
 * Never creates a second Practice.
 */
export async function retryPracticeEvaluation(
  input: RetryPracticeEvaluationInput
): Promise<PracticeEvaluationExecutionResult> {
  const {
    authenticatedUserId,
    sessionId,
    topicTitle,
    questions,
    durationSeconds,
    turnMarkers = [],
  } = input;

  // 1. Resolve existing practice by sessionId
  const { practice: existingPractice, responses } =
    await speakingPracticeRepository.findById(sessionId);

  if (!existingPractice) {
    throw new NotFoundError("Session not found");
  }

  // 2. Enforce strict learner ownership
  if (
    !existingPractice.userId ||
    existingPractice.userId !== authenticatedUserId
  ) {
    throw new ForbiddenError(
      "Cannot retry, mutate, or access a speaking practice belonging to another user."
    );
  }

  // 3. Resolve existing persisted OriginalAudio from response
  const existingResponse = responses[0];
  const existingStorageKey = existingResponse?.storageKey;

  if (
    existingStorageKey &&
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

  const audioData = existingStorageKey
    ? await getSpeakingAudioBuffer(existingStorageKey)
    : null;

  const hasAuthoritativeOriginalAudio = Boolean(
    existingStorageKey &&
    audioData &&
    audioData.buffer &&
    audioData.buffer.length > 0
  );

  // 4. Enforce domain retry policy at application boundary
  const { practiceStatus, evaluationStatus } =
    mapSpeakingPracticePersistenceToDomain(existingPractice);

  const retryEligibility = checkPracticeEvaluationRetryEligibility({
    practiceStatus,
    evaluationStatus,
    hasAuthoritativeOriginalAudio,
  });

  if (!retryEligibility.eligible) {
    if (retryEligibility.reason === "AUDIO_UNAVAILABLE") {
      return {
        success: false,
        isPractice: true,
        practiceMode: CANONICAL_SPEAKING_PRACTICE_SCOPE,
        sessionId,
        error: "ORIGINAL_AUDIO_MISSING",
        message:
          "OriginalAudio evidence is missing or unverified. Cannot evaluate practice.",
        httpStatus: 400,
      };
    }
    if (retryEligibility.reason === "EVALUATION_PENDING") {
      return {
        success: false,
        isPractice: true,
        practiceMode: CANONICAL_SPEAKING_PRACTICE_SCOPE,
        sessionId,
        error: "EVALUATION_PENDING",
        message:
          "An evaluation is already in progress. Please wait for it to complete.",
        httpStatus: 409,
      };
    }
    if (retryEligibility.reason === "EVALUATION_ALREADY_READY") {
      return {
        success: false,
        isPractice: true,
        practiceMode: CANONICAL_SPEAKING_PRACTICE_SCOPE,
        sessionId,
        error: "EVALUATION_ALREADY_COMPLETED",
        message:
          "Practice evaluation is already complete and feedback is available.",
        httpStatus: 400,
      };
    }
    return {
      success: false,
      isPractice: true,
      practiceMode: CANONICAL_SPEAKING_PRACTICE_SCOPE,
      sessionId,
      error: retryEligibility.reason || "RETRY_NOT_PERMITTED",
      message:
        "Speaking practice evaluation cannot be retried in its current state.",
      httpStatus: 400,
    };
  }

  // At this point, audioData is guaranteed non-null with valid buffer by the policy
  const verifiedAudioData = audioData!;

  // 4. Resolve fallback metadata from existing evidence
  const existingEvidence = existingPractice.evidenceJson as
    | {
        turnMarkers?: CandidateTurnMarkerInput[];
        liveTranscript?: string;
      }
    | undefined;

  const effectiveTurnMarkers =
    turnMarkers.length > 0 ? turnMarkers : existingEvidence?.turnMarkers || [];

  const effectiveTopicTitle =
    topicTitle || existingPractice.topicTitle || "IELTS Speaking Practice";

  const effectiveQuestions: string[] =
    questions ||
    (effectiveTurnMarkers.length > 0
      ? effectiveTurnMarkers.map(
          (m: CandidateTurnMarkerInput) => m.promptQuestion
        )
      : [effectiveTopicTitle]);

  const effectiveDuration =
    durationSeconds || existingPractice.durationSeconds || 60;
  const userTranscripts = existingEvidence?.liveTranscript || "";

  // 5. Execute PracticeEvaluation with same immutable OriginalAudio
  return executePracticeEvaluation({
    sessionId,
    authenticatedUserId,
    topicTitle: effectiveTopicTitle,
    questions: effectiveQuestions,
    audioBuffer: verifiedAudioData.buffer,
    mimeType: verifiedAudioData.mimeType,
    durationSeconds: effectiveDuration,
    liveTranscript: userTranscripts,
    turnMarkers: effectiveTurnMarkers,
  });
}
