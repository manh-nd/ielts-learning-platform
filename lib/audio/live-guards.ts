/**
 * Regex detecting non-Latin foreign scripts that occasionally appear as Gemini STT hallucinations:
 * - Korean (Hangul): \uac00-\ud7af, \u1100-\u11ff, \u3130-\u318f
 * - Japanese (Hiragana/Katakana): \u3040-\u30ff
 * - Chinese (Hanzi/Kanji): \u3400-\u4dbf, \u4e00-\u9fff
 * - Arabic: \u0600-\u06ff, \u0750-\u077f
 * - Thai: \u0e00-\u0e7f
 * - Hindi/Devanagari: \u0900-\u097f
 * - Cyrillic (Russian): \u0400-\u04ff
 * - Myanmar: \u1000-\u109f
 * - Sinhala: \u0d80-\u0dff
 * - Tamil: \u0b80-\u0bff
 */
export const FOREIGN_SCRIPT_REGEX =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u0600-\u06ff\u0750-\u077f\u0e00-\u0e7f\u0900-\u097f\u0400-\u04ff\u1000-\u109f\u0d80-\u0dff\u0b80-\u0bff]/;

/**
 * Checks if the given text contains any foreign non-Latin scripts.
 */
export function hasForeignScript(text: string): boolean {
  return FOREIGN_SCRIPT_REGEX.test(text);
}

/**
 * Filters out foreign script hallucinations from transcript text.
 */
export function sanitizeTranscriptText(text: string): string {
  if (!text) return "";
  if (hasForeignScript(text)) {
    // If the whole string is mostly non-Latin hallucination, return empty or filtered
    return text
      .replace(new RegExp(FOREIGN_SCRIPT_REGEX.source, "g"), "")
      .trim();
  }
  return text;
}

export const GLOBAL_EXAM_GUARD_PROMPT = `
CRITICAL LANGUAGE & TRANSCRIPTION CONSTRAINT:
The candidate is a Vietnamese learner taking an official IELTS Speaking exam in English.
Any input transcribed in ANY non-Latin script (Korean, Japanese, Chinese, Arabic, Thai, Hindi, Russian, etc.) is an audio artifact / STT hallucination — NOT candidate speech.

When this happens:
1. Completely ignore the mis-transcribed artifact.
2. Do NOT attempt to respond in or translate from the wrongly detected foreign language.
3. Stay strictly in character as a professional British/Standard English IELTS Examiner.
`.trim();

export const VOICE_ANCHOR_PROMPT = `
Voice Anchor:
You are speaking as Dr. Harrison, a certified Senior IELTS Examiner. You must always maintain a consistent, polite, and neutral British/Standard English accent throughout the entire exam. Do not drift in pitch, cadence, or tone under any circumstances.
`.trim();
