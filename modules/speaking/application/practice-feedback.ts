import { z } from "zod";
const bandScoreSchema = z
  .number()
  .min(0)
  .max(9)
  .refine((val) => Number.isInteger(val * 2), {
    message: "Band score must be in increments of 0.5 (e.g. 5.5, 6.0, 6.5)",
  });
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
  fallbackModel: z
    .string()
    .optional()
    .describe("Name of fallback model if triggered"),
  primaryElapsedMs: z
    .number()
    .optional()
    .describe("Elapsed time in ms before primary model timed out or failed"),
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

export const PracticeFeedbackPointSchema = z.object({
  criterion: z
    .enum(["FC", "LR", "GRA", "PR"])
    .describe(
      "The IELTS criterion: FC (Fluency & Coherence), LR (Lexical Resource), GRA (Grammatical Range & Accuracy), PR (Pronunciation)"
    ),
  observation: z
    .string()
    .describe(
      "Specific, concrete observation about candidate's spoken performance"
    ),
  evidence: z
    .object({
      transcriptQuote: z
        .string()
        .optional()
        .describe(
          "Verbatim excerpt from transcript. Must NOT include commentary or thoughts."
        ),
      startMs: z
        .number()
        .optional()
        .describe("Approximate start timestamp in milliseconds in recording"),
      endMs: z
        .number()
        .optional()
        .describe("Approximate end timestamp in milliseconds in recording"),
    })
    .optional(),
  suggestion: z
    .string()
    .optional()
    .describe("Actionable pedagogical advice or higher-band alternative"),
});
export type PracticeFeedbackPoint = z.infer<typeof PracticeFeedbackPointSchema>;

export const PracticeFeedbackSchema = z.object({
  evidenceScope: z.object({
    mode: z.enum(["part_1", "part_2", "part_3"]),
    responseCount: z.number().int().min(1),
  }),
  estimatedPerformance: z
    .object({
      fluencyAndCoherence: bandScoreSchema.optional(),
      lexicalResource: bandScoreSchema.optional(),
      grammaticalRangeAndAccuracy: bandScoreSchema.optional(),
      pronunciation: bandScoreSchema.optional(),
    })
    .optional(),
  strengths: z.array(PracticeFeedbackPointSchema),
  priorities: z.array(PracticeFeedbackPointSchema),
  summary: z
    .string()
    .describe(
      "Formative coaching summary. Must NOT claim official band scores or full test equivalence."
    ),
  evidenceSufficiency: z.enum(["sufficient_for_practice_feedback", "limited"]),
});
export type PracticeFeedback = z.infer<typeof PracticeFeedbackSchema>;

export const PracticeEvaluationResultSchema = z.object({
  practiceFeedback: PracticeFeedbackSchema,
  transcripts: z.object({
    bestTranscript: z.string(),
    liveTranscript: z.string().optional(),
    flashLiteTranscript: z.string().optional(),
    transcribeTranscript: z.string().optional(),
    transcribeTimestampTranscript: z.string().optional(),
  }),
  trace: SpeakingEvaluationTraceSchema,
});
export type PracticeEvaluationResult = z.infer<
  typeof PracticeEvaluationResultSchema
>;
