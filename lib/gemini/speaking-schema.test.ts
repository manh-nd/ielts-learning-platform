import { describe, expect, it } from "bun:test";
import { z } from "zod";
import {
  calculateIeltsOverallBand,
  IeltsSpeakingEvaluationResultSchema,
  SpeakingOverallScorecardSchema,
} from "./speaking-schema";

describe("IELTS Speaking Band Score Rounding Algorithm", () => {
  it("should calculate exact integers without rounding needed", () => {
    expect(calculateIeltsOverallBand(6.0, 6.0, 6.0, 6.0)).toBe(6.0);
    expect(calculateIeltsOverallBand(7.0, 7.0, 7.0, 7.0)).toBe(7.0);
    expect(calculateIeltsOverallBand(8.0, 8.0, 8.0, 8.0)).toBe(8.0);
  });

  it("should round DOWN to .0 when fractional part is < 0.25", () => {
    // Average = 24.5 / 4 = 6.125 (fraction = 0.125 < 0.25) -> 6.0
    expect(calculateIeltsOverallBand(6.0, 6.0, 6.5, 6.0)).toBe(6.0);
    // Average = 28.5 / 4 = 7.125 -> 7.0
    expect(calculateIeltsOverallBand(7.0, 7.0, 7.5, 7.0)).toBe(7.0);
  });

  it("should round to .5 when fractional part is >= 0.25 and < 0.75", () => {
    // Average = 25.0 / 4 = 6.25 (fraction = 0.25) -> 6.5
    expect(calculateIeltsOverallBand(6.0, 6.5, 6.5, 6.0)).toBe(6.5);
    // Average = 25.5 / 4 = 6.375 (fraction = 0.375) -> 6.5
    expect(calculateIeltsOverallBand(6.0, 6.5, 6.5, 6.5)).toBe(6.5);
    // Average = 26.0 / 4 = 6.5 -> 6.5
    expect(calculateIeltsOverallBand(6.5, 6.5, 6.5, 6.5)).toBe(6.5);
    // Average = 26.5 / 4 = 6.625 (fraction = 0.625 < 0.75) -> 6.5
    expect(calculateIeltsOverallBand(6.5, 6.5, 6.5, 7.0)).toBe(6.5);
  });

  it("should round UP to next whole band when fractional part is >= 0.75", () => {
    // Average = 27.0 / 4 = 6.75 (fraction = 0.75) -> 7.0
    expect(calculateIeltsOverallBand(6.5, 7.0, 6.5, 7.0)).toBe(7.0);
    // Average = 27.5 / 4 = 6.875 (fraction = 0.875) -> 7.0
    expect(calculateIeltsOverallBand(6.5, 7.0, 7.0, 7.0)).toBe(7.0);
    // Average = 31.0 / 4 = 7.75 -> 8.0
    expect(calculateIeltsOverallBand(7.5, 8.0, 7.5, 8.0)).toBe(8.0);
  });
});

