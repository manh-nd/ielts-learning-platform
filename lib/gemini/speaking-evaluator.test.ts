import { beforeEach, describe, expect, it, mock } from "bun:test";
import { geminiRotator } from "./index";
import {
  evaluateSpeakingAudio,
  transcribeSpeakingAudioVerbatim,
  SpeakingAudioInput,
} from "./speaking-evaluator";

const mockValidScorecard = {
  overallScorecard: {
    overallBand: 6.5,
    criteriaScores: {
      fluencyAndCoherence: 6.5,
      lexicalResource: 7.0,
      grammaticalRangeAndAccuracy: 6.0,
      pronunciation: 6.5,
    },
    criteria: {
      fluencyAndCoherence: {
        score: 6.5,
        summary:
          "Smooth delivery with minor hesitation when developing abstract ideas.",
        strengths: ["Clear discourse markers"],
        weaknesses: ["Occasional pausing in Part 3"],
        estimatedWpm: 130,
        hesitationFrequency: "low" as const,
        tips: ["Practice filler control"],
      },
      lexicalResource: {
        score: 7.0,
        summary: "Wide range of vocabulary with good idiomatic collocations.",
        strengths: ["Effective idioms"],
        weaknesses: ["Occasional minor word choice slips"],
        upgrades: [
          {
            originalExpression: "good job",
            betterAlternative: "rewarding occupation",
            bandLevel: "Band 7.5+",
            contextExample: "Teaching is a truly rewarding occupation.",
          },
        ],
        tips: ["Continue using topic-specific idioms"],
      },
      grammaticalRangeAndAccuracy: {
        score: 6.0,
        summary: "Good mix of complex sentences with occasional tense errors.",
        strengths: ["Complex conditionals"],
        weaknesses: ["Past tense inconsistencies"],
        complexStructuresCount: 3,
        errors: [
          {
            originalPhrase: "If I have time yesterday, I would go",
            correctedPhrase: "If I had had time yesterday, I would have gone",
            ruleViolated: "Third conditional structure",
            explanation:
              "Past hypothetical conditions require past perfect in if-clause.",
          },
        ],
        tips: ["Review mixed and third conditionals"],
      },
      pronunciation: {
        score: 6.5,
        summary: "Clear intonation with intelligible pronunciation throughout.",
        strengths: ["Natural rhythm and word stress"],
        weaknesses: ["Dropped final /s/ and /t/ consonants"],
        intonationQuality: "natural" as const,
        specificErrors: [
          {
            word: "tasks",
            expectedIpa: "/tɑːsks/",
            detectedIssue: "Omitted final /ks/ cluster",
            timestampSeconds: 12.4,
            recommendation: "Carefully articulate final consonant clusters.",
          },
        ],
        tips: ["Practice consonant cluster drills"],
      },
    },
    generalFeedback: {
      executiveSummary: "Solid Band 6.5 performer with strong vocabulary.",
      keyStrengths: ["Lexical flexibility", "Good speech rate"],
      priorityImprovements: [
        "Grammar accuracy",
        "Final consonant pronunciation",
      ],
      actionPlan: [
        "Focus on complex conditional drills",
        "Pronunciation shadowing",
      ],
      practiceMonologue:
        "Growing up in Hanoi, I was constantly surrounded by rich historical architecture and a dynamic modern vibe, which shaped my appreciation for cultural heritage.",
    },
  },
  partEvaluations: [
    {
      partNumber: 1,
      itemIndex: 0,
      promptQuestion: "Let's talk about your hometown.",
      candidateTranscript:
        "I was born and raised in Hanoi, the vibrant capital city of Vietnam.",
      verifiedTranscript:
        "I was born and raised in Hanoi, the vibrant capital city of Vietnam.",
      partSummary: "Fluently delivered introduction with great lexical choice.",
      pronunciationNotes: [],
      lexicalUpgrades: [],
      grammarCorrections: [],
    },
  ],
  evidence: {
    fluency: {
      longPauses: [],
      fillers: ["umm"],
      repetitions: [],
      selfCorrections: [],
    },
    grammar: {
      errors: [],
      complexStructures: ["Growing up in Hanoi, I was constantly surrounded"],
    },
    vocabulary: {
      strongUsage: ["vibrant capital city"],
      inappropriateUsage: [],
    },
    pronunciation: {
      unclearSegments: [],
      stressIssues: [],
    },
  },
};

type RotateCallback<T> = (
  client: Parameters<
    Parameters<typeof geminiRotator.executeWithRotation>[0]
  >[0],
  key: string,
  keyFingerprint: string
) => Promise<T>;

