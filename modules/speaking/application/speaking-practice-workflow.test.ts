import { describe, it, expect, mock } from "bun:test";
import {
  finishSpeakingPracticeWorkflow,
  retrySpeakingPracticeEvaluationWorkflow,
  retrySpeakingAudioUploadWorkflow,
  SpeakingPracticeWorkflowPorts,
  SpeakingPracticeAudioPayload,
} from "./speaking-practice-workflow";
import type {
  PracticeFeedback,
  SpeakingEvaluationTrace,
} from "@/lib/gemini/speaking-schema";

const mockFeedback: PracticeFeedback = {
  evidenceScope: {
    mode: "part_1",
    responseCount: 1,
  },
  estimatedPerformance: {
    fluencyAndCoherence: 6.5,
    lexicalResource: 6.5,
    grammaticalRangeAndAccuracy: 6.5,
    pronunciation: 6.5,
  },
  strengths: [
    {
      criterion: "FC",
      observation: "Good fluency and speech rate",
    },
  ],
  priorities: [
    {
      criterion: "LR",
      observation: "Use a wider range of connectors",
    },
  ],
  summary: "Solid Part 1 performance with good conversational flow.",
  evidenceSufficiency: "sufficient_for_practice_feedback",
};

const mockTrace: SpeakingEvaluationTrace = {
  modelUsed: "gemini-3.7-flash",
  isFallback: false,
  fallbackReason: null,
  durationMs: 1200,
  tokensUsed: { promptTokens: 100, candidatesTokens: 150, totalTokens: 250 },
  keyFingerprint: "test-fingerprint",
  timestamp: "2026-09-04T12:00:00.000Z",
};

function createMockAudio(
  sizeBytes = 1024,
  durationSeconds = 45
): SpeakingPracticeAudioPayload {
  const buffer = new Uint8Array(sizeBytes);
  return {
    blob: new Blob([buffer], { type: "audio/webm;codecs=opus" }),
    durationSeconds,
    mimeType: "audio/webm;codecs=opus",
  };
}

