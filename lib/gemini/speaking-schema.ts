import { z } from "zod";

/**
 * Official IELTS Band Calculation Algorithm
 * Raw Average = (FC + LR + GRA + PR) / 4
 *
 * Official IELTS Rounding Rules:
 * - If fractional part < 0.25 -> round down to .0 (e.g. 6.125 -> 6.0)
 * - If 0.25 <= fractional < 0.75 -> round to .5 (e.g. 6.25 -> 6.5, 6.625 -> 6.5)
 * - If fractional part >= 0.75 -> round up to next whole band (e.g. 6.75 -> 7.0)
 */
export function calculateIeltsOverallBand(
  fc: number,
  lr: number,
  gra: number,
  pr: number
): number {
  const average = (fc + lr + gra + pr) / 4;
  const whole = Math.floor(average);
  const fraction = average - whole;

  if (fraction < 0.25) {
    return whole;
  } else if (fraction < 0.75) {
    return whole + 0.5;
  } else {
    return whole + 1.0;
  }
}

// Helper to validate standard IELTS band scores (0.0 to 9.0 in 0.5 increments)
const bandScoreSchema = z
  .number()
  .min(0)
  .max(9)
  .refine((val) => Number.isInteger(val * 2), {
    message: "Band score must be in increments of 0.5 (e.g. 5.5, 6.0, 6.5)",
  });

export const PronunciationErrorDetailSchema = z.object({
  word: z.string().describe("The mispronounced word or phrase"),
  expectedIpa: z
    .string()
    .describe("Standard IPA phonetic transcription (e.g. /ˈkʌmftəbl/)"),
  detectedIssue: z
    .string()
    .describe(
      "Specific phonetic issue (e.g. 'Dropped final /s/', 'Vowel /ɪ/ replaced by /i:/', 'Stress on wrong syllable')"
    ),
  timestampSeconds: z
    .number()
    .optional()
    .describe("Approximate second mark in the audio where error occurred"),
  recommendation: z
    .string()
    .describe("How the candidate should pronounce and practice it"),
});
export type PronunciationErrorDetail = z.infer<
  typeof PronunciationErrorDetailSchema
>;

export const GrammarErrorDetailSchema = z.object({
  originalPhrase: z
    .string()
    .describe("Exact phrase containing the grammatical mistake"),
  correctedPhrase: z
    .string()
    .describe("Natural, accurate IELTS Band 7.5+ correction"),
  ruleViolated: z
    .string()
    .describe(
      "Grammar rule violated (e.g. 'Subject-verb agreement', 'Past perfect tense usage')"
    ),
  explanation: z
    .string()
    .describe("Clear pedagogical explanation for the learner"),
});
export type GrammarErrorDetail = z.infer<typeof GrammarErrorDetailSchema>;

export const LexicalUpgradeSuggestionSchema = z.object({
  originalExpression: z
    .string()
    .describe("Basic, repetitive, or imprecise expression used by candidate"),
  betterAlternative: z
    .string()
    .describe("Advanced academic or idiomatic alternative / collocation"),
  bandLevel: z
    .string()
    .describe("Target band indicator (e.g. 'Band 7.5+ collocation')"),
  contextExample: z
    .string()
    .describe("Full example sentence demonstrating correct natural usage"),
});
export type LexicalUpgradeSuggestion = z.infer<
  typeof LexicalUpgradeSuggestionSchema
>;

export const FluencyCoherenceEvaluationSchema = z.object({
  score: bandScoreSchema,
  summary: z
    .string()
    .describe(
      "Detailed evaluation of fluency, speech rate, pausing, and coherence"
    ),
  strengths: z.array(z.string()).describe("Observed fluency strengths"),
  weaknesses: z.array(z.string()).describe("Areas needing improvement"),
  estimatedWpm: z.number().describe("Estimated words spoken per minute (WPM)"),
  hesitationFrequency: z
    .enum(["low", "moderate", "high"])
    .describe("Frequency of language-searching pauses"),
  tips: z
    .array(z.string())
    .describe(
      "Specific drills to improve flow, linking devices, and hesitation control"
    ),
});
export type FluencyCoherenceEvaluation = z.infer<
  typeof FluencyCoherenceEvaluationSchema
