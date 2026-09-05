import {
  validatePromptList,
  normalizePromptItem,
} from "../domain/homework-prompt-policy";
import { isSubmissionDeadlineInFuture } from "../domain/homework-deadline-policy";
import type { HomeworkPromptItem } from "../domain/homework-types";
import { ValidationError } from "@/lib/errors";

/**
 * Validates and normalizes prompt items (1 to 3 items, valid part number, auto-generated IDs in application layer).
 */
export function validateAndNormalizePrompts(
  prompts: unknown
): HomeworkPromptItem[] {
  const issue = validatePromptList(prompts);
  if (issue) {
    if (issue.kind === "invalid_prompt_count") {
      throw new ValidationError(
        "Một bài tập Speaking phải có từ 1 đến 3 câu hỏi (prompt items)."
      );
    }
    if (issue.kind === "empty_text") {
      throw new ValidationError(
        `Nội dung câu hỏi thứ ${issue.index + 1} không được để trống.`
      );
    }
    if (issue.kind === "text_too_long") {
      throw new ValidationError(
        `Nội dung câu hỏi thứ ${issue.index + 1} không được vượt quá 2000 ký tự.`
      );
    }
    if (issue.kind === "invalid_part") {
      throw new ValidationError(
        `Phần thi (Part) cho câu hỏi thứ ${issue.index + 1} phải là 1, 2 hoặc 3.`
      );
    }
  }

  const rawList = prompts as Array<{
    promptId?: string;
    text: string;
    partNumber: number;
    subPrompts?: string[];
  }>;

  return rawList.map((p) => {
    const normalized = normalizePromptItem(p);
    return {
      ...normalized,
      promptId: normalized.promptId || crypto.randomUUID(),
    };
  });
}

/**
 * Parses and validates submission deadline.
 */
export function parseAndValidateDeadline(
  deadlineInput: Date | string,
  now: Date,
  mustBeInFuture = true
): Date {
  const deadline =
    deadlineInput instanceof Date ? deadlineInput : new Date(deadlineInput);

  if (isNaN(deadline.getTime())) {
    throw new ValidationError("Hạn nộp bài (submissionDeadline) không hợp lệ.");
  }

  if (mustBeInFuture && !isSubmissionDeadlineInFuture(deadline, now)) {
    throw new ValidationError(
      "Hạn nộp bài phải là một mốc thời gian trong tương lai."
    );
  }

  return deadline;
}

/**
 * Validates title for new assignment creation.
 */
export function validateAssignmentTitleForCreation(title: unknown): string {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (!trimmed || trimmed.length > 255) {
    throw new ValidationError(
      "Tiêu đề bài tập là bắt buộc và không được vượt quá 255 ký tự."
    );
  }
  return trimmed;
}

/**
 * Validates title for assignment update.
 */
export function validateAssignmentTitleForUpdate(title: string): string {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 255) {
    throw new ValidationError(
      "Tiêu đề bài tập không được để trống và không vượt quá 255 ký tự."
    );
  }
  return trimmed;
}

/**
 * Validates instructions length.
 */
export function validateAssignmentInstructions(
  instructions: string | null | undefined
): string | null {
  if (instructions === null || instructions === undefined) return null;
  const trimmed = instructions.trim();
  if (trimmed.length > 5000) {
    throw new ValidationError(
      "Hướng dẫn làm bài không được vượt quá 5000 ký tự."
    );
  }
  return trimmed || null;
}
