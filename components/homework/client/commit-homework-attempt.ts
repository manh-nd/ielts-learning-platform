import type {
  HomeworkSubmission,
  SubmissionAttempt,
  AudioResponseClip,
} from "@/modules/homework/domain/homework-types";
import {
  dispatchHomeworkSubmitted,
  dispatchHomeworkResubmitted,
  dispatchHomeworkSubmitConflictRejected,
} from "@/lib/telemetry/telemetry-client";

export interface CommitHomeworkAttemptClip {
  blob?: Blob;
  durationSeconds: number;
  storageKey?: string;
}

export interface CommitHomeworkAttemptPrompt {
  promptId: string;
  partNumber?: number;
}

export interface CommitHomeworkAttemptOptions {
  assignmentId: string;
  prompts: CommitHomeworkAttemptPrompt[];
  recordedClips: Record<string, CommitHomeworkAttemptClip>;
  mockMode?: boolean;
  currentAttemptNumber?: number;
  fetchFn?: typeof fetch;
}

export type CommitHomeworkAttemptResult =
  | {
      kind: "committed";
      submission: HomeworkSubmission;
      attempt: SubmissionAttempt;
      uploadedStorageKeys: Record<string, string>;
    }
  | {
      kind: "conflict_locked";
      message: string;
      uploadedStorageKeys?: Record<string, string>;
    }
  | {
      kind: "incomplete";
      missingPromptCount: number;
      uploadedStorageKeys?: Record<string, string>;
    }
  | {
      kind: "upload_failed";
      message: string;
      uploadedStorageKeys?: Record<string, string>;
    }
  | {
      kind: "rejected";
      message: string;
      uploadedStorageKeys?: Record<string, string>;
    };

/**
 * Orchestrates committing a Learner Homework attempt.
 *
 * Invariants:
 * - Incomplete recordings return an explicit "incomplete" outcome without calling network.
 * - Reuses existing storageKey when present; skips presign and PUT.
 * - When mockMode is active, generates mock storageKey and bypasses presign and PUT.
 * - StorageKey-only clips without Blob are preserved with positive audioBytes fallback.
 * - Upload failure halts the workflow and never calls the submit endpoint.
 * - Concurrency lock (HTTP 409) maps to "conflict_locked".
 * - General HTTP non-ok or validation failure maps to "rejected".
 * - Telemetry is best-effort and failures never affect the outcome.
 */
