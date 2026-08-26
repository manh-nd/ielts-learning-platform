import { describe, it, expect } from "bun:test";
import {
  hasForeignScript,
  sanitizeTranscriptText,
  GLOBAL_EXAM_GUARD_PROMPT,
  VOICE_ANCHOR_PROMPT,
} from "./live-guards";

describe("Live Guards & Foreign Script Filter", () => {
  it("should detect non-Latin foreign scripts (Hangul, Japanese, Chinese, Arabic, Cyrillic)", () => {
    expect(hasForeignScript("안녕하세요")).toBe(true); // Korean
    expect(hasForeignScript("こんにちは")).toBe(true); // Japanese
    expect(hasForeignScript("你好")).toBe(true); // Chinese
    expect(hasForeignScript("مرحبا")).toBe(true); // Arabic
    expect(hasForeignScript("Привет")).toBe(true); // Russian
    expect(hasForeignScript("Hello world")).toBe(false); // English
    expect(hasForeignScript("Xin chào Việt Nam")).toBe(false); // Vietnamese
  });

  it("should sanitize and remove foreign script hallucinations while preserving Latin text", () => {
    expect(sanitizeTranscriptText("Hello 안녕하세요 world")).toBe(
      "Hello  world"
    );
    expect(sanitizeTranscriptText("I like traveling to Da Nang.")).toBe(
      "I like traveling to Da Nang."
    );
    expect(sanitizeTranscriptText("日本語")).toBe("");
  });

  it("should provide valid global exam guard prompt and voice anchor", () => {
    expect(GLOBAL_EXAM_GUARD_PROMPT).toContain(
      "CRITICAL LANGUAGE & TRANSCRIPTION CONSTRAINT"
    );
    expect(VOICE_ANCHOR_PROMPT).toContain("Dr. Harrison");
  });
});
