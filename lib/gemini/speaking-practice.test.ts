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

  // Test 9: Normalizes unrounded LLM scores (e.g. 6.3 -> 6.5, 5.8 -> 6.0) gracefully
  it("Test 9: Normalizes unrounded LLM scores in estimatedPerformance gracefully", async () => {
    const { geminiRotator } = await import("./index");

    const unroundedFeedbackJson = JSON.stringify({
      evidenceScope: { mode: "part_1", responseCount: 4 },
      estimatedPerformance: {
        fluencyAndCoherence: 6.3, // Non-half increment from LLM
        lexicalResource: 5.8, // Non-half increment from LLM
        grammaticalRangeAndAccuracy: 6.25, // Non-half increment from LLM
        pronunciation: "6.7", // String format from LLM
      },
      strengths: [
        {
          criterion: "FC",
          observation: "Spoke smoothly without major pauses.",
        },
      ],
      priorities: [
        {
          criterion: "PR",
          observation: "Work on word endings.",
        },
      ],
      summary: "Good effort in Part 1 practice.",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    });

    const mockClient = {
      models: {
        generateContent: mock(async () => ({
          text: unroundedFeedbackJson,
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
        })),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      (
        fn: (
          client: unknown,
          key: string,
          fingerprint: string
        ) => Promise<unknown>
      ) => fn(mockClient, "MOCK_KEY_1234", "key_***1234")
    ) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const result = await evaluateSpeakingPracticePart1({
        topicTitle: "Hobbies",
        questions: ["What do you do in your free time?"],
        audioBuffer: Buffer.from("dummy-audio"),
        liveTranscript: "I like reading books.",
      });

      expect(result.practiceFeedback.estimatedPerformance).toBeDefined();
      expect(
        result.practiceFeedback.estimatedPerformance?.fluencyAndCoherence
      ).toBe(6.5);
      expect(
        result.practiceFeedback.estimatedPerformance?.lexicalResource
      ).toBe(6.0);
      expect(
        result.practiceFeedback.estimatedPerformance
          ?.grammaticalRangeAndAccuracy
      ).toBe(6.5);
      expect(result.practiceFeedback.estimatedPerformance?.pronunciation).toBe(
        6.5
      );
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });
});