describe("IELTS Speaking Zod Schemas Validation", () => {
  it("should validate a complete valid speaking evaluation result", () => {
    const mockResult = {
      overallScorecard: {
        overallBand: 6.5,
        criteriaScores: {
          fluencyAndCoherence: 6.5,
          lexicalResource: 6.5,
          grammaticalRangeAndAccuracy: 6.0,
          pronunciation: 6.5,
        },
        criteria: {
          fluencyAndCoherence: {
            score: 6.5,
            summary:
              "Good flow with minor hesitations during complex topic development.",
            strengths: [
              "Speaks at length effortlessly",
              "Uses a variety of connectives",
            ],
            weaknesses: ["Occasional pause searching for vocabulary in Part 3"],
            estimatedWpm: 125,
            hesitationFrequency: "moderate" as const,
            tips: ["Practice linking clauses without filler words like 'uhm'"],
          },
          lexicalResource: {
            score: 6.5,
            summary:
              "Sufficient range of topic-related vocabulary and attempts at idioms.",
            strengths: ["Accurate use of collocations like 'hectic schedule'"],
            weaknesses: ["Repeated use of 'very good' and 'big problem'"],
            upgrades: [
              {
                originalExpression: "big problem",
                betterAlternative: "pressing issue / major obstacle",
                bandLevel: "Band 7.5+ collocation",
                contextExample:
                  "Air pollution has become a pressing issue in metropolitan areas.",
              },
            ],
            tips: ["Expand idiomatic expressions for Part 3 discussions"],
          },
          grammaticalRangeAndAccuracy: {
            score: 6.0,
            summary:
              "Mix of simple and complex forms with minor recurring errors.",
            strengths: ["Uses conditional clauses and relative clauses"],
            weaknesses: [
              "Errors with third-person singular and past tense endings",
            ],
            complexStructuresCount: 4,
            errors: [
              {
                originalPhrase: "She go to school every day",
                correctedPhrase: "She goes to school every day",
                ruleViolated: "Subject-verb agreement",
                explanation:
                  "Third-person singular 'she' requires the verb 'goes'.",
              },
            ],
            tips: ["Review tense consistency when describing past experiences"],
          },
          pronunciation: {
            score: 6.5,
            summary:
              "Generally clear pronunciation with occasional dropped final consonants.",
            strengths: ["Natural sentence stress", "Intelligible accent"],
            weaknesses: ["Dropped final /s/ and /t/ sounds"],
            intonationQuality: "natural" as const,
            specificErrors: [
              {
                word: "months",
                expectedIpa: "/mʌnθs/",
                detectedIssue: "Dropped final /s/ and /θ/ sound",
                timestampSeconds: 15.2,
                recommendation:
                  "Slow down slightly to articulate the consonant cluster /nθs/.",
              },
            ],
            tips: ["Practice tongue positioning for /θ/ vs /s/ minimal pairs"],
          },
        },
        generalFeedback: {
          executiveSummary:
            "Strong Band 6.5 candidate with good fluency and natural intonation.",
          keyStrengths: [
            "Clear pronunciation",
            "Good topic development in Part 2",
          ],
          priorityImprovements: [
            "Third-person singular grammar accuracy",
            "Lexical precision",
          ],
          actionPlan: [
            "Day 1-5: Grammar drills on past tense",
            "Day 6-10: Vocabulary expansion for abstract topics",
          ],
        },
      },
      partEvaluations: [
        {
          partNumber: 1,
          itemIndex: 0,
          promptQuestion: "Do you work or are you a student?",
          candidateTranscript:
            "Currently, I am a university student majoring in computer science.",
          partSummary: "Direct and clear response with good grammar.",
          pronunciationNotes: [],
          lexicalUpgrades: [],
          grammarCorrections: [],
        },
      ],
      trace: {
        modelUsed: "gemini-3.7-flash",
        isFallback: false,
        fallbackReason: null,
        durationMs: 2450,
        tokensUsed: {
          promptTokens: 1200,
          candidatesTokens: 850,
          totalTokens: 2050,
        },
        keyFingerprint: "key_***8f2",
        timestamp: new Date().toISOString(),
      },
    };

    const parsed = IeltsSpeakingEvaluationResultSchema.safeParse(mockResult);
    expect(parsed.success).toBe(true);
  });

  it("should reject invalid band scores not in 0.5 increments", () => {
    const invalidScorecard = {
      overallBand: 6.3, // Invalid: not multiple of 0.5
      criteriaScores: {
        fluencyAndCoherence: 6.0,
        lexicalResource: 6.0,
        grammaticalRangeAndAccuracy: 6.0,
        pronunciation: 6.0,
      },
      criteria: {} as unknown as z.infer<
        typeof SpeakingOverallScorecardSchema
      >["criteria"],
      generalFeedback: {} as unknown as z.infer<
        typeof SpeakingOverallScorecardSchema
      >["generalFeedback"],
    };

    const parsed = SpeakingOverallScorecardSchema.safeParse(invalidScorecard);
    expect(parsed.success).toBe(false);
  });
});
