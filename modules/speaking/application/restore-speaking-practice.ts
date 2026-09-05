import { getSpeakingPractice } from "./get-speaking-practice";
import type {
  SpeakingPracticeRecord,
  SpeakingResponseRecord,
} from "../infrastructure/speaking-practice-repository";
import {
  getSpeakingAudioBuffer,
  isSpeakingAudioStorageKeyOwnedBy,
} from "@/lib/storage/s3-client";
import type {
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";
import { mapSpeakingPracticePersistenceToDomain } from "./retry-practice-evaluation";
import {
  checkPracticeEvaluationRetryEligibility,
  isFeedbackAvailable,
} from "../domain";

export type RestoredSpeakingPracticeState =
  | {
      status: "in_progress";
      sessionId: string;
    }
  | {
      status: "ended_evaluating";
      sessionId: string;
    }
  | {
      status: "ended_feedback_ready";
      sessionId: string;
      feedback: PracticeFeedback;
      trace?: SpeakingEvaluationTrace;
    }
  | {
      status: "ended_evaluation_failed_retryable";
      sessionId: string;
      error: string;
      canRetry: true;
    }
  | {
      status: "ended_audio_unavailable";
      sessionId: string;
      error: string;
      canRetry: false;
    };

export interface RestoreSpeakingPracticeInput {
  authenticatedUserId: string;
  sessionId: string;
}

export interface RestoreSpeakingPracticeResult {
  restoredState: RestoredSpeakingPracticeState;
  session: SpeakingPracticeRecord;
  responses: SpeakingResponseRecord[];
}

/**
 * Pure application mapper that maps persistence record and verified audio presence
 * into an explicit application view state using pure domain policies.
 */
export function mapPersistenceToRestoredPracticeState(params: {
  practice: {
    id: string;
    status: string;
    scorecardJson?: unknown;
    evidenceJson?: unknown;
  };
  hasAuthoritativeOriginalAudio: boolean;
}): RestoredSpeakingPracticeState {
  const { practice, hasAuthoritativeOriginalAudio } = params;
  const { practiceStatus, evaluationStatus } =
    mapSpeakingPracticePersistenceToDomain(practice);

  if (practiceStatus === "in_progress") {
    return {
      status: "in_progress",
      sessionId: practice.id,
    };
  }

  if (practiceStatus === "abandoned") {
    return {
      status: "ended_audio_unavailable",
      sessionId: practice.id,
      error: "Phiên luyện tập đã bị hủy bỏ.",
      canRetry: false,
    };
  }

  // Feedback ready
  if (isFeedbackAvailable(evaluationStatus) && practice.scorecardJson) {
    return {
      status: "ended_feedback_ready",
      sessionId: practice.id,
      feedback: practice.scorecardJson as PracticeFeedback,
      trace: (practice.evidenceJson as { trace?: SpeakingEvaluationTrace })
        ?.trace,
    };
  }

  // Ended but evaluation is pending / in flight
  if (evaluationStatus === "pending") {
    return {
      status: "ended_evaluating",
      sessionId: practice.id,
    };
  }

  // Evaluation failed
  if (evaluationStatus === "failed") {
    const retryEligibility = checkPracticeEvaluationRetryEligibility({
      practiceStatus,
      evaluationStatus,
      hasAuthoritativeOriginalAudio,
    });

    const errorMsg =
      (practice.evidenceJson as { evaluationError?: string })
        ?.evaluationError ||
      "Lần phân tích trước bị gián đoạn. Vui lòng bấm thử phân tích lại.";

    if (retryEligibility.eligible) {
      return {
        status: "ended_evaluation_failed_retryable",
        sessionId: practice.id,
        error: errorMsg,
        canRetry: true,
      };
    }

    return {
      status: "ended_audio_unavailable",
      sessionId: practice.id,
      error:
        retryEligibility.reason === "AUDIO_UNAVAILABLE"
          ? "Không tìm thấy hoặc bản thu âm gốc đã hết hạn lưu trữ. Không thể thử lại chấm điểm."
          : errorMsg,
      canRetry: false,
    };
  }

  return {
    status: "ended_audio_unavailable",
    sessionId: practice.id,
    error: "Trạng thái bài thi không hợp lệ.",
    canRetry: false,
  };
}

/**
 * Restores a SpeakingPractice session strictly owned by the authenticated learner:
 * 1. Loads practice and enforces learner ownership via getSpeakingPractice (throws NotFoundError).
 * 2. Resolves and verifies authoritative OriginalAudio in storage.
 * 3. Maps persistence data to an explicit application RestoredSpeakingPracticeState.
 */
export async function restoreSpeakingPractice(
  input: RestoreSpeakingPracticeInput
): Promise<RestoreSpeakingPracticeResult> {
  const { authenticatedUserId, sessionId } = input;

  // 1. Enforce ownership and load practice + responses
  const { session, responses } = await getSpeakingPractice({
    authenticatedUserId,
    sessionId,
  });

  // 2. Resolve and verify authoritative OriginalAudio
  const existingResponse = responses[0];
  const existingStorageKey = existingResponse?.storageKey;

  let hasAuthoritativeOriginalAudio = false;
  if (
    existingStorageKey &&
    session.status !== "audio_purged" &&
    isSpeakingAudioStorageKeyOwnedBy(
      existingStorageKey,
      authenticatedUserId,
      sessionId
    )
  ) {
    const audioData = await getSpeakingAudioBuffer(existingStorageKey);
    hasAuthoritativeOriginalAudio = Boolean(
      audioData && audioData.buffer && audioData.buffer.length > 0
    );
  }

  // 3. Map to explicit application state via domain policies
  const restoredState = mapPersistenceToRestoredPracticeState({
    practice: session,
    hasAuthoritativeOriginalAudio,
  });

  return {
    restoredState,
    session,
    responses,
  };
}