describe("SpeakingPractice Workflow Orchestration Application Seam (#81)", () => {
  it("Critical Seam 1: valid audio persists, practice ends, evaluation succeeds", async () => {
    const mockPersist = mock(async () => ({
      storageKey: "speaking/u1/ses_1/candidate.webm",
      audioBase64: "bW9ja0F1ZGlv",
    }));
    const mockEvaluate = mock(async () => ({
      success: true,
      isPractice: true,
      result: mockFeedback,
      trace: mockTrace,
    }));
    const mockRecordedTelemetry = mock(() => {});
    const mockSubmittedTelemetry = mock(() => {});
    const mockReadyTelemetry = mock(() => {});
    const mockSaveIdentity = mock(() => {});

    const ports: SpeakingPracticeWorkflowPorts = {
      persistAudio: mockPersist,
      evaluatePractice: mockEvaluate,
      saveSessionIdentity: mockSaveIdentity,
      telemetry: {
        onAudioRecorded: mockRecordedTelemetry,
        onSubmittedForFeedback: mockSubmittedTelemetry,
        onFeedbackReady: mockReadyTelemetry,
      },
    };

    const audio = createMockAudio();
    const outcome = await finishSpeakingPracticeWorkflow(
      {
        sessionId: "ses_1",
        candidateName: "Nguyễn Văn A",
        topicTitle: "Holidays",
        audio,
        questions: ["Where do you like to travel?"],
      },
      ports
    );

    expect(outcome.status).toBe("feedback_ready");
    if (outcome.status === "feedback_ready") {
      expect(outcome.sessionId).toBe("ses_1");
      expect(outcome.practiceEnded).toBe(true);
      expect(outcome.feedback.estimatedPerformance?.fluencyAndCoherence).toBe(
        6.5
      );
      expect(outcome.trace?.modelUsed).toBe("gemini-3.7-flash");
    }

    expect(mockPersist).toHaveBeenCalledTimes(1);
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
    expect(mockSaveIdentity).toHaveBeenCalledWith("ses_1");
    expect(mockRecordedTelemetry).toHaveBeenCalledTimes(1);
    expect(mockSubmittedTelemetry).toHaveBeenCalledTimes(1);
    expect(mockReadyTelemetry).toHaveBeenCalledTimes(1);
  });

  it("Critical Seam 2: valid audio persists, practice ends, evaluation fails (PracticeEnded != PracticeEvaluated)", async () => {
    const mockPersist = mock(async () => ({
      storageKey: "speaking/u1/ses_2/candidate.webm",
    }));
    const mockEvaluate = mock(async () => ({
      success: false,
      error: "AI_TIMEOUT",
      message: "504 Gateway Timeout during LLM evaluation",
    }));

    const ports: SpeakingPracticeWorkflowPorts = {
      persistAudio: mockPersist,
      evaluatePractice: mockEvaluate,
    };

    const audio = createMockAudio();
    const outcome = await finishSpeakingPracticeWorkflow(
      {
        sessionId: "ses_2",
        candidateName: "Nguyễn Văn B",
        audio,
      },
      ports
    );

    expect(outcome.status).toBe("evaluation_failed");
    if (outcome.status === "evaluation_failed") {
      expect(outcome.sessionId).toBe("ses_2");
      // Domain Invariant: Evaluation failure preserves ended practice validity!
      expect(outcome.practiceEnded).toBe(true);
      expect(outcome.canRetry).toBe(true);
      expect(outcome.error).toContain("504 Gateway Timeout");
    }

    expect(mockPersist).toHaveBeenCalledTimes(1);
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
  });

  it("Critical Seam 3: audio persistence fails -> practice is not committed, evaluation is not triggered", async () => {
    const mockPersist = mock(async () => {
      throw new Error("Network connection dropped: S3 bucket unreachable");
    });
    const mockEvaluate = mock(async () => ({
      success: true,
      result: mockFeedback,
    }));

    const ports: SpeakingPracticeWorkflowPorts = {
      persistAudio: mockPersist,
      evaluatePractice: mockEvaluate,
    };

    const audio = createMockAudio();
    const outcome = await finishSpeakingPracticeWorkflow(
      {
        sessionId: "ses_3",
        audio,
      },
      ports
    );

    expect(outcome.status).toBe("audio_persistence_failed");
    if (outcome.status === "audio_persistence_failed") {
      expect(outcome.sessionId).toBe("ses_3");
      expect(outcome.error).toContain("Không thể tải tệp âm thanh");
    }

    // Critical Invariant: Practice must NOT be committed or evaluated if audio persistence failed!
    expect(mockPersist).toHaveBeenCalledTimes(1);
    expect(mockEvaluate).toHaveBeenCalledTimes(0);
  });

  it("Critical Seam 4: empty audio -> no evaluation request, dispatches audio error telemetry", async () => {
    const mockPersist = mock(async () => ({ storageKey: "key" }));
    const mockEvaluate = mock(async () => ({
      success: true,
      result: mockFeedback,
    }));
    const mockAudioErrorTelemetry = mock(() => {});

    const ports: SpeakingPracticeWorkflowPorts = {
      persistAudio: mockPersist,
      evaluatePractice: mockEvaluate,
      telemetry: {
        onAudioError: mockAudioErrorTelemetry,
      },
    };

    // Case 1: Audio is null
    const outcomeNull = await finishSpeakingPracticeWorkflow(
      {
        sessionId: "ses_4a",
        audio: null,
      },
      ports
    );

    expect(outcomeNull.status).toBe("audio_missing");
    expect(mockAudioErrorTelemetry).toHaveBeenCalledWith(
      "ses_4a",
      "EMPTY_AUDIO_RECORDING",
      expect.stringContaining("0 bytes")
    );
    expect(mockPersist).toHaveBeenCalledTimes(0);
    expect(mockEvaluate).toHaveBeenCalledTimes(0);

    // Case 2: Audio blob size is 0 bytes
    const emptyAudio: SpeakingPracticeAudioPayload = {
      blob: new Blob([], { type: "audio/webm" }),
      durationSeconds: 0,
      mimeType: "audio/webm",
    };

    const outcomeZero = await finishSpeakingPracticeWorkflow(
      {
        sessionId: "ses_4b",
        audio: emptyAudio,
      },
      ports
    );

    expect(outcomeZero.status).toBe("audio_missing");
    expect(mockPersist).toHaveBeenCalledTimes(0);
    expect(mockEvaluate).toHaveBeenCalledTimes(0);
  });

  it("Critical Seam 5: retryable evaluation failure preserves same practice id and audio reference", async () => {
    let evaluateCount = 0;
    const mockEvaluate = mock(async (payload) => {
      evaluateCount++;
      // Verify payload retains same sessionId and storageKey
      expect(payload.sessionId).toBe("ses_5");
      expect(payload.storageKey).toBe("speaking/u1/ses_5/candidate.webm");

      if (evaluateCount === 1) {
        return {
          success: false,
          error: "503_OVERLOADED",
          message: "The model is overloaded. AI evaluation failed.",
        };
      }
      return {
        success: true,
        isPractice: true,
        result: mockFeedback,
      };
    });

    const ports: SpeakingPracticeWorkflowPorts = {
      persistAudio: mock(async () => ({ storageKey: "unused" })),
      evaluatePractice: mockEvaluate,
    };

    // First retry attempt fails
    const firstRetry = await retrySpeakingPracticeEvaluationWorkflow(
      {
        sessionId: "ses_5",
        storageKey: "speaking/u1/ses_5/candidate.webm",
        part1Question: "Tell me about your hometown",
      },
      ports
    );

    expect(firstRetry.status).toBe("evaluation_failed");
    if (firstRetry.status === "evaluation_failed") {
      expect(firstRetry.sessionId).toBe("ses_5");
      expect(firstRetry.practiceEnded).toBe(true);
      expect(firstRetry.canRetry).toBe(true);
    }

    // Second retry attempt succeeds using the same session and audio reference
    const secondRetry = await retrySpeakingPracticeEvaluationWorkflow(
      {
        sessionId: "ses_5",
        storageKey: "speaking/u1/ses_5/candidate.webm",
        part1Question: "Tell me about your hometown",
      },
      ports
    );

    expect(secondRetry.status).toBe("feedback_ready");
    if (secondRetry.status === "feedback_ready") {
      expect(secondRetry.sessionId).toBe("ses_5");
      expect(secondRetry.practiceEnded).toBe(true);
      expect(
        secondRetry.feedback.estimatedPerformance?.fluencyAndCoherence
      ).toBe(6.5);
    }

    expect(mockEvaluate).toHaveBeenCalledTimes(2);
  });

  it("Critical Seam 5b: retry evaluation denies retry when authoritative OriginalAudio is missing", async () => {
    const mockEvaluate = mock(async () => ({
      success: true,
      result: mockFeedback,
    }));
    const ports: SpeakingPracticeWorkflowPorts = {
      persistAudio: mock(async () => ({})),
      evaluatePractice: mockEvaluate,
    };

    const outcome = await retrySpeakingPracticeEvaluationWorkflow(
      {
        sessionId: "ses_missing_audio",
        // Both storageKey and audioBase64 omitted
      },
      ports
    );

    expect(outcome.status).toBe("evaluation_failed");
    if (outcome.status === "evaluation_failed") {
      expect(outcome.canRetry).toBe(false);
      expect(outcome.error).toContain("thiếu bản thu âm gốc");
    }
    expect(mockEvaluate).toHaveBeenCalledTimes(0);
  });

  it("Critical Seam 6: telemetry failure does not alter workflow outcome", async () => {
    const mockPersist = mock(async () => ({
      storageKey: "speaking/u1/ses_6/candidate.webm",
    }));
    const mockEvaluate = mock(async () => ({
      success: true,
      isPractice: true,
      result: mockFeedback,
    }));

    // Telemetry observers throw errors (e.g. adblocker, network failure)
    const brokenTelemetry = {
      onAudioRecorded: mock(() => {
        throw new Error("Telemetry DNS error");
      }),
      onSubmittedForFeedback: mock(() => {
        throw new Error("Telemetry blocked by client");
      }),
      onFeedbackReady: mock(() => {
        throw new Error("Telemetry network timeout");
      }),
    };

    const ports: SpeakingPracticeWorkflowPorts = {
      persistAudio: mockPersist,
      evaluatePractice: mockEvaluate,
      telemetry: brokenTelemetry,
    };

    const audio = createMockAudio();
    const outcome = await finishSpeakingPracticeWorkflow(
      {
        sessionId: "ses_6",
        audio,
      },
      ports
    );

    // Workflow succeeds smoothly despite telemetry failures
    expect(outcome.status).toBe("feedback_ready");
    if (outcome.status === "feedback_ready") {
      expect(outcome.practiceEnded).toBe(true);
      expect(outcome.feedback.estimatedPerformance?.fluencyAndCoherence).toBe(
        6.5
      );
    }
    expect(mockPersist).toHaveBeenCalledTimes(1);
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
  });

  it("Retry Audio Upload: fails when persistence fails, succeeds and evaluates when retried successfully", async () => {
    let persistAttempt = 0;
    const mockPersist = mock(async () => {
      persistAttempt++;
      if (persistAttempt === 1) {
        throw new Error("Temporary network timeout");
      }
      return { storageKey: "speaking/u1/ses_retry/candidate.webm" };
    });

    const mockEvaluate = mock(async () => ({
      success: true,
      isPractice: true,
      result: mockFeedback,
    }));

    const ports: SpeakingPracticeWorkflowPorts = {
      persistAudio: mockPersist,
      evaluatePractice: mockEvaluate,
    };

    const audio = createMockAudio();

    // 1. First upload retry fails
    const failOutcome = await retrySpeakingAudioUploadWorkflow(
      {
        sessionId: "ses_retry",
        audio,
      },
      ports
    );

    expect(failOutcome.status).toBe("audio_persistence_failed");
    expect(mockEvaluate).toHaveBeenCalledTimes(0);

    // 2. Second upload retry succeeds and automatically runs evaluation
    const successOutcome = await retrySpeakingAudioUploadWorkflow(
      {
        sessionId: "ses_retry",
        audio,
      },
      ports
    );

    expect(successOutcome.status).toBe("feedback_ready");
    if (successOutcome.status === "feedback_ready") {
      expect(successOutcome.practiceEnded).toBe(true);
      expect(
        successOutcome.feedback.estimatedPerformance?.fluencyAndCoherence
      ).toBe(6.5);
    }
    expect(mockEvaluate).toHaveBeenCalledTimes(1);
  });
});
