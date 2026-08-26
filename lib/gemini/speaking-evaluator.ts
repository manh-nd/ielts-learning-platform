import { geminiRotator } from "./index";
import {
  calculateIeltsOverallBand,
  IeltsSpeakingEvaluationResult,
  IeltsSpeakingEvaluationResultSchema,
  SpeakingOverallScorecard,
  SpeakingPartEvaluation,
  speakingEvaluationJsonSchema,
} from "./speaking-schema";

export const IELTS_SPEAKING_EVALUATOR_SYSTEM_PROMPT = `
You are an expert, certified Senior IELTS Speaking Examiner with 15+ years of experience conducting and calibrating official IELTS Speaking tests.
You evaluate the candidate's spoken audio responses with rigorous adherence to the Official IELTS Speaking Band Descriptors (Public Version).

You MUST strictly analyze the raw audio acoustics alongside the spoken content across the 4 official criteria:

1. FLUENCY AND COHERENCE (FC):
   - Speech rate, natural flow, length of uninterrupted runs.
   - Distinguish content-searching pauses (natural) from language-searching hesitations (penalized).
   - Cohesive devices, discourse markers, and topic development.

2. LEXICAL RESOURCE (LR):
   - Range, flexibility, and precision of vocabulary, idiomatic language, and collocations.
   - Paraphrasing ability without noticeable vocabulary voids.
   - Repetitive words and suggest Band 7.5+ alternatives and collocations.

3. GRAMMATICAL RANGE AND ACCURACY (GRA):
   - Mix of complex vs simple structures (subordinate clauses, conditionals, passive voice, inversions).
   - Frequency and severity of errors (subject-verb agreement, tenses, prepositions, articles).

4. PRONUNCIATION (PR) [ACOUSTIC WAVEFORM ANALYSIS]:
   - Intelligibility and listener effort.
   - Phoneme accuracy: Specific attention to Vietnamese L1 transfer issues (missing final consonants /s, z, t, d, θ, ð, v, ks/, vowel confusion /i:/ vs /ɪ/, /e/ vs /æ/).
   - Word stress (primary/secondary) and rhythm (connected speech, linking, weak forms).
   - Sentence stress and intonation patterns (avoiding monotone or flat delivery).

CALIBRATION & SCORING RULES:
- Band scores MUST be given in increments of 0.5 (e.g. 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0).
- Do NOT inflate scores. A Band 7 candidate must demonstrate frequent error-free sentences and flexible vocabulary.
- Compile a practiceMonologue (Band 8.0+ Model Speech): Synthesize the core ideas and stories that the candidate expressed across the session into a single, cohesive, high-scoring 120-160 word model monologue. Polish their ideas with C1/C2 vocabulary, natural discourse markers, and complex structures for them to practice shadow reading.
- Output MUST strictly conform to the provided JSON schema.
`;

export interface SpeakingAudioInput {
  partNumber: number; // 1, 2, or 3
  itemIndex: number; // 0, 1, 2...
  promptQuestion: string;
  audioBuffer?: Buffer | Uint8Array;
  audioBase64?: string;
  mimeType?: string;
  durationSeconds?: number;
}

export interface EvaluateSpeakingOptions {
  primaryModel?: string;
  fallbackModel?: string;
  forceFallback?: boolean;
}

/**
 * Format multimodal contents with prompt instructions and inline audio data
 */