>;

export const LexicalResourceEvaluationSchema = z.object({
  score: bandScoreSchema,
  summary: z
    .string()
    .describe(
      "Evaluation of vocabulary breadth, precision, idioms, and collocations"
    ),
  strengths: z
    .array(z.string())
    .describe("Noteworthy vocabulary and collocations used"),
  weaknesses: z
    .array(z.string())
    .describe(
      "Repetitive words, informal phrasing, or inappropriate word choices"
    ),
  upgrades: z
    .array(LexicalUpgradeSuggestionSchema)
    .describe("List of high-value vocabulary upgrades"),
  tips: z
    .array(z.string())
    .describe("Specific recommendations for expanding lexical resource"),
});
export type LexicalResourceEvaluation = z.infer<
  typeof LexicalResourceEvaluationSchema
>;

export const GrammaticalRangeEvaluationSchema = z.object({
  score: bandScoreSchema,
  summary: z
    .string()
    .describe(
      "Evaluation of sentence complexity, variety of structures, and accuracy"
    ),
  strengths: z
    .array(z.string())
    .describe("Effective complex sentences and structures used"),
  weaknesses: z
    .array(z.string())
    .describe("Frequent grammatical inaccuracies or structural limitations"),
  complexStructuresCount: z
    .number()
    .describe("Estimated count of successful complex sentence structures"),
  errors: z
    .array(GrammarErrorDetailSchema)
    .describe("Specific grammar errors with corrections"),
  tips: z
    .array(z.string())
    .describe("Grammar focus points for higher band performance"),
});
export type GrammaticalRangeEvaluation = z.infer<
  typeof GrammaticalRangeEvaluationSchema
>;

export const PronunciationEvaluationSchema = z.object({
  score: bandScoreSchema,
  summary: z
    .string()
    .describe(
      "Acoustic analysis of phoneme accuracy, word stress, intonation, and rhythm"
    ),
  strengths: z
    .array(z.string())
    .describe("Pronunciation clarity, natural connected speech, and rhythm"),
  weaknesses: z
    .array(z.string())
    .describe(
      "Phonetic inaccuracies, monotone intonation, or misapplied stress"
    ),
  intonationQuality: z
    .enum(["natural", "flat", "erratic"])
    .describe("Overall intonation delivery"),
  specificErrors: z
    .array(PronunciationErrorDetailSchema)
    .describe("Timestamped phoneme and stress errors"),
  tips: z
    .array(z.string())
    .describe(
      "Actionable phonetics drills (e.g. minimal pairs, shadow reading)"
    ),
});
export type PronunciationEvaluation = z.infer<
  typeof PronunciationEvaluationSchema
>;

export const SpeakingPartEvaluationSchema = z.object({
  partNumber: z
    .number()
    .int()
    .min(1)
    .max(3)
    .describe("IELTS Speaking Part (1, 2, or 3)"),
  itemIndex: z
    .number()
    .int()
    .min(0)
    .describe("Zero-based question index within the part"),
  promptQuestion: z.string().describe("The prompt question or cue card topic"),
  candidateTranscript: z
    .string()
    .describe("Full transcription of candidate speech for this response"),
  partSummary: z
    .string()
    .describe(
      "Brief evaluation of candidate performance on this specific prompt"
    ),
  pronunciationNotes: z
    .array(PronunciationErrorDetailSchema)
    .describe("Pronunciation notes for this part"),
  lexicalUpgrades: z
    .array(LexicalUpgradeSuggestionSchema)
    .describe("Vocabulary suggestions for this part"),
  grammarCorrections: z
    .array(GrammarErrorDetailSchema)
    .describe("Grammar corrections for this part"),
});
export type SpeakingPartEvaluation = z.infer<
  typeof SpeakingPartEvaluationSchema
>;

