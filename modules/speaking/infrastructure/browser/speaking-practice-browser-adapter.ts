import type {
  SpeakingPracticeAudioPayload,
  SpeakingPracticeWorkflowPorts,
} from "../../application/speaking-practice-workflow";
import {
  dispatchPracticeAudioRecorded,
  dispatchPracticeSubmittedForFeedback,
  dispatchPracticeFeedbackReady,
  dispatchPracticeAudioError,
} from "@/lib/telemetry/telemetry-client";

export const ACTIVE_SPEAKING_SESSION_STORAGE_KEY =
  "ielts_active_speaking_session_id";

/**
 * Reads a Blob as a Base64 string fallback.
 */
export async function convertBlobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const res = reader.result as string;
        const commaIndex = res.indexOf(",");
        resolve(commaIndex !== -1 ? res.slice(commaIndex + 1) : res);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  if (
    typeof (blob as unknown as { arrayBuffer?: () => Promise<ArrayBuffer> })
      .arrayBuffer === "function"
  ) {
    const buffer = Buffer.from(await blob.arrayBuffer());
    return buffer.toString("base64");
  }

  return "";
}

/**
 * Uploads audio blob to storage with exponential backoff and retry.
 */
export async function uploadAudioWithRetry(
  sessionId: string,
  blob: Blob,
  mimeType: string,
  maxRetries = 2
): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, attempt === 1 ? 500 : 1500));
    }
    try {
      const uploadUrlRes = await fetch("/api/speaking/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          filename: "candidate.webm",
          mimeType,
        }),
      });
      if (!uploadUrlRes.ok) {
        throw new Error(`Upload URL request failed (${uploadUrlRes.status})`);
      }
      const uploadInfo = (await uploadUrlRes.json()) as {
        uploadUrl: string;
        storageKey: string;
      };
      const putRes = await fetch(uploadInfo.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });
      if (!putRes.ok) {
        throw new Error(`Storage PUT failed (${putRes.status})`);
      }
      return uploadInfo.storageKey;
    } catch (err) {
      lastErr = err;
      console.warn(
        `[SpeakingPracticeBrowserAdapter] Audio upload attempt ${attempt + 1} failed:`,
        err
      );
    }
  }
  throw lastErr;
}

/**
 * Creates browser ports for SpeakingPractice workflow orchestration.
 */
export function createSpeakingPracticeBrowserPorts(): SpeakingPracticeWorkflowPorts {
  return {
    persistAudio: async (
      sessionId: string,
      audio: SpeakingPracticeAudioPayload
    ) => {
      let audioBase64: string | undefined;
      try {
        audioBase64 = await convertBlobToBase64(audio.blob);
      } catch (err) {
        console.warn(
          "[SpeakingPracticeBrowserAdapter] Base64 conversion failed:",
          err
        );
      }

      const storageKey = await uploadAudioWithRetry(
        sessionId,
        audio.blob,
        audio.mimeType || "audio/webm;codecs=opus",
        2
      );

      return { storageKey, audioBase64 };
    },

    evaluatePractice: async (payload) => {
      const res = await fetch("/api/speaking/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errData.error || "EVALUATION_ERROR",
          message: errData.message || `Lỗi khi chấm điểm (${res.status})`,
          status: errData.status,
          httpStatus: res.status,
        };
      }

      return res.json();
    },

    restorePractice: async (sessionId: string) => {
      try {
        const res = await fetch(
          `/api/speaking/evaluate?sessionId=${encodeURIComponent(sessionId)}`
        );
        if (!res.ok) {
          return null;
        }
        const data = await res.json().catch(() => ({}));
        if (data?.success && data?.restoredState) {
          return data.restoredState;
        }
        return null;
      } catch (err) {
        console.warn(
          "[SpeakingPracticeBrowserAdapter] Session restoration error:",
          err
        );
        return null;
      }
    },

    saveSessionIdentity: (sessionId: string) => {
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            ACTIVE_SPEAKING_SESSION_STORAGE_KEY,
            sessionId
          );
          const url = new URL(window.location.href);
          url.searchParams.set("sessionId", sessionId);
          window.history.replaceState(null, "", url.toString());
        } catch (err) {
          console.warn(
            "[SpeakingPracticeBrowserAdapter] Failed to save session identity:",
            err
          );
        }
      }
    },

    telemetry: {
      onAudioRecorded: (sessionId, durationMs, bytes, metadata) => {
        dispatchPracticeAudioRecorded(sessionId, durationMs, bytes, metadata);
      },
      onSubmittedForFeedback: (sessionId, metadata) => {
        dispatchPracticeSubmittedForFeedback(sessionId, metadata);
      },
      onFeedbackReady: (sessionId, durationMs, metadata) => {
        dispatchPracticeFeedbackReady(sessionId, durationMs, metadata);
      },
      onAudioError: (sessionId, code, message) => {
        dispatchPracticeAudioError(sessionId, code, message);
      },
    },
  };
}