function buildMultimodalContents(items: SpeakingAudioInput[]) {
  const contents: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  contents.push({
    text: `Please evaluate this candidate's IELTS Speaking test responses. There are ${items.length} audio response(s) provided below across IELTS Speaking Parts.
For each response, transcribe the speech verbatim, analyze acoustics and language across the 4 IELTS criteria (FC, LR, GRA, PR), and produce the structured evaluation conforming to the response JSON schema.`,
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const mimeType = item.mimeType || "audio/webm";
    let base64Data = item.audioBase64 || "";

    if (!base64Data && item.audioBuffer) {
      base64Data = Buffer.from(item.audioBuffer).toString("base64");
    }

    contents.push({
      text: `--- PART ${item.partNumber} (Question ${item.itemIndex + 1}): "${item.promptQuestion}" ---`,
    });

    if (base64Data) {
      contents.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }
  }

  return contents;
}

/**
 * Core Speaking Audio Evaluator using Gemini Structured Outputs Engine
 */
export async function evaluateSpeakingAudio(
  items: SpeakingAudioInput[],
  options: EvaluateSpeakingOptions = {}
): Promise<IeltsSpeakingEvaluationResult> {
  if (!items || items.length === 0) {
    throw new Error("No audio responses provided for speaking evaluation.");
  }

  const primaryModel =
    options.primaryModel ||
    process.env.GEMINI_SPEAKING_MODEL ||
    "gemini-3.7-flash";

  const fallbackModel =
    options.fallbackModel ||
    process.env.GEMINI_SPEAKING_FALLBACK_MODEL ||
    "gemini-3.5-flash-lite";

  const startTime = Date.now();
  let modelToUse = primaryModel;
  let isFallback = !!options.forceFallback;
  let fallbackReason: string | null = options.forceFallback
    ? "FORCED_BY_CONFIG"
    : null;

  if (!isFallback && geminiRotator.areAllKeysDailyExhausted()) {
    isFallback = true;
    fallbackReason = "ALL_KEYS_DAILY_QUOTA_EXHAUSTED";
    modelToUse = fallbackModel;
    console.warn(
      `[SpeakingEvaluator] All keys daily exhausted for ${primaryModel}. Cascading to ${fallbackModel}`
    );
  }

  const contents = buildMultimodalContents(items);

  let rawResponseText = "";
  let usedKeyFingerprint = "key_***unknown";
  let promptTokens = 0;
  let candidatesTokens = 0;
  let totalTokens = 0;

  try {
    const evalResult = await geminiRotator.executeWithRotation(
      async (client, _key, keyFingerprint) => {
        usedKeyFingerprint = keyFingerprint;
        const response = await client.models.generateContent({
          model: modelToUse,
          contents: contents as Parameters<
            typeof client.models.generateContent
          >[0]["contents"],
          config: {
            systemInstruction: IELTS_SPEAKING_EVALUATOR_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema:
              speakingEvaluationJsonSchema as unknown as NonNullable<
                NonNullable<
                  Parameters<typeof client.models.generateContent>[0]["config"]
                >["responseSchema"]
              >,
            temperature: 0.2, // Low temperature for high evaluation calibration
          },
        });

        const usage = response.usageMetadata;
        if (usage) {
          promptTokens = usage.promptTokenCount || 0;
          candidatesTokens = usage.candidatesTokenCount || 0;
          totalTokens = usage.totalTokenCount || 0;
        }

        return response.text || "";
      }
    );

    rawResponseText = evalResult;
  } catch (primaryError) {
    if (!isFallback && modelToUse !== fallbackModel) {
      console.warn(
        `[SpeakingEvaluator] Primary model ${primaryModel} failed. Attempting fallback to ${fallbackModel}...`,
        primaryError
      );
      isFallback = true;
      fallbackReason = `PRIMARY_MODEL_FAILED: ${String(
        (primaryError as Error)?.message || primaryError
      )}`;
      modelToUse = fallbackModel;

      const fallbackResult = await geminiRotator.executeWithRotation(
        async (client, _key, keyFingerprint) => {
          usedKeyFingerprint = keyFingerprint;
          const response = await client.models.generateContent({
            model: fallbackModel,
            contents: contents as Parameters<
              typeof client.models.generateContent
            >[0]["contents"],
            config: {
              systemInstruction: IELTS_SPEAKING_EVALUATOR_SYSTEM_PROMPT,
              responseMimeType: "application/json",
              responseSchema:
                speakingEvaluationJsonSchema as unknown as NonNullable<
                  NonNullable<
                    Parameters<
                      typeof client.models.generateContent
                    >[0]["config"]
                  >["responseSchema"]
                >,
              temperature: 0.2,
            },
          });

          const usage = response.usageMetadata;
          if (usage) {
            promptTokens = usage.promptTokenCount || 0;
            candidatesTokens = usage.candidatesTokenCount || 0;
            totalTokens = usage.totalTokenCount || 0;
          }

          return response.text || "";
        }
      );

      rawResponseText = fallbackResult;
    } else {
      throw primaryError;
    }
  }

  const durationMs = Date.now() - startTime;

  // Clean JSON markup if needed
  let jsonString = rawResponseText.trim();
  if (jsonString.startsWith("```json")) {
    jsonString = jsonString.slice(7);
  }
  if (jsonString.startsWith("```")) {
    jsonString = jsonString.slice(3);
  }
  if (jsonString.endsWith("```")) {
    jsonString = jsonString.slice(0, -3);
  }
  jsonString = jsonString.trim();

  let parsedData: {
    overallScorecard: SpeakingOverallScorecard;
    partEvaluations: SpeakingPartEvaluation[];
  };

  try {
    parsedData = JSON.parse(jsonString);
  } catch (parseErr) {
    throw new Error(
      `Failed to parse Gemini evaluation JSON output: ${String(parseErr)}. Raw text: ${rawResponseText.slice(0, 300)}`
    );
  }

  // Enforce official IELTS overall band score calculation
  const { criteriaScores } = parsedData.overallScorecard;
  const calculatedBand = calculateIeltsOverallBand(
    criteriaScores.fluencyAndCoherence,
    criteriaScores.lexicalResource,
    criteriaScores.grammaticalRangeAndAccuracy,
    criteriaScores.pronunciation
  );
  parsedData.overallScorecard.overallBand = calculatedBand;

  const result: IeltsSpeakingEvaluationResult = {
    overallScorecard: parsedData.overallScorecard,
    partEvaluations: parsedData.partEvaluations || [],
    trace: {
      modelUsed: modelToUse,
      isFallback,
      fallbackReason,
      durationMs,
      tokensUsed: {
        promptTokens,
        candidatesTokens,
        totalTokens: totalTokens || promptTokens + candidatesTokens,
      },
      keyFingerprint: usedKeyFingerprint,
      timestamp: new Date().toISOString(),
    },
  };

  // Validate complete result structure against Zod Schema
  return IeltsSpeakingEvaluationResultSchema.parse(result);
}