export async function commitHomeworkAttempt(
  options: CommitHomeworkAttemptOptions
): Promise<CommitHomeworkAttemptResult> {
  const {
    assignmentId,
    prompts,
    recordedClips,
    mockMode = false,
    currentAttemptNumber,
    fetchFn,
  } = options;

  const fetchImpl = fetchFn ?? globalThis.fetch;

  // 1. Validate complete local recording set
  const missingPrompts = prompts.filter((p) => !recordedClips[p.promptId]);
  if (missingPrompts.length > 0) {
    return {
      kind: "incomplete",
      missingPromptCount: missingPrompts.length,
    };
  }

  const uploadedStorageKeys: Record<string, string> = {};
  const audioResponses: AudioResponseClip[] = [];

  // 2. Resolve storageKey for each prompt (uploading if needed)
  for (const prompt of prompts) {
    const clip = recordedClips[prompt.promptId];
    let storageKey = clip?.storageKey;

    if (!storageKey && mockMode) {
      storageKey = `homework/mock_learner/${assignmentId}/${prompt.promptId}/response.webm`;
      uploadedStorageKeys[prompt.promptId] = storageKey;
    } else if (!storageKey && clip?.blob) {
      try {
        const isWav = clip.blob.type?.includes("wav");
        const ext = isWav ? "wav" : "webm";
        const mimeType = isWav
          ? "audio/wav"
          : clip.blob.type || "audio/webm;codecs=opus";

        const uploadUrlRes = await fetchImpl(
          `/api/learner/assignments/${assignmentId}/upload-url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              promptId: prompt.promptId,
              filename: `${prompt.promptId}.${ext}`,
              mimeType,
            }),
          }
        );

        if (!uploadUrlRes.ok) {
          const errData = (await uploadUrlRes.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          const message =
            errData.error?.message ||
            `Không thể tạo URL tải lên cho câu hỏi (${uploadUrlRes.status})`;
          return {
            kind: "upload_failed",
            message,
            uploadedStorageKeys,
          };
        }

        const uploadData = (await uploadUrlRes.json()) as {
          uploadUrl: string;
          storageKey: string;
        };

        storageKey = uploadData.storageKey;

        const putRes = await fetchImpl(uploadData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": mimeType,
          },
          body: clip.blob,
        });

        if (!putRes.ok) {
          return {
            kind: "upload_failed",
            message: `Lỗi khi tải file âm thanh lên hệ thống lưu trữ (${putRes.status}).`,
            uploadedStorageKeys,
          };
        }

        uploadedStorageKeys[prompt.promptId] = storageKey;
      } catch (err: unknown) {
        return {
          kind: "upload_failed",
          message:
            (err as Error)?.message ||
            "Lỗi khi tải file âm thanh lên hệ thống lưu trữ.",
          uploadedStorageKeys,
        };
      }
    }

    if (!storageKey) {
      return {
        kind: "upload_failed",
        message: `Thiếu file âm thanh cho câu hỏi Part ${prompt.partNumber ?? ""}.`,
        uploadedStorageKeys,
      };
    }

    audioResponses.push({
      promptId: prompt.promptId,
      storageKey,
      durationMs: Math.round(clip.durationSeconds * 1000),
      audioBytes: clip.blob?.size || 45000,
    });
  }

  // 3. Post submission attempt
  let submitRes: Response;
  try {
    submitRes = await fetchImpl(
      `/api/learner/assignments/${assignmentId}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioResponses }),
      }
    );
  } catch (err: unknown) {
    return {
      kind: "rejected",
      message:
        (err as Error)?.message || "Đã xảy ra lỗi không xác định khi nộp bài.",
      uploadedStorageKeys,
    };
  }

  if (submitRes.status === 409) {
    const conflictData = (await submitRes.json().catch(() => ({}))) as {
      error?: { message?: string };
    };

    try {
      await dispatchHomeworkSubmitConflictRejected(
        assignmentId,
        currentAttemptNumber || 1
      );
    } catch {
      // Non-blocking telemetry
    }

    return {
      kind: "conflict_locked",
      message:
        conflictData.error?.message ||
        "Bài làm đã được Giáo viên tiếp nhận chấm điểm, không thể nộp lại.",
      uploadedStorageKeys,
    };
  }

  if (!submitRes.ok) {
    const errData = (await submitRes.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    return {
      kind: "rejected",
      message:
        errData.error?.message || `Lỗi khi nộp bài (${submitRes.status})`,
      uploadedStorageKeys,
    };
  }

  const data = (await submitRes.json().catch(() => ({}))) as {
    success?: boolean;
    submission?: HomeworkSubmission;
    attempt?: SubmissionAttempt;
  };

  if (!data || !data.submission || !data.attempt) {
    return {
      kind: "rejected",
      message: "Dữ liệu trả về từ máy chủ không hợp lệ.",
      uploadedStorageKeys,
    };
  }

  try {
    if (data.submission.currentAttemptNumber > 1) {
      await dispatchHomeworkResubmitted(
        assignmentId,
        data.submission.id,
        data.submission.currentAttemptNumber
      );
    } else {
      await dispatchHomeworkSubmitted(
        assignmentId,
        data.submission.id,
        data.submission.currentAttemptNumber
      );
    }
  } catch {
    // Non-blocking telemetry
  }

  return {
    kind: "committed",
    submission: data.submission,
    attempt: data.attempt,
    uploadedStorageKeys,
  };
}