describe("Speaking Evaluator Service (2-Stage Pipeline)", () => {
  beforeEach(() => {
    geminiRotator.resetKeyStates();
  });

  it("should throw an error when no audio responses are provided", async () => {
    expect(evaluateSpeakingAudio([])).rejects.toThrow(
      "No audio responses provided for speaking evaluation."
    );
  });

  it("should perform verbatim transcription in Pass 1", async () => {
    const mockClient = {
      models: {
        generateContent: mock(async () => ({
          text: "I was born and... umm... raised in Hanoi, Vietnam.",
        })),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (fn: RotateCallback<unknown>) =>
        fn(
          mockClient as unknown as Parameters<
            Parameters<typeof geminiRotator.executeWithRotation>[0]
          >[0],
          "MOCK_KEY_1234",
          "key_***1234"
        )
    ) as unknown as typeof geminiRotator.executeWithRotation;

    const inputAudio: SpeakingAudioInput = {
      partNumber: 1,
      itemIndex: 0,
      promptQuestion: "Hometown",
      audioBase64:
        "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
      mimeType: "audio/webm",
    };

    const transcript = await transcribeSpeakingAudioVerbatim(inputAudio);
    expect(transcript).toBe(
      "I was born and... umm... raised in Hanoi, Vietnam."
    );

    geminiRotator.executeWithRotation = originalExecute;
  });

  it("should successfully evaluate audio with 2-stage pipeline and record trace metadata", async () => {
    const mockClient = {
      models: {
        generateContent: mock(
          async ({ config }: { config?: { responseMimeType?: string } }) => {
            if (config?.responseMimeType === "application/json") {
              return {
                text: JSON.stringify(mockValidScorecard),
                usageMetadata: {
                  promptTokenCount: 1500,
                  candidatesTokenCount: 800,
                  totalTokenCount: 2300,
                },
              };
            }
            return {
              text: "I was born and raised in Hanoi, the vibrant capital city of Vietnam.",
            };
          }
        ),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (fn: RotateCallback<unknown>) =>
        fn(
          mockClient as unknown as Parameters<
            Parameters<typeof geminiRotator.executeWithRotation>[0]
          >[0],
          "MOCK_KEY_1234",
          "key_***1234"
        )
    ) as unknown as typeof geminiRotator.executeWithRotation;

    const inputAudio: SpeakingAudioInput[] = [
      {
        partNumber: 1,
        itemIndex: 0,
        promptQuestion: "Let's talk about your hometown.",
        audioBase64:
          "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
        mimeType: "audio/webm",
        durationSeconds: 15,
      },
    ];

    const result = await evaluateSpeakingAudio(inputAudio, {
      primaryModel: "gemini-3.7-flash",
      skipVerbatimPass: false,
    });

    expect(result).toBeDefined();
    expect(result.overallScorecard.overallBand).toBe(6.5);
    expect(result.overallScorecard.criteriaScores.fluencyAndCoherence).toBe(
      6.5
    );
    expect(result.overallScorecard.criteriaScores.lexicalResource).toBe(7.0);

    // Verify trace metadata
    expect(result.trace).toBeDefined();
    expect(result.trace.modelUsed).toBe("gemini-3.7-flash");
    expect(result.trace.isFallback).toBe(false);
    expect(result.trace.fallbackReason).toBeNull();
    expect(result.trace.tokensUsed.promptTokens).toBe(1500);
    expect(result.trace.tokensUsed.candidatesTokens).toBe(800);
    expect(result.trace.tokensUsed.totalTokens).toBe(2300);
    expect(result.trace.keyFingerprint).toBe("key_***1234");
    expect(result.trace.durationMs).toBeGreaterThanOrEqual(0);

    geminiRotator.executeWithRotation = originalExecute;
  });

  it("should cascade to fallback model (Flash Lite) when primary model fails", async () => {
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
              return { text: "Sample transcript" };
            }
            if (model === "gemini-3.7-flash") {
              throw new Error(
                "429 RESOURCE_EXHAUSTED: Daily quota exceeded for 20 RPD"
              );
            }
            return {
              text: JSON.stringify(mockValidScorecard),
              usageMetadata: {
                promptTokenCount: 1100,
                candidatesTokenCount: 700,
                totalTokenCount: 1800,
              },
            };
          }
        ),
      },
    };

    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(
      async (fn: RotateCallback<unknown>) =>
        fn(
          mockClient as unknown as Parameters<
            Parameters<typeof geminiRotator.executeWithRotation>[0]
          >[0],
          "MOCK_KEY_5678",
          "key_***5678"
        )
    ) as unknown as typeof geminiRotator.executeWithRotation;

    const inputAudio: SpeakingAudioInput[] = [
      {
        partNumber: 1,
        itemIndex: 0,
        promptQuestion: "Describe a memorable journey.",
        audioBuffer: Buffer.from("dummy-audio-content"),
        mimeType: "audio/webm",
        durationSeconds: 30,
      },
    ];

    const result = await evaluateSpeakingAudio(inputAudio, {
      primaryModel: "gemini-3.7-flash",
      fallbackModel: "gemini-3.5-flash-lite",
    });

    expect(result).toBeDefined();
    expect(result.trace.isFallback).toBe(true);
    expect(result.trace.modelUsed).toBe("gemini-3.5-flash-lite");
    expect(result.trace.fallbackReason).toContain("PRIMARY_MODEL_FAILED");
    expect(result.trace.tokensUsed.totalTokens).toBe(1800);

    geminiRotator.executeWithRotation = originalExecute;
  });
});