export const SpeakingOverallScorecardSchema = z.object({
  overallBand: bandScoreSchema,
  criteriaScores: z.object({
    fluencyAndCoherence: bandScoreSchema,
    lexicalResource: bandScoreSchema,
    grammaticalRangeAndAccuracy: bandScoreSchema,
    pronunciation: bandScoreSchema,
  }),
  criteria: z.object({
    fluencyAndCoherence: FluencyCoherenceEvaluationSchema,
    lexicalResource: LexicalResourceEvaluationSchema,
    grammaticalRangeAndAccuracy: GrammaticalRangeEvaluationSchema,
    pronunciation: PronunciationEvaluationSchema,
  }),
  generalFeedback: z.object({
    executiveSummary: z
      .string()
      .describe("High-level examiner summary of candidate level"),
    keyStrengths: z
      .array(z.string())
      .describe("Top 3-4 strengths across all parts"),
    priorityImprovements: z
      .array(z.string())
      .describe("Top 3-4 urgent areas to improve"),
    actionPlan: z
      .array(z.string())
      .describe("Step-by-step 2-week study plan to reach next target band"),
    practiceMonologue: z
      .string()
      .describe(
        "Synthesizes all thoughts, experiences, and arguments expressed by the candidate across the session into a single cohesive, high-scoring IELTS Band 8.0+ model speech (120-160 words) for shadow reading practice."
      ),
  }),
});
export type SpeakingOverallScorecard = z.infer<
  typeof SpeakingOverallScorecardSchema
>;

export const SpeakingEvaluationTraceSchema = z.object({
  modelUsed: z.string().describe("Gemini model that produced the evaluation"),
  isFallback: z
    .boolean()
    .describe(
      "True if primary model failed/exhausted quota and fallback was triggered"
    ),
  fallbackReason: z
    .string()
    .nullable()
    .describe("Reason for fallback if triggered"),
  durationMs: z.number().describe("Total execution latency in milliseconds"),
  tokensUsed: z.object({
    promptTokens: z.number(),
    candidatesTokens: z.number(),
    totalTokens: z.number(),
  }),
  keyFingerprint: z
    .string()
    .describe(
      "Masked key fingerprint for auditing without leaking full secrets"
    ),
  timestamp: z.string().describe("ISO 8601 evaluation timestamp"),
});
export type SpeakingEvaluationTrace = z.infer<
  typeof SpeakingEvaluationTraceSchema
>;

export const IeltsSpeakingEvaluationResultSchema = z.object({
  overallScorecard: SpeakingOverallScorecardSchema,
  partEvaluations: z.array(SpeakingPartEvaluationSchema),
  trace: SpeakingEvaluationTraceSchema,
});
export type IeltsSpeakingEvaluationResult = z.infer<
  typeof IeltsSpeakingEvaluationResultSchema
>;

/**
 * Standard JSON Schema for Gemini Structured Output Engine
 * Adheres to JSON Schema Draft-07 supported by Gemini Interactions API & generateContent
 */
