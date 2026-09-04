import type {
  TelemetryEventName,
  TelemetryContextType,
} from "@/modules/telemetry/domain/telemetry-types";

export interface DispatchTelemetryOptions {
  eventName: TelemetryEventName;
  contextType: TelemetryContextType;
  contextId?: string | null;
  durationMs?: number | null;
  properties?: Record<string, unknown> | null;
}

export interface DispatchTelemetryResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Dispatches a structured telemetry event to POST /api/telemetry/events.
 * INVARIANT: Non-blocking & fire-and-forget. Failures are caught and logged,
 * never throwing an exception that interrupts learner practice or grading.
 */
export async function dispatchTelemetryEvent(
  options: DispatchTelemetryOptions
): Promise<DispatchTelemetryResult> {
  try {
    const payload = {
      eventName: options.eventName,
      contextType: options.contextType,
      contextId: options.contextId ?? null,
      durationMs:
        typeof options.durationMs === "number"
          ? Math.round(options.durationMs)
          : null,
      properties: options.properties || {},
    };

    const res = await fetch("/api/telemetry/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(
        `[TelemetryClient] Server responded with status ${res.status}: ${errText}`
      );
      return { success: false, error: `HTTP_${res.status}` };
    }

    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      eventId?: string;
    };

    return {
      success: true,
      eventId: data.eventId,
    };
  } catch (err: unknown) {
    console.warn("[TelemetryClient] Non-blocking dispatch failure:", err);
    return {
      success: false,
      error: (err as Error)?.message || "Unknown client network error",
    };
  }
}

/**
 * Speaking Practice Specific Event Dispatchers (§7.2)
 */

export function dispatchPracticeStarted(
  sessionId: string,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "practice_started",
    contextType: "practice",
    contextId: sessionId,
    properties,
  });
}

export function dispatchPracticeAudioRecorded(
  sessionId: string,
  durationMs: number,
  audioBytes: number,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "practice_audio_recorded",
    contextType: "practice",
    contextId: sessionId,
    durationMs,
    properties: {
      audio_bytes: audioBytes,
      ...properties,
    },
  });
}

export function dispatchPracticeSubmittedForFeedback(
  sessionId: string,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "practice_submitted_for_feedback",
    contextType: "practice",
    contextId: sessionId,
    properties,
  });
}

export function dispatchPracticeFeedbackReady(
  sessionId: string,
  durationMs: number,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "practice_feedback_ready",
    contextType: "practice",
    contextId: sessionId,
    durationMs,
    properties,
  });
}

export function dispatchPracticeAgainStarted(
  sessionId: string,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "practice_again_started",
    contextType: "practice",
    contextId: sessionId,
    properties,
  });
}

export function dispatchPracticeAudioError(
  sessionId: string,
  errorCode: string,
  errorMessage?: string,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "practice_audio_error",
    contextType: "practice",
    contextId: sessionId,
    properties: {
      error_code: errorCode,
      error_message: errorMessage,
      ...properties,
    },
  });
}

/**
 * Speaking Homework Specific Event Dispatchers (§7.2)
 */

export function dispatchHomeworkViewed(
  assignmentId: string,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "homework_viewed",
    contextType: "homework",
    contextId: assignmentId,
    properties,
  });
}

export function dispatchHomeworkRecordCompleted(
  assignmentId: string,
  promptId: string,
  durationMs: number,
  audioBytes: number,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "homework_record_completed",
    contextType: "homework",
    contextId: assignmentId,
    durationMs,
    properties: {
      prompt_id: promptId,
      audio_bytes: audioBytes,
      ...properties,
    },
  });
}

export function dispatchHomeworkSubmitted(
  assignmentId: string,
  submissionId: string,
  attemptNumber: number,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "homework_submitted",
    contextType: "homework",
    contextId: assignmentId,
    properties: {
      submission_id: submissionId,
      attempt_number: attemptNumber,
      ...properties,
    },
  });
}

export function dispatchHomeworkResubmitted(
  assignmentId: string,
  submissionId: string,
  attemptNumber: number,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "homework_resubmitted",
    contextType: "homework",
    contextId: assignmentId,
    properties: {
      submission_id: submissionId,
      attempt_number: attemptNumber,
      ...properties,
    },
  });
}

export function dispatchHomeworkSubmitConflictRejected(
  assignmentId: string,
  attemptNumber: number,
  properties?: Record<string, unknown>
): Promise<DispatchTelemetryResult> {
  return dispatchTelemetryEvent({
    eventName: "homework_submit_conflict_rejected",
    contextType: "homework",
    contextId: assignmentId,
    properties: {
      attempt_number: attemptNumber,
      ...properties,
    },
  });
}