function createMockAuthHeaders(
  user: {
    id: string;
    role: "learner" | "teacher";
    name?: string;
    email?: string;
  } | null = {
    id: "user_123",
    role: "learner",
    name: "Test Learner",
    email: "learner@test.com",
  }
): Headers {
  const headers = new Headers();
  if (user) {
    const session = {
      id: `sess_${user.id}`,
      userId: user.id,
      token: `token_${user.id}`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const payload = JSON.stringify({ user, session });
    headers.set("cookie", `e2e_mock_session=${encodeURIComponent(payload)}`);
  }
  headers.set("content-type", "application/json");
  return headers;
}

describe("Audio Persistence & Evaluation Failure Invariants", () => {
  // Test 8: evaluation failure after persisted audio leaves a committed 'completed' Practice whose storageKey resolves to actual audio bytes
  it("Test 8: evaluation failure leaves committed 'completed' Practice whose storageKey resolves to actual audio bytes", async () => {
    const { POST, GET } = await import("../../app/api/speaking/evaluate/route");
    const { getSpeakingAudioBuffer } = await import("../storage/s3-client");
    const { geminiRotator } = await import("./index");
    const { NextRequest } = await import("next/server");

    const testSessionId = `ses_eval_fail_${Date.now()}`;
    const testStorageKey = `speaking/user_123/${testSessionId}/candidate.webm`;
    const testAudioBase64 = Buffer.from("mock-spoken-audio-bytes").toString(
      "base64"
    );

    // Mock AI evaluation to fail (simulate model unavailable/overloaded)
    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(async () => {
      throw new Error("503 The model is overloaded. AI evaluation failed.");
    }) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const postReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "user_123",
            role: "learner",
            name: "Test Learner",
          }),
          body: JSON.stringify({
            sessionId: testSessionId,
            candidateName: "Test Learner",
            topicTitle: "Part 1 Practice Test",
            practiceMode: "part_1",
            audioBase64: testAudioBase64,
            storageKey: testStorageKey,
            durationSeconds: 45,
            questions: ["Where do you live?"],
            transcripts: [{ sender: "user", text: "I live in Da Nang." }],
          }),
        }
      );

      const postRes = await POST(postReq);
      const postData = await postRes.json();

      // 1. Assert response is 502 with error and status 'completed'
      expect(postRes.status).toBe(502);
      expect(postData.success).toBe(false);
      expect(postData.error).toBe("EVALUATION_FAILED");
      expect(postData.status).toBe("completed");
      expect(postData.sessionId).toBe(testSessionId);

      // 2. Assert Practice remains committed in storage/database as 'completed'
      const getReq = new NextRequest(
        `http://localhost:3000/api/speaking/evaluate?sessionId=${testSessionId}`,
        {
          method: "GET",
          headers: createMockAuthHeaders({
            id: "user_123",
            role: "learner",
            name: "Test Learner",
          }),
        }
      );
      const getRes = await GET(getReq);
      const getData = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getData.success).toBe(true);
      expect(getData.session.id).toBe(testSessionId);
      expect(getData.session.status).toBe("completed");
      expect(getData.session.userId).toBe("user_123");
      expect(getData.session.scorecardJson).toBeNull();
      expect(getData.session.evidenceJson.evaluationStatus).toBe("failed");
      expect(getData.responses.length).toBeGreaterThan(0);
      expect(getData.responses[0].storageKey).toBe(testStorageKey);

      // 3. Assert committed storageKey resolves to actual audio bytes
      const retrievedAudio = await getSpeakingAudioBuffer(testStorageKey);
      expect(retrievedAudio).not.toBeNull();
      expect(retrievedAudio?.buffer.toString()).toBe("mock-spoken-audio-bytes");
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 9: forced audio persistence failure prevents Practice commit and returns AUDIO_PERSISTENCE_FAILED
  it("Test 9: forced audio persistence failure prevents Practice commit and returns AUDIO_PERSISTENCE_FAILED", async () => {
    const { POST, GET } = await import("../../app/api/speaking/evaluate/route");
    const { setSimulatedPersistenceFailure } =
      await import("../storage/s3-client");
    const { NextRequest } = await import("next/server");

    const testSessionId = `ses_persist_fail_${Date.now()}`;
    const testAudioBase64 = Buffer.from("mock-audio-bytes").toString("base64");

    // Enable forced persistence failure
    setSimulatedPersistenceFailure(true);

    try {
      const postReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "user_fail",
            role: "learner",
            name: "Fail Learner",
          }),
          body: JSON.stringify({
            sessionId: testSessionId,
            candidateName: "Fail Learner",
            topicTitle: "Part 1 Practice Test",
            practiceMode: "part_1",
            audioBase64: testAudioBase64, // Direct base64 without pre-persisted storageKey
            durationSeconds: 30,
            questions: ["What is your favorite color?"],
          }),
        }
      );

      const postRes = await POST(postReq);
      const postData = await postRes.json();

      // 1. Assert response is HTTP 500 with AUDIO_PERSISTENCE_FAILED
      expect(postRes.status).toBe(500);
      expect(postData.error).toBe("AUDIO_PERSISTENCE_FAILED");

      // 2. Assert Practice was NOT committed to storage/database (GET returns 404)
      const getReq = new NextRequest(
        `http://localhost:3000/api/speaking/evaluate?sessionId=${testSessionId}`,
        {
          method: "GET",
          headers: createMockAuthHeaders({
            id: "user_fail",
            role: "learner",
            name: "Fail Learner",
          }),
        }
      );
      const getRes = await GET(getReq);
      expect(getRes.status).toBe(404);
    } finally {
      setSimulatedPersistenceFailure(false);
    }
  });

  // Test 10: successful evaluation commits 'completed' then transitions to 'evaluated'
  it("Test 10: successful evaluation commits completed practice and transitions to evaluated", async () => {
    const { POST, GET } = await import("../../app/api/speaking/evaluate/route");
    const { geminiRotator } = await import("./index");
    const { NextRequest } = await import("next/server");

    const testSessionId = `ses_eval_success_${Date.now()}`;
    const testStorageKey = `speaking/user_123/${testSessionId}/candidate.webm`;
    const testAudioBase64 = Buffer.from("mock-spoken-audio-bytes").toString(
      "base64"
    );

    const mockFeedback = {
      evidenceScope: { mode: "part_1", responseCount: 1 },
      estimatedPerformance: {
        fluencyAndCoherence: 7.0,
        lexicalResource: 7.0,
        grammaticalRangeAndAccuracy: 6.5,
        pronunciation: 7.0,
      },
      strengths: [],
      priorities: [],
      summary: "Solid Part 1 responses.",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const mockClient = {
      models: {
        generateContent: mock(
          async ({ config }: { config?: { responseMimeType?: string } }) => {
            if (config?.responseMimeType !== "application/json") {
              return { text: "I live in Da Nang." };
            }
            return {
              text: JSON.stringify(mockFeedback),
              usageMetadata: {
                promptTokenCount: 500,
                candidatesTokenCount: 200,
                totalTokenCount: 700,
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
      const postReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "user_123",
            role: "learner",
            name: "Success Learner",
          }),
          body: JSON.stringify({
            sessionId: testSessionId,
            candidateName: "Success Learner",
            topicTitle: "Part 1 Practice Test",
            practiceMode: "part_1",
            audioBase64: testAudioBase64,
            storageKey: testStorageKey,
            durationSeconds: 45,
            questions: ["Where do you live?"],
            transcripts: [{ sender: "user", text: "I live in Da Nang." }],
          }),
        }
      );

      const postRes = await POST(postReq);
      const postData = await postRes.json();

      expect(postRes.status).toBe(200);
      expect(postData.success).toBe(true);
      expect(postData.isPractice).toBe(true);
      expect(postData.practiceMode).toBe("part_1");
      expect(postData.result.estimatedPerformance.fluencyAndCoherence).toBe(
        7.0
      );

      // Verify DB / storage record transitioned to 'evaluated'
      const getReq = new NextRequest(
        `http://localhost:3000/api/speaking/evaluate?sessionId=${testSessionId}`,
        {
          method: "GET",
          headers: createMockAuthHeaders({
            id: "user_123",
            role: "learner",
            name: "Success Learner",
          }),
        }
      );
      const getRes = await GET(getReq);
      const getData = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getData.session.status).toBe("evaluated");
      expect(getData.session.userId).toBe("user_123");
      expect(getData.session.scorecardJson).toBeDefined();
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 11: phantom storageKey + base64 must actually persist/verify audio before Practice commit
  it("Test 11: phantom storageKey + base64 must actually persist/verify audio before Practice commit", async () => {
    const { POST } = await import("../../app/api/speaking/evaluate/route");
    const { getSpeakingAudioBuffer } = await import("../storage/s3-client");
    const { geminiRotator } = await import("./index");
    const { NextRequest } = await import("next/server");

    const testSessionId = `ses_phantom_${Date.now()}`;
    const phantomStorageKey = `speaking/user_phantom/${testSessionId}/phantom.webm`;
    const testAudioBase64 = Buffer.from("phantom-recovered-audio").toString(
      "base64"
    );

    // Precondition: verify the storageKey does NOT exist prior to API call
    const initialAudio = await getSpeakingAudioBuffer(phantomStorageKey);
    expect(initialAudio).toBeNull();

    const mockFeedback = {
      evidenceScope: { mode: "part_1", responseCount: 1 },
      estimatedPerformance: {
        fluencyAndCoherence: 6.5,
        lexicalResource: 6.5,
        grammaticalRangeAndAccuracy: 6.0,
        pronunciation: 6.5,
      },
      strengths: [],
      priorities: [],
      summary: "Phantom key test feedback.",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const mockClient = {
      models: {
        generateContent: mock(
          async ({ config }: { config?: { responseMimeType?: string } }) => {
            if (config?.responseMimeType !== "application/json") {
              return { text: "I like reading books." };
            }
            return {
              text: JSON.stringify(mockFeedback),
              usageMetadata: {
                promptTokenCount: 500,
                candidatesTokenCount: 200,
                totalTokenCount: 700,
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
      const postReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "user_phantom",
            role: "learner",
            name: "Phantom User",
          }),
          body: JSON.stringify({
            sessionId: testSessionId,
            candidateName: "Phantom User",
            topicTitle: "Phantom Test Topic",
            practiceMode: "part_1",
            storageKey: phantomStorageKey, // unpersisted key
            audioBase64: testAudioBase64,
            durationSeconds: 30,
            questions: ["What is your hobby?"],
          }),
        }
      );

      const postRes = await POST(postReq);
      expect(postRes.status).toBe(200);

      // Postcondition: storageKey was verified and written to storage
      const persistedAudio = await getSpeakingAudioBuffer(phantomStorageKey);
      expect(persistedAudio).not.toBeNull();
      expect(persistedAudio?.buffer.toString()).toBe("phantom-recovered-audio");
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 12: retry evaluation uses same sessionId and persisted OriginalAudio without creating a second Practice
  it("Test 12: retry evaluation reuses same sessionId and persisted OriginalAudio without creating a second Practice", async () => {
    const { POST, GET, devSessionCache } =
      await import("../../app/api/speaking/evaluate/route");
    const { geminiRotator } = await import("./index");
    const { NextRequest } = await import("next/server");

    const testSessionId = `ses_retry_flow_${Date.now()}`;
    const testStorageKey = `speaking/user_retry/${testSessionId}/candidate.webm`;
    const testAudioBase64 = Buffer.from("retry-flow-audio").toString("base64");

    const initialSessionsCount = devSessionCache.size;

    // STEP 1: Initial practice evaluation fails
    let failEvaluation = true;
    const mockFeedback = {
      evidenceScope: { mode: "part_1", responseCount: 1 },
      estimatedPerformance: {
        fluencyAndCoherence: 7.5,
        lexicalResource: 7.0,
        grammaticalRangeAndAccuracy: 7.0,
        pronunciation: 7.5,
      },
      strengths: [],
      priorities: [],
      summary: "Retry success feedback.",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const mockClient = {
      models: {
        generateContent: mock(
          async ({ config }: { config?: { responseMimeType?: string } }) => {
            if (failEvaluation) {
              throw new Error("503 Overloaded on initial try");
            }
            if (config?.responseMimeType !== "application/json") {
              return { text: "I live in Hue." };
            }
            return {
              text: JSON.stringify(mockFeedback),
              usageMetadata: {
                promptTokenCount: 500,
                candidatesTokenCount: 200,
                totalTokenCount: 700,
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
      const initialReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "user_retry",
            role: "learner",
            name: "Retry Candidate",
          }),
          body: JSON.stringify({
            sessionId: testSessionId,
            candidateName: "Retry Candidate",
            topicTitle: "Hometown Topic",
            practiceMode: "part_1",
            audioBase64: testAudioBase64,
            storageKey: testStorageKey,
            durationSeconds: 50,
            questions: ["Tell me about your hometown."],
          }),
        }
      );

      const initialRes = await POST(initialReq);
      expect(initialRes.status).toBe(502);

      // Verify session exists in 'completed' state
      const check1Req = new NextRequest(
        `http://localhost:3000/api/speaking/evaluate?sessionId=${testSessionId}`,
        {
          method: "GET",
          headers: createMockAuthHeaders({
            id: "user_retry",
            role: "learner",
            name: "Retry Candidate",
          }),
        }
      );
      const check1Res = await GET(check1Req);
      const check1Data = await check1Res.json();
      expect(check1Data.session.status).toBe("completed");
      expect(check1Data.session.userId).toBe("user_retry");

      // STEP 2: Retry evaluation - sends SAME sessionId and NO audioBase64 (server resolves persisted OriginalAudio)
      failEvaluation = false;
      const retryReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "user_retry",
            role: "learner",
            name: "Retry Candidate",
          }),
          body: JSON.stringify({
            sessionId: testSessionId, // SAME sessionId
            practiceMode: "part_1",
            // Notice: no audioBase64 provided, server resolves stored audio from existing session
          }),
        }
      );

      const retryRes = await POST(retryReq);
      const retryData = await retryRes.json();

      expect(retryRes.status).toBe(200);
      expect(retryData.success).toBe(true);
      expect(retryData.sessionId).toBe(testSessionId);
      expect(retryData.result.estimatedPerformance.fluencyAndCoherence).toBe(
        7.5
      );

      // Verify session transitioned to 'evaluated'
      const check2Req = new NextRequest(
        `http://localhost:3000/api/speaking/evaluate?sessionId=${testSessionId}`,
        {
          method: "GET",
          headers: createMockAuthHeaders({
            id: "user_retry",
            role: "learner",
            name: "Retry Candidate",
          }),
        }
      );
      const check2Res = await GET(check2Req);
      const check2Data = await check2Res.json();
      expect(check2Data.session.status).toBe("evaluated");
      expect(check2Data.session.userId).toBe("user_retry");
      expect(check2Data.session.scorecardJson).toBeDefined();

      // Verify no second Practice session was created
      expect(devSessionCache.size).toBe(initialSessionsCount + 1);
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 13: Unauthenticated evaluate request is rejected with 401
  it("Test 13: unauthenticated evaluate request is rejected with 401 Unauthorized", async () => {
    const { POST, GET } = await import("../../app/api/speaking/evaluate/route");
    const { NextRequest } = await import("next/server");

    const postReq = new NextRequest(
      "http://localhost:3000/api/speaking/evaluate",
      {
        method: "POST",
        headers: createMockAuthHeaders(null),
        body: JSON.stringify({ sessionId: "ses_unauth" }),
      }
    );
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(401);

    const getReq = new NextRequest(
      "http://localhost:3000/api/speaking/evaluate?sessionId=ses_unauth",
      {
        method: "GET",
        headers: createMockAuthHeaders(null),
      }
    );
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(401);
  });

  // Test 14: Teacher role evaluate request is rejected with 403
  it("Test 14: teacher evaluate request is rejected with 403 Forbidden", async () => {
    const { POST, GET } = await import("../../app/api/speaking/evaluate/route");
    const { NextRequest } = await import("next/server");

    const teacherAuth = {
      id: "teacher_007",
      role: "teacher" as const,
      name: "Teacher Bond",
      email: "teacher@test.com",
    };

    const postReq = new NextRequest(
      "http://localhost:3000/api/speaking/evaluate",
      {
        method: "POST",
        headers: createMockAuthHeaders(teacherAuth),
        body: JSON.stringify({ sessionId: "ses_teacher" }),
      }
    );
    const postRes = await POST(postReq);
    expect(postRes.status).toBe(403);

    const getReq = new NextRequest(
      "http://localhost:3000/api/speaking/evaluate?sessionId=ses_teacher",
      {
        method: "GET",
        headers: createMockAuthHeaders(teacherAuth),
      }
    );
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(403);
  });

  // Test 15: Spoofed userId in evaluation request cannot influence persisted owner
  it("Test 15: spoofed userId in evaluation request cannot influence persisted owner", async () => {
    const { POST, GET } = await import("../../app/api/speaking/evaluate/route");
    const { geminiRotator } = await import("./index");
    const { NextRequest } = await import("next/server");

    const testSessionId = `ses_spoof_${Date.now()}`;
    const testAudioBase64 = Buffer.from("spoof-test-audio").toString("base64");

    const mockFeedback = {
      evidenceScope: { mode: "part_1", responseCount: 1 },
      estimatedPerformance: {
        fluencyAndCoherence: 6.5,
        lexicalResource: 6.5,
        grammaticalRangeAndAccuracy: 6.5,
        pronunciation: 6.5,
      },
      strengths: [],
      priorities: [],
      summary: "Spoof test feedback.",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const mockClient = {
      models: {
        generateContent: mock(async () => ({
          text: JSON.stringify(mockFeedback),
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            totalTokenCount: 150,
          },
        })),
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
      const postReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "real_learner_id",
            role: "learner",
            name: "Real Learner",
          }),
          body: JSON.stringify({
            userId: "victim_admin_id", // Client tries to spoof
            sessionId: testSessionId,
            practiceMode: "part_1",
            audioBase64: testAudioBase64,
            durationSeconds: 30,
            questions: ["Where are you from?"],
          }),
        }
      );

      const postRes = await POST(postReq);
      expect(postRes.status).toBe(200);

      // Verify the session owner is real_learner_id, NOT victim_admin_id
      const getReq = new NextRequest(
        `http://localhost:3000/api/speaking/evaluate?sessionId=${testSessionId}`,
        {
          method: "GET",
          headers: createMockAuthHeaders({
            id: "real_learner_id",
            role: "learner",
            name: "Real Learner",
          }),
        }
      );
      const getRes = await GET(getReq);
      const getData = await getRes.json();
      expect(getData.session.userId).toBe("real_learner_id");
      expect(getData.session.userId).not.toBe("victim_admin_id");
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 16: Learner A GET of Learner B Practice is denied/not found
  it("Test 16: Learner A GET of Learner B Practice returns 404 Not Found", async () => {
    const { POST, GET } = await import("../../app/api/speaking/evaluate/route");
    const { geminiRotator } = await import("./index");
    const { NextRequest } = await import("next/server");

    const testSessionId = `ses_cross_get_${Date.now()}`;
    const testAudioBase64 = Buffer.from("cross-get-audio").toString("base64");

    const mockFeedback = {
      evidenceScope: { mode: "part_1", responseCount: 1 },
      strengths: [],
      priorities: [],
      summary: "Cross GET test.",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const mockClient = {
      models: {
        generateContent: mock(async () => ({
          text: JSON.stringify(mockFeedback),
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            totalTokenCount: 150,
          },
        })),
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
      // Learner B creates and evaluates their session
      const createReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "learner_b",
            role: "learner",
            name: "Learner B",
          }),
          body: JSON.stringify({
            sessionId: testSessionId,
            practiceMode: "part_1",
            audioBase64: testAudioBase64,
            durationSeconds: 30,
            questions: ["Question?"],
          }),
        }
      );
      await POST(createReq);

      // Learner A tries to GET Learner B's session
      const attackerGetReq = new NextRequest(
        `http://localhost:3000/api/speaking/evaluate?sessionId=${testSessionId}`,
        {
          method: "GET",
          headers: createMockAuthHeaders({
            id: "learner_a", // Attacker
            role: "learner",
            name: "Learner A",
          }),
        }
      );
      const attackerGetRes = await GET(attackerGetReq);
      expect(attackerGetRes.status).toBe(404);
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 17: Learner A retry of Learner B Practice is denied before OriginalAudio is loaded
  it("Test 17: Learner A retry of Learner B Practice is denied with 403 Forbidden", async () => {
    const { POST } = await import("../../app/api/speaking/evaluate/route");
    const { geminiRotator } = await import("./index");
    const { NextRequest } = await import("next/server");

    const testSessionId = `ses_cross_retry_${Date.now()}`;
    const testAudioBase64 = Buffer.from("cross-retry-audio").toString("base64");

    // First attempt fails, leaving completed practice for Learner B
    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(async () => {
      throw new Error("503 Overloaded");
    }) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const initialReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "learner_b",
            role: "learner",
            name: "Learner B",
          }),
          body: JSON.stringify({
            sessionId: testSessionId,
            practiceMode: "part_1",
            audioBase64: testAudioBase64,
            durationSeconds: 30,
            questions: ["Question?"],
          }),
        }
      );
      await POST(initialReq);

      // Learner A attempts to trigger retry on Learner B's session
      const attackerRetryReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "learner_a", // Attacker
            role: "learner",
            name: "Learner A",
          }),
          body: JSON.stringify({
            sessionId: testSessionId, // Learner B's session
            practiceMode: "part_1",
          }),
        }
      );
      const attackerRetryRes = await POST(attackerRetryReq);
      expect(attackerRetryRes.status).toBe(403);
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 18: Learner A evaluate request with storageKey belonging to Learner B is denied
  it("Test 18: Learner A evaluate request with storageKey belonging to Learner B is denied with 403", async () => {
    const { POST } = await import("../../app/api/speaking/evaluate/route");
    const { NextRequest } = await import("next/server");

    const postReq = new NextRequest(
      "http://localhost:3000/api/speaking/evaluate",
      {
        method: "POST",
        headers: createMockAuthHeaders({
          id: "learner_a",
          role: "learner",
          name: "Learner A",
        }),
        body: JSON.stringify({
          sessionId: "ses_hijack_123",
          storageKey: "speaking/learner_b/ses_victim/candidate.webm",
          practiceMode: "part_1",
          durationSeconds: 30,
        }),
      }
    );

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(403);
  });

  // Test 19: Learner A cannot hijack Learner B's sessionId by supplying their own storageKey
  it("Test 19: Learner A cannot hijack Learner B's sessionId by supplying their own storageKey", async () => {
    const { POST, devSessionCache } =
      await import("../../app/api/speaking/evaluate/route");
    const { geminiRotator } = await import("./index");
    const { NextRequest } = await import("next/server");
    const { persistSpeakingAudioBuffer } = await import("../storage/s3-client");

    const victimSessionId = `ses_victim_${Date.now()}`;
    const victimStorageKey = `speaking/learner_b/${victimSessionId}/candidate.webm`;
    const victimAudioBase64 = Buffer.from("learner-b-spoken-audio").toString(
      "base64"
    );

    const attackerStorageKey = `speaking/learner_a/ses_attacker_123/candidate.webm`;
    const attackerAudioBytes = Buffer.from("learner-a-exploit-audio");
    await persistSpeakingAudioBuffer(attackerStorageKey, attackerAudioBytes);

    let evaluatorCallCount = 0;
    const mockFeedback = {
      evidenceScope: { mode: "part_1", responseCount: 1 },
      strengths: [],
      priorities: [],
      summary: "Evaluator response",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const mockClient = {
      models: {
        generateContent: mock(async () => {
          evaluatorCallCount++;
          return {
            text: JSON.stringify(mockFeedback),
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 50,
              totalTokenCount: 150,
            },
          };
        }),
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
      // 1. Learner B creates and evaluates their Practice
      const victimReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "learner_b",
            role: "learner",
            name: "Learner B",
          }),
          body: JSON.stringify({
            sessionId: victimSessionId,
            practiceMode: "part_1",
            audioBase64: victimAudioBase64,
            storageKey: victimStorageKey,
            durationSeconds: 40,
            questions: ["What is your favorite book?"],
          }),
        }
      );
      const victimRes = await POST(victimReq);
      expect(victimRes.status).toBe(200);

      const victimOriginalSession = JSON.stringify(
        devSessionCache.get(victimSessionId)
      );
      const baselineEvaluatorCount = evaluatorCallCount;

      // 2. Attacker (Learner A) tries to hijack Learner B's sessionId by providing attacker's valid storageKey
      const hijackReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "learner_a",
            role: "learner",
            name: "Learner A",
          }),
          body: JSON.stringify({
            sessionId: victimSessionId, // Learner B's sessionId
            storageKey: attackerStorageKey, // Valid storageKey owned by Learner A
            practiceMode: "part_1",
            durationSeconds: 30,
          }),
        }
      );
      const hijackRes = await POST(hijackReq);

      // Assert 403 Forbidden
      expect(hijackRes.status).toBe(403);

      // Assert evaluator was NOT called for Learner B's practice
      expect(evaluatorCallCount).toBe(baselineEvaluatorCount);

      // Assert Learner B's session was not mutated
      const victimSessionAfter = JSON.stringify(
        devSessionCache.get(victimSessionId)
      );
      expect(victimSessionAfter).toBe(victimOriginalSession);
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  // Test 20: Legacy Practice with userId = null cannot be claimed by an authenticated Learner
  it("Test 20: Legacy Practice with userId = null cannot be claimed by an authenticated Learner", async () => {
    const { POST, devSessionCache } =
      await import("../../app/api/speaking/evaluate/route");
    const { NextRequest } = await import("next/server");

    const legacySessionId = `ses_legacy_null_${Date.now()}`;

    // Seed in-memory cache with an unclaimed legacy session
    devSessionCache.set(legacySessionId, {
      id: legacySessionId,
      userId: null, // Legacy null owner
      candidateName: "Guest Candidate",
      topicTitle: "Legacy Topic",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 60,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const claimReq = new NextRequest(
      "http://localhost:3000/api/speaking/evaluate",
      {
        method: "POST",
        headers: createMockAuthHeaders({
          id: "learner_claimant",
          role: "learner",
          name: "Learner Claimant",
        }),
        body: JSON.stringify({
          sessionId: legacySessionId,
          practiceMode: "part_1",
          storageKey: `speaking/learner_claimant/${legacySessionId}/candidate.webm`,
        }),
      }
    );

    const claimRes = await POST(claimReq);
    expect(claimRes.status).toBe(403);

    // Verify session was not claimed
    const sessionRecord = devSessionCache.get(legacySessionId);
    expect(sessionRecord?.userId).toBeNull();
  });

  // Test 21: Real UI retry flow re-sending same sessionId + storageKey + audioBase64 delegates to RetryEvaluation
  it("Test 21: Real UI retry flow re-sending same sessionId + storageKey + audioBase64 delegates to RetryEvaluation", async () => {
    const { POST, devSessionCache } =
      await import("../../app/api/speaking/evaluate/route");
    const { geminiRotator } = await import("./index");
    const { NextRequest } = await import("next/server");

    const testSessionId = `ses_ui_retry_${Date.now()}`;
    const testStorageKey = `speaking/user_ui_retry/${testSessionId}/candidate.webm`;
    const originalAudioBase64 =
      Buffer.from("original-ui-audio").toString("base64");
    const reSentAudioBase64 =
      Buffer.from("re-sent-ui-audio").toString("base64");

    let failEvaluation = true;
    let evaluatedAudioContent = "";

    const mockFeedback = {
      evidenceScope: { mode: "part_1", responseCount: 1 },
      estimatedPerformance: {
        fluencyAndCoherence: 8.0,
        lexicalResource: 7.5,
        grammaticalRangeAndAccuracy: 7.5,
        pronunciation: 8.0,
      },
      strengths: [],
      priorities: [],
      summary: "UI retry evaluation succeeded.",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const mockClient = {
      models: {
        generateContent: mock(
          async ({
            contents,
            config,
          }: {
            contents?: Array<{
              inlineData?: { data: string };
              text?: string;
            }>;
            config?: { responseMimeType?: string };
          }) => {
            if (failEvaluation) {
              throw new Error("503 Service Unavailable on first attempt");
            }
            if (contents) {
              for (const c of contents) {
                if (c.inlineData?.data) {
                  evaluatedAudioContent = Buffer.from(
                    c.inlineData.data,
                    "base64"
                  ).toString();
                }
              }
            }
            if (config?.responseMimeType !== "application/json") {
              return { text: "Verbatim candidate response." };
            }
            return {
              text: JSON.stringify(mockFeedback),
              usageMetadata: {
                promptTokenCount: 500,
                candidatesTokenCount: 200,
                totalTokenCount: 700,
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
      // 1. Initial attempt fails
      const initialReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "user_ui_retry",
            role: "learner",
            name: "UI Retry Candidate",
          }),
          body: JSON.stringify({
            sessionId: testSessionId,
            topicTitle: "UI Retry Topic",
            practiceMode: "part_1",
            audioBase64: originalAudioBase64,
            storageKey: testStorageKey,
            durationSeconds: 45,
            questions: ["Tell me about your morning routine."],
          }),
        }
      );

      const initialRes = await POST(initialReq);
      expect(initialRes.status).toBe(502);

      const sessionAfterFail = devSessionCache.get(testSessionId);
      expect(sessionAfterFail?.status).toBe("completed");
      const createdAtBeforeRetry = sessionAfterFail?.createdAt;

      // 2. Real browser retry: re-sends SAME sessionId, SAME storageKey, and audioBase64
      failEvaluation = false;
      const retryReq = new NextRequest(
        "http://localhost:3000/api/speaking/evaluate",
        {
          method: "POST",
          headers: createMockAuthHeaders({
            id: "user_ui_retry",
            role: "learner",
            name: "UI Retry Candidate",
          }),
          body: JSON.stringify({
            sessionId: testSessionId,
            topicTitle: "UI Retry Topic",
            practiceMode: "part_1",
            audioBase64: reSentAudioBase64, // re-sent by UI
            storageKey: testStorageKey, // re-sent by UI
            durationSeconds: 45,
          }),
        }
      );

      const retryRes = await POST(retryReq);
      const retryData = await retryRes.json();

      expect(retryRes.status).toBe(200);
      expect(retryData.success).toBe(true);
      expect(retryData.sessionId).toBe(testSessionId);

      // Verify evaluated audio was the persisted OriginalAudio, NOT re-sent payload
      expect(evaluatedAudioContent).toBe("original-ui-audio");

      // Verify practice was not re-committed/recreated (createdAt preserved, status evaluated)
      const sessionAfterRetry = devSessionCache.get(testSessionId);
      expect(sessionAfterRetry?.status).toBe("evaluated");
      expect(sessionAfterRetry?.createdAt).toEqual(createdAtBeforeRetry);
      expect(sessionAfterRetry?.scorecardJson).toBeDefined();
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });
});
