import { speakingPracticeRepository } from "../infrastructure/speaking-practice-repository";
import {
  getSpeakingAudioBuffer,
  isSpeakingAudioStorageKeyOwnedBy,
} from "@/lib/storage/s3-client";
import { evaluateSpeakingPracticePart1 } from "@/lib/gemini/speaking-evaluator";
import type { PracticeFeedback } from "@/lib/gemini/speaking-schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

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
  practiceMode: "part_1";
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

  if (!existingStorageKey) {
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
  if (!audioData || !audioData.buffer || audioData.buffer.length === 0) {
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
  let practiceResult = null;
  let evaluationError: string | null = null;

  try {
    practiceResult = await evaluateSpeakingPracticePart1({
      practiceId: sessionId,
      topicTitle: effectiveTopicTitle,
      questions: effectiveQuestions,
      audioBuffer: audioData.buffer,
      mimeType: audioData.mimeType,
      durationSeconds: effectiveDuration,
      liveTranscript: userTranscripts,
      turnMarkers: effectiveTurnMarkers,
    });
  } catch (evalErr) {
    evaluationError =
      (evalErr as Error)?.message ||
      "Practice AI evaluation failed to complete";
    console.error(
      "[retryPracticeEvaluation] Practice AI evaluation failed:",
      evaluationError
    );
  }

  // 6. Handle AI evaluation failure: Practice remains 'completed' with error recorded
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

  // 7. Handle AI evaluation success: Transition Practice to 'evaluated'
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
