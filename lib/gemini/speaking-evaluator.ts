import { geminiRotator } from "./index";
import {
  calculateIeltsOverallBand,
  IeltsSpeakingEvaluationResult,
  IeltsSpeakingEvaluationResultSchema,
  SpeakingOverallScorecard,
  SpeakingPartEvaluation,
  SpeakingEvidence,
  speakingEvaluationJsonSchema,
} from "./speaking-schema";

export const IELTS_VERBATIM_STT_PROMPT = `
You are an expert IELTS Speech-to-Text Transcriber.
Transcribe the provided spoken audio response VERBATIM:
- Keep ALL filler words ('um', 'uh', 'er', 'like', 'you know').
- Keep ALL repetitions, false starts, and self-corrections (e.g. 'I go... I went').
- Do NOT clean up, paraphrase, or grammatically correct any mistakes made by the candidate.
- Output ONLY the verbatim transcript text without preamble.
`.trim();

export const IELTS_SPEAKING_EVALUATOR_SYSTEM_PROMPT = `
You are an expert, certified Senior IELTS Speaking Examiner with 15+ years of experience conducting and calibrating official IELTS Speaking tests.
You evaluate the candidate's spoken audio responses with rigorous adherence to the Official IELTS Speaking Band Descriptors (Public Version).

You MUST strictly analyze the raw audio acoustics alongside the spoken content and verified transcripts across the 4 official criteria:

1. FLUENCY AND COHERENCE (FC):
   - Speech rate, natural flow, length of uninterrupted runs.
   - Distinguish content-searching pauses (natural) from language-searching hesitations (penalized).
   - Identify long pauses (>1.5s), repetitions, filler frequency, and self-corrections with millisecond markers where audible.
   - Cohesive devices, discourse markers, and topic development.

2. LEXICAL RESOURCE (LR):
   - Range, flexibility, and precision of vocabulary, idiomatic language, and collocations.
   - Paraphrasing ability without noticeable vocabulary voids.
   - Flag imprecise expressions and suggest Band 7.5+ alternatives and collocations.

3. GRAMMATICAL RANGE AND ACCURACY (GRA):
   - Mix of complex vs simple structures (subordinate clauses, conditionals, passive voice, inversions).
   - Frequency and severity of errors (subject-verb agreement, tenses, prepositions, articles).
   - Flag specific grammar errors with millisecond markers if discernible.

4. PRONUNCIATION (PR) [ACOUSTIC WAVEFORM ANALYSIS]:
   - Intelligibility and listener effort.
   - Phoneme accuracy: Specific attention to Vietnamese L1 transfer issues (missing final consonants /s, z, t, d, θ, ð, v, ks/, vowel confusion /i:/ vs /ɪ/, /e/ vs /æ/).
   - Word stress (primary/secondary) and rhythm (connected speech, linking, weak forms).
   - Sentence stress and intonation patterns (avoiding monotone or flat delivery).
   - Flag mispronounced words and unclear segments with millisecond markers (startMs, endMs).

CALIBRATION & SCORING RULES:
- Band scores MUST be given in increments of 0.5 (e.g. 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0).
- Do NOT inflate scores. A Band 7 candidate must demonstrate frequent error-free sentences and flexible vocabulary.
- Compile a practiceMonologue (Band 8.0+ Model Speech): Synthesize the core ideas and stories that the candidate expressed across the session into a single, cohesive, high-scoring 120-160 word model monologue. Polish their ideas with C1/C2 vocabulary, natural discourse markers, and complex structures for them to practice shadow reading.
- Output MUST strictly conform to the provided JSON schema including the 'evidence' object.
`;

export interface SpeakingAudioInput {
  partNumber: number; // 1, 2, or 3
  itemIndex: number; // 0, 1, 2...
  promptQuestion: string;
  audioBuffer?: Buffer | Uint8Array;
  audioBase64?: string;
  mimeType?: string;
  durationSeconds?: number;
  startMs?: number;
  endMs?: number;
  liveTranscript?: string;
  verifiedTranscript?: string;
}

