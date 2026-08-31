import { geminiRotator } from "./index";
import {
  calculateIeltsOverallBand,
  IeltsSpeakingEvaluationResult,
  IeltsSpeakingEvaluationResultSchema,
  SpeakingOverallScorecard,
  SpeakingPartEvaluation,
  SpeakingEvidence,
  speakingEvaluationJsonSchema,
  PracticeFeedback,
  PracticeFeedbackSchema,
  PracticeEvaluationResult,
  PracticeEvaluationResultSchema,
  practiceFeedbackJsonSchema,
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

  // Sanitize criteria scores to valid 0.5 increments
  const { criteriaScores } = parsedData.overallScorecard;
  if (criteriaScores) {
    for (const key of [
      "fluencyAndCoherence",
      "lexicalResource",
      "grammaticalRangeAndAccuracy",
      "pronunciation",
    ] as const) {
      if (typeof criteriaScores[key] === "number") {
        criteriaScores[key] = Math.max(
          0,
          Math.min(9, Math.round(criteriaScores[key] * 2) / 2)
        );
      }
    }
  }

  // Calculate overall band using official IELTS rounding formula
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

/**
 * ============================================================================
 * PART 1 SPEAKING PRACTICE EVALUATION ENGINE (Issue #56, Experiment C)
 * ============================================================================
 */

export const PART_1_PRACTICE_FEEDBACK_SYSTEM_PROMPT = `
You are an expert, encouraging IELTS Speaking Coach providing formative feedback on a learner's partial practice session (Part 1 only).

CANONICAL DOMAIN RULES:
1. This is a PARTIAL IELTS Speaking Practice session (Part 1 only), NOT a certified IELTS test.
2. You MUST NOT claim: "Your official IELTS Speaking band is X" or imply full test equivalence.
3. If the candidate provides sufficient spoken evidence (at least one complete communicative sentence):
   - Set "evidenceSufficiency": "sufficient_for_practice_feedback"
   - You MAY provide estimated criterion performance (0.0 - 9.0 in 0.5 increments: e.g. 5.5, 6.0, 6.5, 7.0, 7.5, 8.0) for FC, LR, GRA, PR strictly as a formative coaching reference.
4. If the candidate provides DEGRADED or INSUFFICIENT evidence (e.g. 1-2 words like "Um... no.", mostly silence, unintelligible noise):
   - Set "evidenceSufficiency": "limited"
   - OMIT the "estimatedPerformance" object completely. Do NOT generate speculative scores.
   - Explain in the summary that the response was too short to evaluate criterion levels reliably.
5. EVIDENCE & GROUNDING INTEGRITY:
   - In "strengths" and "priorities", when providing "transcriptQuote", it MUST be an EXACT VERBATIM substring of what the learner actually said.
   - NEVER place commentary, analysis, or thoughts inside the "transcriptQuote" field. Put observations solely in the "observation" field.
   - If the candidate makes grammatical errors (e.g. "prefers", "save", "buyed"), quote them EXACTLY as spoken. Do NOT silently correct them in the quote.
6. ACOUSTIC GROUNDING:
   - For Fluency & Coherence (FC) and Pronunciation (PR), observe acoustic features audible in the raw audio (hesitation fillers, pacing, sentence stress, intonation, L1 transfer patterns).
7. SUMMARY & COACHING:
   - Provide a constructive, encouraging summary and actionable priority improvements for Part 1.
`.trim();

export interface SpeakingPracticePart1Input {
  practiceId?: string;
  topicTitle: string;
  questions: string[];
  audioBuffer?: Buffer | Uint8Array;
  audioBase64?: string;
  mimeType?: string;
  durationSeconds?: number;
  liveTranscript?: string;
  turnMarkers?: Array<{
    partNumber?: number;
    itemIndex?: number;
    promptQuestion: string;
    startMs: number;
    endMs: number;
    liveTranscript?: string;
  }>;
}

export interface EvaluatePracticePart1Options {
  primaryModel?: string;
  fallbackModels?: string[];
  primaryDeadlineMs?: number;
}

/**
 * Canonical Post-Session STT using Flash-Lite Verbatim Transcription
 */
export async function transcribePracticeAudioVerbatim(
  audioBase64: string,
  mimeType: string,
  liveTranscript?: string
): Promise<{
  flashLiteTranscript: string;
  bestTranscript: string;
}> {
  let flashLiteTranscript = "";

  // Canonical Flash-Lite Verbatim Transcription
  try {
    const result = await geminiRotator.executeWithRotation(async (client) => {
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: [
          { text: IELTS_VERBATIM_STT_PROMPT },
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
        ],
        config: {
          temperature: 0.0,
        },
      });
      return response.text?.trim() || "";
    });
    flashLiteTranscript = result;
  } catch (err) {
    console.warn(
      "[PracticeEvaluator] Flash-Lite transcription failed, using live transcript fallback:",
      err
    );
    flashLiteTranscript = liveTranscript || "";
  }

  const bestTranscript = flashLiteTranscript || liveTranscript || "";

  return {
    flashLiteTranscript,
    bestTranscript,
  };
}

