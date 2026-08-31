import { describe, it, expect, beforeEach, mock } from "bun:test";
import { retryPracticeEvaluation } from "./retry-practice-evaluation";
import {
  devSessionCache,
  devResponseCache,
} from "../infrastructure/speaking-practice-repository";
import { persistSpeakingAudioBuffer } from "@/lib/storage/s3-client";
import { geminiRotator } from "@/lib/gemini/index";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

describe("retryPracticeEvaluation Use Case", () => {
  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
  });

  it("should throw NotFoundError if session does not exist", async () => {
    await expect(
      retryPracticeEvaluation({
        authenticatedUserId: "user_retry_1",
        sessionId: "ses_does_not_exist",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw ForbiddenError if practice belongs to another learner", async () => {
    const sessionId = "ses_victim_retry";
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId: "user_victim",
      candidateName: "Victim",
      topicTitle: "Hometown",
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
      retryPracticeEvaluation({
        authenticatedUserId: "user_attacker",
        sessionId,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("should re-evaluate existing practice on retry and update status to evaluated", async () => {
    const sessionId = "ses_retry_success";
    const storageKey = `speaking/user_valid/${sessionId}/candidate.webm`;
    const audioBytes = Buffer.from("retry-spoken-audio");
    await persistSpeakingAudioBuffer(storageKey, audioBytes);

    const now = new Date();
    devSessionCache.set(sessionId, {
      id: sessionId,
      userId: "user_valid",
      candidateName: "Valid User",
      topicTitle: "Hobbies",
      status: "completed",
      targetPart: "part_1",
      durationSeconds: 40,
      overallBand: null,
      scorecardJson: null,
      evidenceJson: { liveTranscript: "I like football." },
      createdAt: now,
      updatedAt: now,
    });

    devResponseCache.set(sessionId, [
      {
        id: `resp_${sessionId}_p1_0`,
        sessionId,
        partNumber: 1,
        itemIndex: 0,
        promptQuestion: "Hobbies",
        storageKey,
        audioUrl: `/api/speaking/upload-direct?key=${encodeURIComponent(storageKey)}`,
        mimeType: "audio/webm",
        startMs: 0,
        endMs: 40000,
        durationSeconds: 40,
        liveTranscript: "I like football.",
        verifiedTranscript: null,
        createdAt: now,
      },
    ]);

    const mockFeedback = {
      evidenceScope: { mode: "part_1", responseCount: 1 },
      estimatedPerformance: { fluencyAndCoherence: 7.0 },
      strengths: [],
      priorities: [],
      summary: "Good retry feedback",
      evidenceSufficiency: "sufficient_for_practice_feedback",
    };

    const mockClient = {
      models: {
        generateContent: mock(
          async ({ config }: { config?: { responseMimeType?: string } }) => {
            if (config?.responseMimeType !== "application/json") {
              return { text: "I like football." };
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
      const res = await retryPracticeEvaluation({
        authenticatedUserId: "user_valid",
        sessionId,
      });

      expect(res.success).toBe(true);
      expect(res.httpStatus).toBe(200);
      expect(res.result?.summary).toBe("Good retry feedback");

      const sessionAfter = devSessionCache.get(sessionId);
      expect(sessionAfter?.status).toBe("evaluated");
      expect(sessionAfter?.scorecardJson).toBeDefined();
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });
});
