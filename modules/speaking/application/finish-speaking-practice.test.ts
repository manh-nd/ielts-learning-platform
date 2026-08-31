import { describe, it, expect, beforeEach, mock } from "bun:test";
import { finishSpeakingPractice } from "./finish-speaking-practice";
import {
  devSessionCache,
  devResponseCache,
} from "../infrastructure/speaking-practice-repository";
import { getSpeakingAudioBuffer } from "@/lib/storage/s3-client";
import { geminiRotator } from "@/lib/gemini/index";
import { ForbiddenError } from "@/lib/errors";

describe("finishSpeakingPractice Use Case", () => {
  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
  });

  it("should reject cross-learner attempt with ForbiddenError before loading audio", async () => {
    const sessionId = "ses_finish_cross";
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId: "user_a",
      candidateName: "User A",
      topicTitle: "Topic A",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 30,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      finishSpeakingPractice({
        authenticatedUserId: "user_b",
        sessionId,
        audioBase64: Buffer.from("audio").toString("base64"),
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("should reject storageKey outside learner namespace with ForbiddenError", async () => {
    await expect(
      finishSpeakingPractice({
        authenticatedUserId: "user_a",
        sessionId: "ses_hijack",
        storageKey: "speaking/user_b/ses_other/candidate.webm",
        audioBase64: Buffer.from("audio").toString("base64"),
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("should commit completed practice before AI evaluation, and transition to evaluated on success", async () => {
    const sessionId = "ses_finish_happy";
    const testAudioBase64 =
      Buffer.from("spoken-audio-happy").toString("base64");

    const mockFeedback = {
      evidenceScope: { mode: "part_1", responseCount: 1 },
      estimatedPerformance: { fluencyAndCoherence: 7.0 },
      strengths: [],
      priorities: [],
      summary: "Happy path feedback",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const mockClient = {
      models: {
        generateContent: mock(
          async ({ config }: { config?: { responseMimeType?: string } }) => {
            if (config?.responseMimeType !== "application/json") {
              return { text: "I like traveling." };
            }
            return {
              text: JSON.stringify(mockFeedback),
              usageMetadata: {
                promptTokenCount: 100,
                candidatesTokenCount: 50,
                totalTokenCount: 150,
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
      const res = await finishSpeakingPractice({
        authenticatedUserId: "user_happy",
        sessionId,
        topicTitle: "Travel",
        audioBase64: testAudioBase64,
        durationSeconds: 30,
        questions: ["Where have you traveled?"],
      });

      expect(res.success).toBe(true);
      expect(res.httpStatus).toBe(200);
      expect(res.result?.summary).toBe("Happy path feedback");

      const session = devSessionCache.get(sessionId);
      expect(session?.status).toBe("evaluated");
      expect(session?.userId).toBe("user_happy");

      // Verify audio was durably persisted
      const savedAudio = await getSpeakingAudioBuffer(
        `speaking/user_happy/${sessionId}/candidate.webm`
      );
      expect(savedAudio).not.toBeNull();
      expect(savedAudio?.buffer.toString()).toBe("spoken-audio-happy");
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });

  it("should commit completed practice before AI evaluation, and leave practice completed (502) if AI fails", async () => {
    const sessionId = "ses_finish_fail";
    const testAudioBase64 = Buffer.from("spoken-audio-fail").toString("base64");

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(async () => {
      throw new Error("503 Service Unavailable");
    }) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const res = await finishSpeakingPractice({
        authenticatedUserId: "user_fail",
        sessionId,
        topicTitle: "Fail Test",
        audioBase64: testAudioBase64,
        durationSeconds: 25,
      });

      expect(res.success).toBe(false);
      expect(res.httpStatus).toBe(502);
      expect(res.error).toBe("EVALUATION_FAILED");

      // Invariant: Practice remains 'completed' with error recorded in evidence
      const session = devSessionCache.get(sessionId);
      expect(session?.status).toBe("completed");
      expect(
        (session?.evidenceJson as { evaluationStatus?: string })
          ?.evaluationStatus
      ).toBe("failed");
      expect(
        (session?.evidenceJson as { evaluationError?: string })?.evaluationError
      ).toBe("503 Service Unavailable");
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });
});