export const speakingEvaluationJsonSchema = {
  type: "object",
  properties: {
    overallScorecard: {
      type: "object",
      properties: {
        overallBand: {
          type: "number",
          description: "Overall IELTS band 0-9 in 0.5 increments",
        },
        criteriaScores: {
          type: "object",
          properties: {
            fluencyAndCoherence: { type: "number" },
            lexicalResource: { type: "number" },
            grammaticalRangeAndAccuracy: { type: "number" },
            pronunciation: { type: "number" },
          },
          required: [
            "fluencyAndCoherence",
            "lexicalResource",
            "grammaticalRangeAndAccuracy",
            "pronunciation",
          ],
        },
        criteria: {
          type: "object",
          properties: {
            fluencyAndCoherence: {
              type: "object",
              properties: {
                score: { type: "number" },
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                estimatedWpm: { type: "number" },
                hesitationFrequency: {
                  type: "string",
                  enum: ["low", "moderate", "high"],
                },
                tips: { type: "array", items: { type: "string" } },
              },
              required: [
                "score",
                "summary",
                "strengths",
                "weaknesses",
                "estimatedWpm",
                "hesitationFrequency",
                "tips",
              ],
            },
            lexicalResource: {
              type: "object",
              properties: {
                score: { type: "number" },
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                upgrades: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      originalExpression: { type: "string" },
                      betterAlternative: { type: "string" },
                      bandLevel: { type: "string" },
                      contextExample: { type: "string" },
                    },
                    required: [
                      "originalExpression",
                      "betterAlternative",
                      "bandLevel",
                      "contextExample",
                    ],
                  },
                },
                tips: { type: "array", items: { type: "string" } },
              },
              required: [
                "score",
                "summary",
                "strengths",
                "weaknesses",
                "upgrades",
                "tips",
              ],
            },
            grammaticalRangeAndAccuracy: {
              type: "object",
              properties: {
                score: { type: "number" },
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                complexStructuresCount: { type: "number" },
                errors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      originalPhrase: { type: "string" },
                      correctedPhrase: { type: "string" },
                      ruleViolated: { type: "string" },
                      explanation: { type: "string" },
                    },
                    required: [
                      "originalPhrase",
                      "correctedPhrase",
                      "ruleViolated",
                      "explanation",
                    ],
                  },
                },
                tips: { type: "array", items: { type: "string" } },
              },
              required: [
                "score",
                "summary",
                "strengths",
                "weaknesses",
                "complexStructuresCount",
                "errors",
                "tips",
              ],
            },
            pronunciation: {
              type: "object",
              properties: {
                score: { type: "number" },
                summary: { type: "string" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                intonationQuality: {
                  type: "string",
                  enum: ["natural", "flat", "erratic"],
                },
                specificErrors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      word: { type: "string" },
                      expectedIpa: { type: "string" },
                      detectedIssue: { type: "string" },
                      timestampSeconds: { type: "number" },
                      recommendation: { type: "string" },
                    },
                    required: [
                      "word",
                      "expectedIpa",
                      "detectedIssue",
                      "recommendation",
                    ],
                  },
                },
                tips: { type: "array", items: { type: "string" } },
              },
              required: [
                "score",
                "summary",
                "strengths",
                "weaknesses",
                "intonationQuality",
                "specificErrors",
                "tips",
              ],
            },
          },
          required: [
            "fluencyAndCoherence",
            "lexicalResource",
            "grammaticalRangeAndAccuracy",
            "pronunciation",
          ],
        },
        generalFeedback: {
          type: "object",
          properties: {
            executiveSummary: { type: "string" },
            keyStrengths: { type: "array", items: { type: "string" } },
            priorityImprovements: { type: "array", items: { type: "string" } },
            actionPlan: { type: "array", items: { type: "string" } },
            practiceMonologue: {
              type: "string",
              description:
                "Band 8.0+ model monologue synthesizing candidate's ideas for shadow reading practice",
            },
          },
          required: [
            "executiveSummary",
            "keyStrengths",
            "priorityImprovements",
            "actionPlan",
            "practiceMonologue",
          ],
        },
      },
      required: [
        "overallBand",
        "criteriaScores",
        "criteria",
        "generalFeedback",
      ],
    },
    partEvaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          partNumber: { type: "integer" },
          itemIndex: { type: "integer" },
          promptQuestion: { type: "string" },
          candidateTranscript: { type: "string" },
          partSummary: { type: "string" },
          pronunciationNotes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                word: { type: "string" },
                expectedIpa: { type: "string" },
                detectedIssue: { type: "string" },
                timestampSeconds: { type: "number" },
                recommendation: { type: "string" },
              },
              required: [
                "word",
                "expectedIpa",
                "detectedIssue",
                "recommendation",
              ],
            },
          },
          lexicalUpgrades: {
            type: "array",
            items: {
              type: "object",
              properties: {
                originalExpression: { type: "string" },
                betterAlternative: { type: "string" },
                bandLevel: { type: "string" },
                contextExample: { type: "string" },
              },
              required: [
                "originalExpression",
                "betterAlternative",
                "bandLevel",
                "contextExample",
              ],
            },
          },
          grammarCorrections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                originalPhrase: { type: "string" },
                correctedPhrase: { type: "string" },
                ruleViolated: { type: "string" },
                explanation: { type: "string" },
              },
              required: [
                "originalPhrase",
                "correctedPhrase",
                "ruleViolated",
                "explanation",
              ],
            },
          },
        },
        required: [
          "partNumber",
          "itemIndex",
          "promptQuestion",
          "candidateTranscript",
          "partSummary",
          "pronunciationNotes",
          "lexicalUpgrades",
          "grammarCorrections",
        ],
      },
    },
  },
  required: ["overallScorecard", "partEvaluations"],
} as const;