export interface EvaluateSpeakingOptions {
  primaryModel?: string;
  fallbackModel?: string;
  forceFallback?: boolean;
  skipVerbatimPass?: boolean;
}

/**
 * Pass 1: Transcribe single audio input verbatim using specialized STT
 */
export async function transcribeSpeakingAudioVerbatim(
  item: SpeakingAudioInput
): Promise<string> {
  const mimeType = item.mimeType || "audio/webm";
  let base64Data = item.audioBase64 || "";
  if (!base64Data && item.audioBuffer) {
    base64Data = Buffer.from(item.audioBuffer).toString("base64");
  }

  if (!base64Data) {
    return item.liveTranscript || "";
  }

  const model = process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-flash-lite";

  try {
    const result = await geminiRotator.executeWithRotation(async (client) => {
      const response = await client.models.generateContent({
        model,
        contents: [
          { text: IELTS_VERBATIM_STT_PROMPT },
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
        ],
        config: {
          temperature: 0.0,
        },
      });
      return response.text?.trim() || "";
    });
    return result || item.liveTranscript || "";
  } catch (err) {
    console.warn(
      "[SpeakingEvaluator] Verbatim transcription pass failed, falling back to live transcript:",
      err
    );
    return item.liveTranscript || "";
  }
}

/**
 * Format multimodal contents with prompt instructions, verified transcripts, and inline audio data
 */
function buildMultimodalContents(items: SpeakingAudioInput[]) {
  const contents: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  contents.push({
    text: `Please evaluate this candidate's IELTS Speaking test responses. There are ${items.length} response item(s) provided below.
Analyze acoustics alongside verified transcripts across all 4 criteria (FC, LR, GRA, PR), extract evidence with millisecond markers, and produce the structured evaluation conforming to the response JSON schema.`,
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const mimeType = item.mimeType || "audio/webm";
    let base64Data = item.audioBase64 || "";

    if (!base64Data && item.audioBuffer) {
      base64Data = Buffer.from(item.audioBuffer).toString("base64");
    }

    let promptHeader = `--- PART ${item.partNumber} (Item ${item.itemIndex + 1}): "${item.promptQuestion}" ---`;
    if (item.startMs !== undefined && item.endMs !== undefined) {
      promptHeader += ` [Recording Range: ${item.startMs}ms - ${item.endMs}ms]`;
    }
    if (item.verifiedTranscript) {
      promptHeader += `\n[Verified Verbatim Transcript: "${item.verifiedTranscript}"]`;
    } else if (item.liveTranscript) {
      promptHeader += `\n[Candidate Live Transcript: "${item.liveTranscript}"]`;
    }

    contents.push({ text: promptHeader });

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
 * Core Speaking Audio Evaluator (2-Stage Architecture)
 */
export async function evaluateSpeakingAudio(
  items: SpeakingAudioInput[],
  options: EvaluateSpeakingOptions = {}
): Promise<IeltsSpeakingEvaluationResult> {
  if (!items || items.length === 0) {
    throw new Error("No audio responses provided for speaking evaluation.");
  }

  // Pass 1: Verbatim Transcription for items lacking verified transcript
  if (!options.skipVerbatimPass) {
    for (const item of items) {
      if (!item.verifiedTranscript && (item.audioBase64 || item.audioBuffer)) {
        item.verifiedTranscript = await transcribeSpeakingAudioVerbatim(item);
      }
    }
  }

  // Pass 2: Multimodal Audio + Transcript Evaluation
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
    evidence?: SpeakingEvidence;
  };

  try {
    parsedData = JSON.parse(jsonString);
  } catch (parseErr) {
    throw new Error(
      `Failed to parse Gemini evaluation JSON output: ${String(parseErr)}. Raw text: ${rawResponseText.slice(0, 300)}`
    );
  }

  // Calculate overall band using official IELTS rounding formula
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
    evidence: parsedData.evidence,
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

  return IeltsSpeakingEvaluationResultSchema.parse(result);
}
