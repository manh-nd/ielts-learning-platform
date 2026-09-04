import { CANONICAL_SPEAKING_PRACTICE_SCOPE } from "../domain";
import type {
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";

/**
 * Pure application outcome union for SpeakingPractice finish & evaluation workflow.
 * Encapsulates explicit business/application meaning without leaking transport bags.
 */
export type SpeakingPracticeWorkflowOutcome =
  | {
      status: "audio_missing";
      sessionId: string;
      error: string;
    }
  | {
      status: "audio_persistence_failed";
      sessionId: string;
      error: string;
    }
  | {
      status: "feedback_ready";
      sessionId: string;
      practiceEnded: true;
      feedback: PracticeFeedback;
      trace?: SpeakingEvaluationTrace;
    }
  | {
      status: "evaluation_failed";
      sessionId: string;
      practiceEnded: true;
      error: string;
      canRetry: boolean;
    };

/**
 * Audio payload contract passed across boundaries without depending on presentation types.
 */
export interface SpeakingPracticeAudioPayload {
  blob: Blob;
  durationSeconds?: number;
  mimeType?: string;
}

export interface SpeakingPracticeTelemetryObserver {
  onAudioRecorded?: (
    sessionId: string,
    durationMs: number,
    bytes: number,
    metadata: Record<string, unknown>
  ) => void | Promise<unknown>;
  onSubmittedForFeedback?: (
    sessionId: string,
    metadata: Record<string, unknown>
  ) => void | Promise<unknown>;
  onFeedbackReady?: (
    sessionId: string,
    durationMs: number,
    metadata: Record<string, unknown>
  ) => void | Promise<unknown>;
  onAudioError?: (
    sessionId: string,
    code: string,
    message: string
  ) => void | Promise<unknown>;
}

/**
 * Outbound ports contract for SpeakingPractice workflow orchestration.
 * Implemented by infrastructure adapters (e.g. browser adapter or test mocks).
 */
export interface SpeakingPracticeWorkflowPorts {
  persistAudio: (
    sessionId: string,
    audio: SpeakingPracticeAudioPayload
  ) => Promise<{ storageKey?: string; audioBase64?: string }>;
  evaluatePractice: (payload: {
    sessionId: string;
    topicTitle?: string;
    candidateName?: string;
    practiceMode: "part_1";
    targetPart: "part_1";
    questions?: string[];
    part1Question?: string;
    transcripts?: Array<{ sender: string; text: string; timestamp?: number }>;
    turnMarkers?: unknown[];
    storageKey?: string;
    audioBase64?: string;
    durationSeconds?: number;
  }) => Promise<{
    success: boolean;
    isPractice?: boolean;
    result?: PracticeFeedback;
    trace?: SpeakingEvaluationTrace;
    error?: string;
    message?: string;
    status?: string;
  }>;
  saveSessionIdentity?: (sessionId: string) => void;
  telemetry?: SpeakingPracticeTelemetryObserver;
}

/**
 * Telemetry observer errors must never alter workflow outcome.
 */
async function safeTelemetryCall(fn?: () => unknown | Promise<unknown>) {
  if (!fn) return;
  try {
    await fn();
  } catch (err) {
    console.warn("[SpeakingPracticeWorkflow] Telemetry observer error:", err);
  }
}

export interface FinishSpeakingPracticeWorkflowInput {
  sessionId: string;
  candidateName?: string;
  topicTitle?: string;
  questions?: string[];
  part1Question?: string;
  transcripts?: Array<{ sender: string; text: string; timestamp?: number }>;
  turnMarkers?: unknown[];
  audio: SpeakingPracticeAudioPayload | null;
  persistedStorageKey?: string;
  persistedAudioBase64?: string;
  durationSeconds?: number;
}

/**
 * Orchestrates finishing a Speaking Practice session:
 * 1. Validates audio presence (empty audio -> no evaluation request).
 * 2. Observes telemetry (non-blocking).
 * 3. Persists authoritative OriginalAudio (persistence failure -> practice not committed).
 * 4. Saves session identity for recovery.
 * 5. Requests PracticeEvaluation.
 * 6. Maps result to explicit application outcome (PracticeEnded != PracticeEvaluated).
 */
export async function finishSpeakingPracticeWorkflow(
  input: FinishSpeakingPracticeWorkflowInput,
  ports: SpeakingPracticeWorkflowPorts
): Promise<SpeakingPracticeWorkflowOutcome> {
  const {
    sessionId,
    candidateName = "Học viên",
    topicTitle = "General IELTS Speaking Practice",
    questions,
    part1Question = "Part 1 Introduction and Interview",
    transcripts = [],
    turnMarkers = [],
    audio,
    persistedStorageKey,
    persistedAudioBase64,
    durationSeconds,
  } = input;

  const hasValidBlob = Boolean(audio?.blob && audio.blob.size > 0);
  const hasExistingAudio = Boolean(persistedStorageKey || persistedAudioBase64);

  // 1. Invariant: Empty audio -> no evaluation request
  if (!hasValidBlob && !hasExistingAudio) {
    await safeTelemetryCall(() =>
      ports.telemetry?.onAudioError?.(
        sessionId,
        "EMPTY_AUDIO_RECORDING",
        "Chưa ghi nhận được âm thanh từ microphone (0 bytes)."
      )
    );
    return {
      status: "audio_missing",
      sessionId,
      error:
        "Chưa ghi nhận được âm thanh từ microphone. Vui lòng nói vào microphone trước khi nộp bài.",
    };
  }

  // 2. Telemetry: Audio recorded observation
  if (hasValidBlob && audio?.blob) {
    const durationMs = Math.round(
      (audio.durationSeconds || durationSeconds || 0) * 1000
    );
    await safeTelemetryCall(() =>
      ports.telemetry?.onAudioRecorded?.(
        sessionId,
        durationMs,
        audio.blob.size,
        {
          mime_type: audio.mimeType || "audio/webm;codecs=opus",
          turn_count: turnMarkers.length,
        }
      )
    );
  }

  let resolvedStorageKey = persistedStorageKey;
  let resolvedAudioBase64 = persistedAudioBase64;

  // 3. Audio persistence: OriginalAudio must be durably persisted before practice is committed
  if (hasValidBlob && audio && !resolvedStorageKey) {
    try {
      const persisted = await ports.persistAudio(sessionId, audio);
      resolvedStorageKey = persisted.storageKey || resolvedStorageKey;
      resolvedAudioBase64 = persisted.audioBase64 || resolvedAudioBase64;
    } catch (uploadErr) {
      console.warn(
        "[SpeakingPracticeWorkflow] Audio persistence failed:",
        uploadErr
      );
      return {
        status: "audio_persistence_failed",
        sessionId,
        error:
          "Không thể tải tệp âm thanh lên máy chủ do lỗi kết nối mạng. Bản thu âm của bạn vẫn được bảo toàn trong bộ nhớ.",
      };
    }
  }

  // 4. Save session identity for refresh recovery
  ports.saveSessionIdentity?.(sessionId);

  // 5. Evaluate practice
  const evalStartTime = Date.now();
  await safeTelemetryCall(() =>
    ports.telemetry?.onSubmittedForFeedback?.(sessionId, {
      target_part: CANONICAL_SPEAKING_PRACTICE_SCOPE,
    })
  );

  const payload = {
    sessionId,
    topicTitle,
    candidateName,
    practiceMode: CANONICAL_SPEAKING_PRACTICE_SCOPE,
    targetPart: CANONICAL_SPEAKING_PRACTICE_SCOPE,
    questions: questions && questions.length > 0 ? questions : undefined,
    part1Question,
    transcripts: transcripts.map((t) => ({
      sender: t.sender,
      text: t.text,
      timestamp: t.timestamp,
    })),
    turnMarkers,
    storageKey: resolvedStorageKey,
    audioBase64: resolvedAudioBase64,
    durationSeconds: durationSeconds || audio?.durationSeconds || 120,
  };

  try {
    const data = await ports.evaluatePractice(payload);
    if (!data.success) {
      throw new Error(data.message || data.error || "Lỗi khi chấm điểm.");
    }

    const evalDurationMs = Date.now() - evalStartTime;
    await safeTelemetryCall(() =>
      ports.telemetry?.onFeedbackReady?.(sessionId, evalDurationMs, {
        is_practice: true,
      })
    );

    return {
      status: "feedback_ready",
      sessionId,
      practiceEnded: true,
      feedback: data.result as PracticeFeedback,
      trace: data.trace,
    };
  } catch (err) {
    const errorMessage =
      (err as Error)?.message || "Không thể thực hiện chấm điểm tự động.";
    console.error("[SpeakingPracticeWorkflow] Evaluation failed:", err);

    // Canonical Invariant: PracticeEnded != PracticeEvaluated
    // Audio was durably persisted, so the practice has ended successfully.
    // Evaluation failure preserves the ended practice and permits retry.
    return {
      status: "evaluation_failed",
      sessionId,
      practiceEnded: true,
      error: errorMessage,
      canRetry: true,
    };
  }
}

export interface RetrySpeakingPracticeEvaluationInput {
  sessionId: string;
  candidateName?: string;
  topicTitle?: string;
  questions?: string[];
  part1Question?: string;
  transcripts?: Array<{ sender: string; text: string; timestamp?: number }>;
  turnMarkers?: unknown[];
  storageKey?: string;
  audioBase64?: string;
  durationSeconds?: number;
}

/**
 * Retries evaluation for an ended SpeakingPractice reusing existing OriginalAudio.
 */
export async function retrySpeakingPracticeEvaluationWorkflow(
  input: RetrySpeakingPracticeEvaluationInput,
  ports: SpeakingPracticeWorkflowPorts
): Promise<SpeakingPracticeWorkflowOutcome> {
  const {
    sessionId,
    candidateName = "Học viên",
    topicTitle = "General IELTS Speaking Practice",
    questions,
    part1Question = "Part 1 Introduction and Interview",
    transcripts = [],
    turnMarkers = [],
    storageKey,
    audioBase64,
    durationSeconds = 120,
  } = input;

  if (!storageKey && !audioBase64) {
    return {
      status: "evaluation_failed",
      sessionId,
      practiceEnded: true,
      error: "Không đủ điều kiện thử lại chấm điểm do thiếu bản thu âm gốc.",
      canRetry: false,
    };
  }

  const evalStartTime = Date.now();
  await safeTelemetryCall(() =>
    ports.telemetry?.onSubmittedForFeedback?.(sessionId, {
      target_part: CANONICAL_SPEAKING_PRACTICE_SCOPE,
      is_retry: true,
    })
  );

  const payload = {
    sessionId,
    topicTitle,
    candidateName,
    practiceMode: CANONICAL_SPEAKING_PRACTICE_SCOPE,
    targetPart: CANONICAL_SPEAKING_PRACTICE_SCOPE,
    questions: questions && questions.length > 0 ? questions : undefined,
    part1Question,
    transcripts: transcripts.map((t) => ({
      sender: t.sender,
      text: t.text,
      timestamp: t.timestamp,
    })),
    turnMarkers,
    storageKey,
    audioBase64,
    durationSeconds,
  };

  try {
    const data = await ports.evaluatePractice(payload);
    if (!data.success) {
      throw new Error(data.message || data.error || "Lỗi khi chấm điểm.");
    }

    const evalDurationMs = Date.now() - evalStartTime;
    await safeTelemetryCall(() =>
      ports.telemetry?.onFeedbackReady?.(sessionId, evalDurationMs, {
        is_practice: true,
        is_retry: true,
      })
    );

    return {
      status: "feedback_ready",
      sessionId,
      practiceEnded: true,
      feedback: data.result as PracticeFeedback,
      trace: data.trace,
    };
  } catch (err) {
    const errorMessage =
      (err as Error)?.message || "Không thể thực hiện chấm điểm tự động.";
    console.error("[SpeakingPracticeWorkflow] Retry evaluation failed:", err);

    return {
      status: "evaluation_failed",
      sessionId,
      practiceEnded: true,
      error: errorMessage,
      canRetry: true,
    };
  }
}

export interface RetrySpeakingAudioUploadInput {
  sessionId: string;
  audio: SpeakingPracticeAudioPayload;
  candidateName?: string;
  topicTitle?: string;
  questions?: string[];
  part1Question?: string;
  transcripts?: Array<{ sender: string; text: string; timestamp?: number }>;
  turnMarkers?: unknown[];
  audioBase64?: string;
}

/**
 * Retries audio upload when initial storage persistence failed, then continues with practice finish.
 */
export async function retrySpeakingAudioUploadWorkflow(
  input: RetrySpeakingAudioUploadInput,
  ports: SpeakingPracticeWorkflowPorts
): Promise<SpeakingPracticeWorkflowOutcome> {
  const { sessionId, audio, audioBase64 } = input;

  let storageKey: string | undefined;
  let resolvedBase64 = audioBase64;

  try {
    const persisted = await ports.persistAudio(sessionId, audio);
    storageKey = persisted.storageKey;
    resolvedBase64 = persisted.audioBase64 || resolvedBase64;
  } catch (err) {
    console.error("[SpeakingPracticeWorkflow] Retry upload failed:", err);
    return {
      status: "audio_persistence_failed",
      sessionId,
      error:
        "Tải lên lại vẫn thất bại do gián đoạn kết nối mạng. Vui lòng kiểm tra đường truyền và thử lại.",
    };
  }

  // Once audio is durably persisted, proceed with finish workflow
  return finishSpeakingPracticeWorkflow(
    {
      ...input,
      audio,
      persistedStorageKey: storageKey,
      persistedAudioBase64: resolvedBase64,
      durationSeconds: audio.durationSeconds,
    },
    ports
  );
}
