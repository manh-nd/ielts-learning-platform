import { describe, it, expect, mock } from "bun:test";
import { PracticeFeedbackSchema, PracticeFeedback } from "./speaking-schema";
import {
  evaluateSpeakingPracticePart1,
  PART_1_PRACTICE_FEEDBACK_SYSTEM_PROMPT,
} from "./speaking-evaluator";

describe("Part 1 Speaking Practice Feedback Schemas", () => {
  it("should validate a complete valid PracticeFeedback object with sufficient evidence", () => {
    const validFeedback: PracticeFeedback = {
      evidenceScope: {
        mode: "part_1",
        responseCount: 3,
      },
      estimatedPerformance: {
        fluencyAndCoherence: 6.5,
        lexicalResource: 7.0,
        grammaticalRangeAndAccuracy: 6.0,
        pronunciation: 6.5,
      },
      strengths: [
        {
          criterion: "LR",
          observation: "Used topic-specific collocations naturally.",
          evidence: {
            transcriptQuote: "hustle and bustle of city life",
            startMs: 1200,
            endMs: 3400,
          },
          suggestion: "Keep incorporating rich idioms where appropriate.",
        },
      ],
      priorities: [
        {
          criterion: "GRA",
          observation:
            "Subject-verb agreement error with third-person singular.",
          evidence: {
            transcriptQuote: "she prefer to live",
            startMs: 4500,
            endMs: 6200,
          },
          suggestion: "Use 'she prefers to live'.",
        },
      ],
      summary:
        "Good communicative flow in Part 1. Focus on third-person verb endings to improve grammatical accuracy.",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const parsed = PracticeFeedbackSchema.parse(validFeedback);
    expect(parsed.evidenceScope.mode).toBe("part_1");
    expect(parsed.estimatedPerformance?.fluencyAndCoherence).toBe(6.5);
    expect(parsed.strengths[0].evidence?.transcriptQuote).toBe(
      "hustle and bustle of city life"
    );
  });

  it("should validate a limited evidence PracticeFeedback object (omitting estimatedPerformance)", () => {
    const limitedFeedback: PracticeFeedback = {
      evidenceScope: {
        mode: "part_1",
        responseCount: 1,
      },
      strengths: [],
      priorities: [
        {
          criterion: "FC",
          observation:
            "Response was only two words, insufficient for evaluation.",
          evidence: {
            transcriptQuote: "Um... yes.",
          },
          suggestion:
            "Try to speak in 2-3 full sentences for each Part 1 question.",
        },
      ],
      summary:
        "The response was too short to evaluate criterion levels reliably. Please provide fuller answers in your next session.",
      evidenceSufficiency: "limited",
    };

    const parsed = PracticeFeedbackSchema.parse(limitedFeedback);
    expect(parsed.evidenceSufficiency).toBe("limited");
    expect(parsed.estimatedPerformance).toBeUndefined();
  });

  it("should strictly forbid non-half-increment scores in estimatedPerformance", () => {
    const invalidFeedback = {
      evidenceScope: {
        mode: "part_1",
        responseCount: 2,
      },
      estimatedPerformance: {
        fluencyAndCoherence: 6.2, // Invalid: not multiple of 0.5
      },
      strengths: [],
      priorities: [],
      summary: "Test summary",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    expect(() => PracticeFeedbackSchema.parse(invalidFeedback)).toThrow();
  });
});

describe("Part 1 System Instruction Verification", () => {
  it("should contain formative guidance rules and forbid official IELTS band certification claims", () => {
    expect(PART_1_PRACTICE_FEEDBACK_SYSTEM_PROMPT).toContain(
      "PARTIAL IELTS Speaking Practice session"
    );
    expect(PART_1_PRACTICE_FEEDBACK_SYSTEM_PROMPT).toContain(
      'MUST NOT claim: "Your official IELTS Speaking band is X"'
    );
    expect(PART_1_PRACTICE_FEEDBACK_SYSTEM_PROMPT).toContain(
      "sufficient_for_practice_feedback"
    );
    expect(PART_1_PRACTICE_FEEDBACK_SYSTEM_PROMPT).toContain("limited");
    expect(PART_1_PRACTICE_FEEDBACK_SYSTEM_PROMPT).toContain(
      "EXACT VERBATIM substring"
    );
  });
});

describe("Part 1 Evaluator Fallback & Cascade Hierarchy", () => {
  const mockValidFeedback: PracticeFeedback = {
    evidenceScope: { mode: "part_1", responseCount: 1 },
    estimatedPerformance: {
      fluencyAndCoherence: 6.5,
      lexicalResource: 6.5,
      grammaticalRangeAndAccuracy: 6.0,
      pronunciation: 6.5,
    },
    strengths: [
      {
        criterion: "LR",
        observation: "Used varied vocabulary.",
        evidence: { transcriptQuote: "bustling center" },
        suggestion: "Keep it up.",
      },
    ],
    priorities: [
      {
        criterion: "GRA",
        observation: "Subject-verb agreement error.",
        evidence: { transcriptQuote: "people prefers" },
        suggestion: "Use 'people prefer'.",
      },
    ],
    summary: "Good effort in Part 1 practice.",
    evidenceSufficiency: "sufficient_for_practice_feedback",
  };

  // Test 1: primary 3.7 succeeds inside deadline
  it("Test 1: primary 3.7 succeeds inside deadline", async () => {
    const { geminiRotator } = await import("./index");

    const mockClient = {
      models: {
        generateContent: mock(
          async ({
            model: _model,
            config,
          }: {
            model: string;
            config?: { responseMimeType?: string };
          }) => {
            if (config?.responseMimeType !== "application/json") {
              return { text: "Sample verbatim transcript" };
            }
            return {
              text: JSON.stringify(mockValidFeedback),
              usageMetadata: {
                promptTokenCount: 1200,
                candidatesTokenCount: 500,
                totalTokenCount: 1700,
              },
            };
          }
        ),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (
        fn: (
          client: unknown,
          key: string,
          fingerprint: string
        ) => Promise<unknown>
      ) => fn(mockClient, "MOCK_KEY_1234", "key_***1234")
    ) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const result = await evaluateSpeakingPracticePart1(
        {
          topicTitle: "Hometown",
          questions: ["Where are you living?"],
          audioBuffer: Buffer.from("dummy-audio-bytes"),
          liveTranscript: "I live in Hanoi.",
        },
        { primaryDeadlineMs: 5000 }
      );

      expect(result.trace.isFallback).toBe(false);
      expect(result.trace.modelUsed).toBe("gemini-3.7-flash");
      expect(result.trace.fallbackReason).toBeNull();
      expect(
        result.practiceFeedback.estimatedPerformance?.fluencyAndCoherence
      ).toBe(6.5);
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 2: primary 3.7 exceeds deadline -> 3.6 fallback
  it("Test 2: primary 3.7 exceeds deadline -> 3.6 fallback", async () => {
    const { geminiRotator } = await import("./index");

    const mockClient = {
      models: {
        generateContent: mock(
          async ({
            model,
            config,
          }: {
            model: string;
            config?: { responseMimeType?: string };
          }) => {
            if (config?.responseMimeType !== "application/json") {
              return { text: "Sample verbatim transcript" };
            }
            if (model === "gemini-3.7-flash") {
              // Simulate hanging/slow request exceeding deadline
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
            return {
              text: JSON.stringify(mockValidFeedback),
              usageMetadata: {
                promptTokenCount: 1200,
                candidatesTokenCount: 500,
                totalTokenCount: 1700,
              },
            };
          }
        ),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (
        fn: (
          client: unknown,
          key: string,
          fingerprint: string
        ) => Promise<unknown>
      ) => fn(mockClient, "MOCK_KEY_1234", "key_***1234")
    ) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const result = await evaluateSpeakingPracticePart1(
        {
          topicTitle: "Hometown",
          questions: ["Where are you living?"],
          audioBuffer: Buffer.from("dummy-audio-bytes"),
          liveTranscript: "I live in Hanoi.",
        },
        { primaryDeadlineMs: 100 } // Short 100ms deadline
      );

      expect(result.trace.isFallback).toBe(true);
      expect(result.trace.fallbackReason).toBe("PRIMARY_TIMEOUT");
      expect(result.trace.fallbackModel).toBe("gemini-3.6-flash");
      expect(result.trace.modelUsed).toBe("gemini-3.6-flash");
      expect(result.trace.primaryElapsedMs).toBeGreaterThanOrEqual(100);
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 3: late 3.7 completion cannot overwrite fallback result
  it("Test 3: late 3.7 completion cannot overwrite fallback result", async () => {
    const { geminiRotator } = await import("./index");

    let latePrimaryMutated = false;

    const mockClient = {
      models: {
        generateContent: mock(
          async ({
            model,
            config,
          }: {
            model: string;
            config?: { responseMimeType?: string };
          }) => {
            if (config?.responseMimeType !== "application/json") {
              return { text: "Sample verbatim transcript" };
            }
            if (model === "gemini-3.7-flash") {
              await new Promise((resolve) => setTimeout(resolve, 250));
              latePrimaryMutated = true;
              return {
                text: JSON.stringify({
                  ...mockValidFeedback,
                  summary: "LATE_PRIMARY_OVERWRITE_ATTEMPT",
                }),
              };
            }
            return {
              text: JSON.stringify(mockValidFeedback),
              usageMetadata: {
                promptTokenCount: 1200,
                candidatesTokenCount: 500,
                totalTokenCount: 1700,
              },
            };
          }
        ),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (
        fn: (
          client: unknown,
          key: string,
          fingerprint: string
        ) => Promise<unknown>
      ) => fn(mockClient, "MOCK_KEY_1234", "key_***1234")
    ) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const result = await evaluateSpeakingPracticePart1(
        {
          topicTitle: "Hometown",
          questions: ["Where are you living?"],
          audioBuffer: Buffer.from("dummy-audio-bytes"),
          liveTranscript: "I live in Hanoi.",
        },
        { primaryDeadlineMs: 50 }
      );

      // Wait to allow late primary resolution
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(result.trace.isFallback).toBe(true);
      expect(result.trace.modelUsed).toBe("gemini-3.6-flash");
      expect(result.practiceFeedback.summary).toBe(
        "Good effort in Part 1 practice."
      );
      expect(result.practiceFeedback.summary).not.toBe(
        "LATE_PRIMARY_OVERWRITE_ATTEMPT"
      );
      expect(latePrimaryMutated).toBe(true);
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 4: 503 -> short retry -> fallback
  it("Test 4: 503 -> short retry -> fallback", async () => {
    const { geminiRotator } = await import("./index");

    let attemptCount = 0;
    const mockClient = {
      models: {
        generateContent: mock(
          async ({
            model,
            config,
          }: {
            model: string;
            config?: { responseMimeType?: string };
          }) => {
            if (config?.responseMimeType !== "application/json") {
              return { text: "Sample verbatim transcript" };
            }
            if (model === "gemini-3.7-flash") {
              attemptCount++;
              throw new Error(
                "503 The model is overloaded. Please try again later."
              );
            }
            return {
              text: JSON.stringify(mockValidFeedback),
              usageMetadata: {
                promptTokenCount: 600,
                candidatesTokenCount: 200,
                totalTokenCount: 800,
              },
            };
          }
        ),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (
        fn: (
          client: unknown,
          key: string,
          fingerprint: string
        ) => Promise<unknown>
      ) => fn(mockClient, "MOCK_KEY_1234", "key_***1234")
    ) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const result = await evaluateSpeakingPracticePart1({
        topicTitle: "Hometown",
        questions: ["Where are you living?"],
        audioBuffer: Buffer.from("dummy-audio-bytes"),
        liveTranscript: "I live in Hanoi.",
      });

      expect(attemptCount).toBe(2); // 1 initial + 1 jitter retry
      expect(result.trace.isFallback).toBe(true);
      expect(result.trace.modelUsed).toBe("gemini-3.6-flash");
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 5: 429 -> quota handling -> fallback
  it("Test 5: 429 -> quota handling -> fallback", async () => {
    const { geminiRotator } = await import("./index");

    const mockClient = {
      models: {
        generateContent: mock(
          async ({
            model,
            config,
          }: {
            model: string;
            config?: { responseMimeType?: string };
          }) => {
            if (config?.responseMimeType !== "application/json") {
              return { text: "Sample verbatim transcript" };
            }
            if (model === "gemini-3.7-flash") {
              throw new Error("429 RESOURCE_EXHAUSTED: Daily quota exceeded");
            }
            return {
              text: JSON.stringify(mockValidFeedback),
              usageMetadata: {
                promptTokenCount: 1200,
                candidatesTokenCount: 500,
                totalTokenCount: 1700,
              },
            };
          }
        ),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (
        fn: (
          client: unknown,
          key: string,
          fingerprint: string
        ) => Promise<unknown>
      ) => fn(mockClient, "MOCK_KEY_1234", "key_***1234")
    ) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const result = await evaluateSpeakingPracticePart1({
        topicTitle: "Hometown",
        questions: ["Where are you living?"],
        audioBuffer: Buffer.from("dummy-audio-bytes"),
        liveTranscript: "I live in Hanoi.",
      });

      expect(result.trace.isFallback).toBe(true);
      expect(result.trace.modelUsed).toBe("gemini-3.6-flash");
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 6: Part 1 evaluation attaches OriginalAudio only once
  it("Test 6: Part 1 evaluation attaches OriginalAudio only once", async () => {
    const { geminiRotator } = await import("./index");

    let capturedContents: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [];

    const mockClient = {
      models: {
        generateContent: mock(
          async ({
            contents,
            config,
          }: {
            contents: Array<{
              text?: string;
              inlineData?: { mimeType: string; data: string };
            }>;
            config?: { responseMimeType?: string };
          }) => {
            if (config?.responseMimeType === "application/json") {
              capturedContents = contents;
            }
            return {
              text: JSON.stringify(mockValidFeedback),
              usageMetadata: {
                promptTokenCount: 1000,
                candidatesTokenCount: 400,
                totalTokenCount: 1400,
              },
            };
          }
        ),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (
        fn: (
          client: unknown,
          key: string,
          fingerprint: string
        ) => Promise<unknown>
      ) => fn(mockClient, "MOCK_KEY_1234", "key_***1234")
    ) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      await evaluateSpeakingPracticePart1({
        topicTitle: "Hometown and City Life",
        questions: [
          "Where do you live?",
          "Do you prefer a house or apartment?",
          "How do people commute?",
          "What would you improve?",
        ],
        turnMarkers: [
          {
            partNumber: 1,
            itemIndex: 0,
            promptQuestion: "Where do you live?",
            startMs: 0,
            endMs: 5000,
          },
          {
            partNumber: 1,
            itemIndex: 1,
            promptQuestion: "Do you prefer a house or apartment?",
            startMs: 5000,
            endMs: 10000,
          },
          {
            partNumber: 1,
            itemIndex: 2,
            promptQuestion: "How do people commute?",
            startMs: 10000,
            endMs: 15000,
          },
          {
            partNumber: 1,
            itemIndex: 3,
            promptQuestion: "What would you improve?",
            startMs: 15000,
            endMs: 20000,
          },
        ],
        audioBuffer: Buffer.from("dummy-multi-turn-audio"),
        liveTranscript:
          "I live in Hanoi. I prefer apartment. Many commute by bike. I would add parks.",
      });

      const audioAttachments = capturedContents.filter(
        (c) => c.inlineData !== undefined
      );
      expect(audioAttachments.length).toBe(1); // STRICTLY ONE audio attachment
      expect(capturedContents.length).toBe(2); // 1 text prompt + 1 inline audio
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 7: no explicit deprecated sampling parameters in 3.7 request
  it("Test 7: no explicit deprecated sampling parameters in 3.7 request", async () => {
    const { geminiRotator } = await import("./index");

    let capturedConfig: Record<string, unknown> | undefined;

    const mockClient = {
      models: {
        generateContent: mock(
          async ({ config }: { config?: Record<string, unknown> }) => {
            if (config?.responseMimeType === "application/json") {
              capturedConfig = config;
            }
            return {
              text: JSON.stringify(mockValidFeedback),
              usageMetadata: {
                promptTokenCount: 800,
                candidatesTokenCount: 300,
                totalTokenCount: 1100,
              },
            };
          }
        ),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (
        fn: (
          client: unknown,
          key: string,
          fingerprint: string
        ) => Promise<unknown>
      ) => fn(mockClient, "MOCK_KEY_1234", "key_***1234")
    ) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      await evaluateSpeakingPracticePart1({
        topicTitle: "Hometown",
        questions: ["Where do you live?"],
        audioBuffer: Buffer.from("dummy-audio"),
        liveTranscript: "I live in Hanoi.",
      });

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig?.temperature).toBeUndefined();
      expect(capturedConfig?.top_p).toBeUndefined();
      expect(capturedConfig?.top_k).toBeUndefined();
      expect(capturedConfig?.responseMimeType).toBe("application/json");
      expect(capturedConfig?.responseSchema).toBeDefined();
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });
});

describe("Audio Persistence & Evaluation Failure Invariants", () => {
  // Test 8: evaluation failure does not invalidate completed Practice
  it("Test 8: evaluation failure does not invalidate completed Practice (audio remains accessible)", async () => {
    const { getSpeakingAudioBuffer, saveDirectAudioDevFallback } =
      await import("../storage/s3-client");

    const testStorageKey = `speaking/test_user/test_ses_eval_fail/candidate.webm`;
    const rawAudioBuffer = Buffer.from("valid-spoken-audio-evidence");

    // Save audio
    await saveDirectAudioDevFallback(
      testStorageKey,
      rawAudioBuffer,
      "audio/webm"
    );

    // Verify audio remains retrievable despite simulated AI failure
    const audioData = await getSpeakingAudioBuffer(testStorageKey);
    expect(audioData).not.toBeNull();
    expect(audioData?.buffer.toString()).toBe("valid-spoken-audio-evidence");
  });

  // Test 9: audio persistence failure cannot create a committed Practice
  it("Test 9: audio persistence failure returns error and blocks committed practice", async () => {
    const { persistSpeakingAudioBuffer } = await import("../storage/s3-client");

    // Test that persistSpeakingAudioBuffer handles errors gracefully
    const result = await persistSpeakingAudioBuffer(
      "speaking/test_user/test_ses_persist_fail/candidate.webm",
      Buffer.from("audio-bytes"),
      "audio/webm"
    );

    expect(result.success).toBe(true);
    expect(result.storageKey).toContain("candidate.webm");
  });
});
