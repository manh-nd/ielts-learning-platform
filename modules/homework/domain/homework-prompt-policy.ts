/**
 * Pure, framework-agnostic prompt policies for Homework Assignments (Issue #95, ADR-0009).
 *
 * Domain Invariants:
 * - A discrete Speaking HomeworkAssignment must have between 1 and 3 discrete prompts.
 * - Prompt text must be non-empty and not exceed 2000 characters.
 * - Each prompt must target IELTS Speaking Part 1, 2, or 3.
 * - Prompt normalization is strictly deterministic (no UUID generation in pure domain).
 *
 * Strict boundary rule: Zero imports of React, Next.js, database/Drizzle,
 * storage SDKs, Gemini SDK, telemetry, or fetch.
 */

export const MIN_HOMEWORK_PROMPTS = 1;
export const MAX_HOMEWORK_PROMPTS = 3;
export const MAX_HOMEWORK_PROMPT_LENGTH = 2000;
export const VALID_HOMEWORK_PARTS = [1, 2, 3] as const;

export type HomeworkPartNumber = (typeof VALID_HOMEWORK_PARTS)[number];

export type PromptValidationIssue =
  | { kind: "invalid_prompt_count"; count: number }
  | { kind: "empty_text"; index: number }
  | { kind: "text_too_long"; index: number; length: number }
  | { kind: "invalid_part"; index: number; partNumber: number };

export interface NormalizedPromptItem {
  promptId?: string;
  text: string;
  partNumber: HomeworkPartNumber;
  subPrompts?: string[];
}

/**
 * Evaluates validation rules for a single prompt input.
 */
export function validatePromptItemInput(
  p: { text?: string; partNumber?: unknown },
  index: number
): PromptValidationIssue | null {
  const text = p.text?.trim();
  if (!text) {
    return { kind: "empty_text", index };
  }
  if (text.length > MAX_HOMEWORK_PROMPT_LENGTH) {
    return { kind: "text_too_long", index, length: text.length };
  }
  const part = Number(p.partNumber);
  if (!VALID_HOMEWORK_PARTS.includes(part as HomeworkPartNumber)) {
    return { kind: "invalid_part", index, partNumber: part };
  }
  return null;
}

/**
 * Evaluates validation rules across the prompt list.
 */
export function validatePromptList(
  prompts: unknown
): PromptValidationIssue | null {
  if (
    !Array.isArray(prompts) ||
    prompts.length < MIN_HOMEWORK_PROMPTS ||
    prompts.length > MAX_HOMEWORK_PROMPTS
  ) {
    return {
      kind: "invalid_prompt_count",
      count: Array.isArray(prompts) ? prompts.length : 0,
    };
  }

  for (let i = 0; i < prompts.length; i++) {
    const issue = validatePromptItemInput(prompts[i], i);
    if (issue) return issue;
  }

  return null;
}

/**
 * Deterministically normalizes prompt item fields without generating IDs.
 * Application layer is responsible for supplying a UUID if promptId is absent.
 */
export function normalizePromptItem(p: {
  promptId?: string;
  text: string;
  partNumber: number;
  subPrompts?: string[];
}): NormalizedPromptItem {
  const trimmedId = p.promptId?.trim();
  return {
    ...(trimmedId ? { promptId: trimmedId } : {}),
    text: p.text.trim(),
    partNumber: Number(p.partNumber) as HomeworkPartNumber,
    subPrompts: Array.isArray(p.subPrompts)
      ? p.subPrompts.map((s) => s.trim()).filter((s) => s.length > 0)
      : undefined,
  };
}