/**
 * Backward-compatible alias for post-session transcription
 */
export const transcribePracticeAudioComparison =
  transcribePracticeAudioVerbatim;

/**
 * Post-Session Evaluator for Part 1 Speaking Practice (Single-Call Multimodal Architecture)
 */
export async function evaluateSpeakingPracticePart1(
  input: SpeakingPracticePart1Input,
  options: EvaluatePracticePart1Options = {}
): Promise<PracticeEvaluationResult> {
  const {
    topicTitle,
    questions,
    audioBuffer,
    mimeType = "audio/webm",
    durationSeconds: _durationSeconds = 60,
    liveTranscript = "",
    turnMarkers = [],
  } = input;

  let base64Audio = input.audioBase64 || "";
  if (!base64Audio && audioBuffer) {
    base64Audio = Buffer.from(audioBuffer).toString("base64");
  }

  const startTime = Date.now();

  // Step 1: Run canonical post-session Flash-Lite verbatim transcription
  let transcriptionData = {
    flashLiteTranscript: liveTranscript,
    bestTranscript: liveTranscript,
  };

  if (base64Audio) {
    transcriptionData = await transcribePracticeAudioVerbatim(
      base64Audio,
      mimeType,
      liveTranscript
    );
  }

  // Step 2: Build Single Multimodal Evaluation Prompt (OriginalAudio attached exactly ONCE)
  const promptText = `
Candidate Spoken Practice Input:
- Practice Mode: Part 1 Speaking Practice
- Topic Theme: "${topicTitle}"
- Questions Asked in Order:
${questions.map((q, idx) => `  ${idx + 1}. "${q}"`).join("\n")}
- Candidate Turn Markers:
${
  turnMarkers.length > 0
    ? turnMarkers
        .map(
          (m, idx) =>
            `  Turn ${idx + 1} (${m.startMs}ms - ${m.endMs}ms): Question "${m.promptQuestion}" | Live Transcript: "${m.liveTranscript || ""}"`
        )
        .join("\n")
    : "  Continuous single recording session."
}
- Post-Session Best Verbatim Transcript:
"${transcriptionData.bestTranscript}"

- Audio Input: The complete candidate audio recording is attached inline. Analyze acoustic delivery (intonation, sentence stress, pauses, speech rate, L1 transfer) alongside the transcript to produce formative PracticeFeedback according to the schema.
`.trim();

  const contents: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: promptText }];

  if (base64Audio) {
    contents.push({
      inlineData: {
        mimeType,
        data: base64Audio,
      },
    });
  }

  // Step 3: Model Cascade Hierarchy (gemini-3.7-flash -> gemini-3.6-flash -> gemini-3.5-flash)
  const candidateModels = [
    options.primaryModel ||
      process.env.GEMINI_SPEAKING_PRACTICE_MODEL ||
      "gemini-3.7-flash",
    ...(options.fallbackModels || ["gemini-3.6-flash", "gemini-3.5-flash"]),
  ];

  const primaryDeadlineMs =
    options.primaryDeadlineMs ||
    Number(process.env.GEMINI_EVALUATION_DEADLINE_MS) ||
    8000;

  let rawResponseText = "";
  let evaluatedModel = candidateModels[0];
  let isFallback = false;
  let fallbackReason: string | null = null;
  let fallbackModel: string | undefined = undefined;
  let primaryElapsedMs: number | undefined = undefined;
  let usedKeyFingerprint = "key_***unknown";
  let promptTokens = 0;
  let candidatesTokens = 0;
  let totalTokens = 0;

  // Flag ensuring late primary resolution cannot overwrite fallback results
  let isPrimaryAbandoned = false;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const currentModel = candidateModels[mIdx];
    const isPrimaryAttempt = mIdx === 0;

    try {
      // For 503 UNAVAILABLE on primary: short retry with jitter; on repeated 503, cascade
      let retryCount = 0;
      const maxShortRetries = isPrimaryAttempt ? 1 : 0;

      while (retryCount <= maxShortRetries) {
        try {
          const executeGenerate = async () => {
            return await geminiRotator.executeWithRotation(
              async (client, _key, keyFingerprint) => {
                if (isPrimaryAttempt && isPrimaryAbandoned) {
                  throw new Error("PRIMARY_TIMEOUT");
                }

                usedKeyFingerprint = keyFingerprint;
                const response = await client.models.generateContent({
                  model: currentModel,
                  contents: contents as Parameters<
                    typeof client.models.generateContent
                  >[0]["contents"],
                  config: {
                    systemInstruction: PART_1_PRACTICE_FEEDBACK_SYSTEM_PROMPT,
                    responseMimeType: "application/json",
                    responseSchema:
                      practiceFeedbackJsonSchema as unknown as NonNullable<
                        NonNullable<
                          Parameters<
                            typeof client.models.generateContent
                          >[0]["config"]
                        >["responseSchema"]
                      >,
                  },
                });

                if (isPrimaryAttempt && isPrimaryAbandoned) {
                  throw new Error("PRIMARY_TIMEOUT");
                }

                const usage = response.usageMetadata;
                if (usage) {
                  promptTokens = usage.promptTokenCount || 0;
                  candidatesTokens = usage.candidatesTokenCount || 0;
                  totalTokens = usage.totalTokenCount || 0;
                }

                return response.text || "";
              }
            );
          };

          let evalResult = "";

          // For primary model, race with deadline budget (P0-1)
          if (isPrimaryAttempt && primaryDeadlineMs > 0) {
            let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
            const timeoutPromise = new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                isPrimaryAbandoned = true;
                reject(new Error("PRIMARY_TIMEOUT"));
              }, primaryDeadlineMs);
            });

            try {
              evalResult = await Promise.race([
                executeGenerate(),
                timeoutPromise,
              ]);
            } finally {
              if (timeoutHandle) clearTimeout(timeoutHandle);
            }
          } else {
            evalResult = await executeGenerate();
          }

          rawResponseText = evalResult;
          evaluatedModel = currentModel;
          if (mIdx > 0 && !isFallback) {
            isFallback = true;
            fallbackReason = `CASCADED_TO_${currentModel.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
            fallbackModel = currentModel;
          }
          break; // Succeeded on current model
        } catch (innerErr: unknown) {
          const errMsg = (innerErr as Error)?.message || String(innerErr);

          if (
            errMsg === "PRIMARY_TIMEOUT" ||
            errMsg.includes("PRIMARY_TIMEOUT")
          ) {
            isPrimaryAbandoned = true;
            primaryElapsedMs = Date.now() - startTime;
            isFallback = true;
            fallbackReason = "PRIMARY_TIMEOUT";
            fallbackModel = candidateModels[1] || "gemini-3.6-flash";
            console.warn(
              `[PracticeEvaluator] Primary model ${currentModel} exceeded deadline (${primaryElapsedMs}ms > ${primaryDeadlineMs}ms). Cascading to ${fallbackModel}...`
            );
            break; // Break inner retry loop and cascade to fallback model
          }

          const is503 =
            errMsg.includes("503") || errMsg.includes("UNAVAILABLE");

          if (is503 && retryCount < maxShortRetries) {
            retryCount++;
            // Short jitter wait (200-400ms)
            await new Promise((resolve) =>
              setTimeout(resolve, 200 + Math.random() * 200)
            );
            continue;
          }
          throw innerErr;
        }
      }

      if (rawResponseText) {
        break; // Finished successfully
      }
    } catch (modelErr) {
      console.warn(
        `[PracticeEvaluator] Model ${currentModel} failed: ${(modelErr as Error)?.message || modelErr}. Cascading...`
      );
      if (mIdx === candidateModels.length - 1) {
        throw modelErr; // All models in hierarchy failed
      }
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

  let practiceFeedback: PracticeFeedback;
  try {
    const rawParsed = JSON.parse(jsonString);

    // Sanitize and round estimatedPerformance scores to valid IELTS 0.5 increments
    if (
      rawParsed &&
      typeof rawParsed === "object" &&
      rawParsed.estimatedPerformance &&
      typeof rawParsed.estimatedPerformance === "object"
    ) {
      const est = rawParsed.estimatedPerformance as Record<string, unknown>;
      const scoreKeys = [
        "fluencyAndCoherence",
        "lexicalResource",
        "grammaticalRangeAndAccuracy",
        "pronunciation",
      ] as const;

      for (const key of scoreKeys) {
        const val = est[key];
        if (typeof val === "number" && !Number.isNaN(val)) {
          est[key] = Math.max(0, Math.min(9, Math.round(val * 2) / 2));
        } else if (typeof val === "string") {
          const parsed = parseFloat(val);
          if (!Number.isNaN(parsed)) {
            est[key] = Math.max(0, Math.min(9, Math.round(parsed * 2) / 2));
          } else {
            delete est[key];
          }
        }
      }
    }

    practiceFeedback = PracticeFeedbackSchema.parse(rawParsed);
  } catch (parseErr) {
    throw new Error(
      `Failed to parse PracticeFeedback JSON output: ${String(parseErr)}. Raw response: ${rawResponseText.slice(0, 300)}`
    );
  }

  const evaluationResult: PracticeEvaluationResult = {
    practiceFeedback,
    transcripts: {
      bestTranscript: transcriptionData.bestTranscript,
      liveTranscript,
      flashLiteTranscript: transcriptionData.flashLiteTranscript,
    },
    trace: {
      modelUsed: evaluatedModel,
      isFallback,
      fallbackReason,
      fallbackModel,
      primaryElapsedMs,
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

  return PracticeEvaluationResultSchema.parse(evaluationResult);
}
