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
  // Test 8: evaluation failure after persisted audio leaves a committed 'completed' Practice with its storage reference
  it("Test 8: evaluation failure leaves committed 'completed' Practice with storage reference intact", async () => {
    const { POST, GET } = await import("../../app/api/speaking/evaluate/route");
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
          body: JSON.stringify({
            sessionId: testSessionId,
            userId: "user_123",
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
        { method: "GET" }
      );
      const getRes = await GET(getReq);
      const getData = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getData.success).toBe(true);
      expect(getData.session.id).toBe(testSessionId);
      expect(getData.session.status).toBe("completed");
      expect(getData.session.scorecardJson).toBeNull();
      expect(getData.session.evidenceJson.evaluationStatus).toBe("failed");
      expect(getData.responses.length).toBeGreaterThan(0);
      expect(getData.responses[0].storageKey).toBe(testStorageKey);
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
          body: JSON.stringify({
            sessionId: testSessionId,
            userId: "user_fail",
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
        { method: "GET" }
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
          body: JSON.stringify({
            sessionId: testSessionId,
            userId: "user_123",
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
        { method: "GET" }
      );
      const getRes = await GET(getReq);
      const getData = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getData.session.status).toBe("evaluated");
      expect(getData.session.scorecardJson).toBeDefined();
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });
});
