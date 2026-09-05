import { describe, it, expect } from "bun:test";
import {
  validatePromptList,
  validatePromptItemInput,
  normalizePromptItem,
  MIN_HOMEWORK_PROMPTS,
  MAX_HOMEWORK_PROMPTS,
  MAX_HOMEWORK_PROMPT_LENGTH,
  VALID_HOMEWORK_PARTS,
} from "./homework-prompt-policy";
import {
  isSubmissionDeadlineInFuture,
  canExtendSubmissionDeadline,
} from "./homework-deadline-policy";
import {
  canEditHomeworkAssignment,
  canEditHomeworkPrompts,
  canDeleteHomeworkAssignment,
  canTransitionAssignmentStatus,
} from "./homework-assignment-lifecycle";

describe("Homework Assignment Pure Domain Policies (Issue #95, ADR-0009)", () => {
  describe("Prompt Policy", () => {
    it("exports canonical prompt limits and valid parts", () => {
      expect(MIN_HOMEWORK_PROMPTS).toBe(1);
      expect(MAX_HOMEWORK_PROMPTS).toBe(3);
      expect(MAX_HOMEWORK_PROMPT_LENGTH).toBe(2000);
      expect(VALID_HOMEWORK_PARTS).toEqual([1, 2, 3]);
    });

    it("accepts valid prompt counts: 1, 2, and 3 discrete prompts", () => {
      expect(validatePromptList([{ text: "Q1", partNumber: 1 }])).toBeNull();

      expect(
        validatePromptList([
          { text: "Q1", partNumber: 1 },
          { text: "Q2", partNumber: 2 },
        ])
      ).toBeNull();

      expect(
        validatePromptList([
          { text: "Q1", partNumber: 1 },
          { text: "Q2", partNumber: 2 },
          { text: "Q3", partNumber: 3 },
        ])
      ).toBeNull();
    });

    it("rejects prompt count outside 1-3 range", () => {
      // 0 prompts
      expect(validatePromptList([])).toEqual({
        kind: "invalid_prompt_count",
        count: 0,
      });

      // Non-array
      expect(validatePromptList(null)).toEqual({
        kind: "invalid_prompt_count",
        count: 0,
      });

      // 4 prompts
      expect(
        validatePromptList([
          { text: "Q1", partNumber: 1 },
          { text: "Q2", partNumber: 2 },
          { text: "Q3", partNumber: 3 },
          { text: "Q4", partNumber: 3 },
        ])
      ).toEqual({
        kind: "invalid_prompt_count",
        count: 4,
      });
    });

    it("rejects empty or whitespace-only prompt text", () => {
      expect(validatePromptItemInput({ text: "", partNumber: 1 }, 0)).toEqual({
        kind: "empty_text",
        index: 0,
      });

      expect(
        validatePromptItemInput({ text: "   \n\t  ", partNumber: 2 }, 1)
      ).toEqual({
        kind: "empty_text",
        index: 1,
      });
    });

    it("rejects prompt text exceeding 2000 characters", () => {
      const longText = "a".repeat(2001);
      expect(
        validatePromptItemInput({ text: longText, partNumber: 1 }, 0)
      ).toEqual({
        kind: "text_too_long",
        index: 0,
        length: 2001,
      });
    });

    it("rejects invalid Part numbers and accepts Parts 1, 2, 3", () => {
      expect(validatePromptItemInput({ text: "Q1", partNumber: 0 }, 0)).toEqual(
        {
          kind: "invalid_part",
          index: 0,
          partNumber: 0,
        }
      );

      expect(validatePromptItemInput({ text: "Q1", partNumber: 4 }, 0)).toEqual(
        {
          kind: "invalid_part",
          index: 0,
          partNumber: 4,
        }
      );

      expect(
        validatePromptItemInput({ text: "Q1", partNumber: 1 }, 0)
      ).toBeNull();
      expect(
        validatePromptItemInput({ text: "Q1", partNumber: 2 }, 0)
      ).toBeNull();
      expect(
        validatePromptItemInput({ text: "Q1", partNumber: 3 }, 0)
      ).toBeNull();
    });

    it("deterministically normalizes prompt fields without generating UUIDs", () => {
      // With explicit promptId
      const normalizedWithId = normalizePromptItem({
        promptId: "  custom_id_123  ",
        text: "  Describe your favorite movie.  ",
        partNumber: 2,
        subPrompts: ["  Who directed it?  ", "", "   ", "Why do you like it?"],
      });

      expect(normalizedWithId).toEqual({
        promptId: "custom_id_123",
        text: "Describe your favorite movie.",
        partNumber: 2,
        subPrompts: ["Who directed it?", "Why do you like it?"],
      });

      // Without promptId (domain does NOT generate UUID)
      const normalizedWithoutId = normalizePromptItem({
        text: "  What is your hometown?  ",
        partNumber: 1,
      });

      expect(normalizedWithoutId.promptId).toBeUndefined();
      expect(normalizedWithoutId.text).toBe("What is your hometown?");
      expect(normalizedWithoutId.partNumber).toBe(1);
      expect(normalizedWithoutId.subPrompts).toBeUndefined();
    });
  });

  describe("Deadline Policy", () => {
    const baseInstant = new Date("2026-09-05T12:00:00.000Z");

    it("evaluates whether deadline is strictly in the future relative to explicit now", () => {
      const future = new Date("2026-09-05T12:00:01.000Z");
      const same = new Date("2026-09-05T12:00:00.000Z");
      const past = new Date("2026-09-05T11:59:59.000Z");

      expect(isSubmissionDeadlineInFuture(future, baseInstant)).toBe(true);
      expect(isSubmissionDeadlineInFuture(same, baseInstant)).toBe(false);
      expect(isSubmissionDeadlineInFuture(past, baseInstant)).toBe(false);
    });

    it("evaluates whether published deadline can only be extended (never shortened)", () => {
      const existing = new Date("2026-09-10T00:00:00.000Z");
      const extended = new Date("2026-09-12T00:00:00.000Z");
      const unchanged = new Date("2026-09-10T00:00:00.000Z");
      const shortened = new Date("2026-09-08T00:00:00.000Z");

      expect(canExtendSubmissionDeadline(existing, extended)).toBe(true);
      expect(canExtendSubmissionDeadline(existing, unchanged)).toBe(true);
      expect(canExtendSubmissionDeadline(existing, shortened)).toBe(false);
    });
  });

  describe("Lifecycle Policy", () => {
    it("allows editing draft and published assignments, blocks editing archived assignments", () => {
      expect(canEditHomeworkAssignment("draft")).toBe(true);
      expect(canEditHomeworkAssignment("published")).toBe(true);
      expect(canEditHomeworkAssignment("archived")).toBe(false);
    });

    it("allows editing prompts ONLY in draft status (published prompts are immutable)", () => {
      expect(canEditHomeworkPrompts("draft")).toBe(true);
      expect(canEditHomeworkPrompts("published")).toBe(false);
      expect(canEditHomeworkPrompts("archived")).toBe(false);
    });

    it("allows deleting assignments ONLY in draft status", () => {
      expect(canDeleteHomeworkAssignment("draft")).toBe(true);
      expect(canDeleteHomeworkAssignment("published")).toBe(false);
      expect(canDeleteHomeworkAssignment("archived")).toBe(false);
    });

    it("evaluates status transitions preserving same-state and canonical rules", () => {
      // Same-state preservation
      expect(canTransitionAssignmentStatus("draft", "draft")).toBe(true);
      expect(canTransitionAssignmentStatus("published", "published")).toBe(
        true
      );

      // Forward progression
      expect(canTransitionAssignmentStatus("draft", "published")).toBe(true);
      expect(canTransitionAssignmentStatus("draft", "archived")).toBe(true);
      expect(canTransitionAssignmentStatus("published", "archived")).toBe(true);

      // Forbidden: published cannot return to draft
      expect(canTransitionAssignmentStatus("published", "draft")).toBe(false);

      // Forbidden: archived is terminal
      expect(canTransitionAssignmentStatus("archived", "draft")).toBe(false);
      expect(canTransitionAssignmentStatus("archived", "published")).toBe(
        false
      );
      expect(canTransitionAssignmentStatus("archived", "archived")).toBe(false);
    });
  });
});
