import { getIeltsBandScoreIssue } from "../domain/ielts-band-score";
import {
  calculateIeltsSpeakingOverallBand,
  type SpeakingReviewAnnotationItem,
  type SpeakingReviewAnnotationCategory,
} from "../domain/homework-types";
import type { PublishAssessmentInput } from "./homework-inputs";
import { ValidationError } from "@/lib/errors";

export { IELTS_BAND_SCORE } from "../domain/ielts-band-score";

export function validateBandScore(name: string, score: unknown): number {
  const issue = getIeltsBandScoreIssue(score);
  if (issue === "not_number") {
    throw new ValidationError(`Điểm tiêu chí ${name} không hợp lệ.`);
  }
  if (issue === "out_of_range") {
    throw new ValidationError(
      `Điểm tiêu chí ${name} phải nằm trong thang điểm từ 0.0 đến 9.0.`
    );
  }
  if (issue === "invalid_step") {
    throw new ValidationError(
      `Điểm tiêu chí ${name} phải là số nguyên hoặc có đuôi .5.`
    );
  }
  return score as number;
}

const CANONICAL_CATEGORIES = new Set([
  "pronunciation",
  "grammar",
  "lexical",
  "fluency",
]);

export function validateAndNormalizeSpeakingAnnotations(
  annotations: unknown,
  assignmentPrompts: Array<{ promptId: string; partNumber: 1 | 2 | 3 }>,
  audioResponses: Array<{ promptId: string; durationMs?: number }>
): SpeakingReviewAnnotationItem[] {
  if (!annotations) {
    return [];
  }
  if (!Array.isArray(annotations)) {
    throw new ValidationError("Danh sách nhận xét (annotations) không hợp lệ.");
  }

  const promptMap = new Map(
    assignmentPrompts.map((p) => [p.promptId, p.partNumber])
  );
  const audioMap = new Map(
    audioResponses.map((a) => [a.promptId, a.durationMs])
  );

  return annotations.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new ValidationError(`Nhận xét #${index + 1} không đúng định dạng.`);
    }

    const {
      id,
      promptId,
      timestampSeconds,
      category,
      teacherComment,
      originalQuote,
      createdAt,
    } = item as Record<string, unknown>;

    if (typeof id !== "string" || !id.trim()) {
      throw new ValidationError(
        `Nhận xét #${index + 1} thiếu mã định danh (id).`
      );
    }

    if (typeof promptId !== "string" || !promptId.trim()) {
      throw new ValidationError(
        `Nhận xét #${index + 1} thiếu mã câu hỏi (promptId).`
      );
    }

    const authoritativePartNumber = promptMap.get(promptId);
    if (!authoritativePartNumber) {
      throw new ValidationError(
        `Nhận xét #${index + 1} gắn với câu hỏi không tồn tại trong bài tập (${promptId}).`
      );
    }

    if (!audioMap.has(promptId)) {
      throw new ValidationError(
        `Nhận xét #${index + 1} gắn với câu hỏi chưa có bản ghi âm (${promptId}).`
      );
    }

    if (typeof category !== "string" || !CANONICAL_CATEGORIES.has(category)) {
      throw new ValidationError(
        `Nhận xét #${index + 1} có danh mục không hợp lệ: ${category}. Danh mục hợp lệ: pronunciation, grammar, lexical, fluency.`
      );
    }

    if (
      typeof timestampSeconds !== "number" ||
      !Number.isFinite(timestampSeconds) ||
      timestampSeconds < 0
    ) {
      throw new ValidationError(
        `Nhận xét #${index + 1} có mốc thời gian không hợp lệ (phải là số >= 0).`
      );
    }

    const durationMs = audioMap.get(promptId);
    if (typeof durationMs === "number" && durationMs > 0) {
      const maxSeconds = durationMs / 1000;
      // Allow a small grace margin of 0.5s for rounding or player boundary
      if (timestampSeconds > maxSeconds + 0.5) {
        throw new ValidationError(
          `Nhận xét #${index + 1} có mốc thời gian (${timestampSeconds}s) vượt quá thời lượng ghi âm (${maxSeconds.toFixed(1)}s).`
        );
      }
    }

    if (typeof teacherComment !== "string" || !teacherComment.trim()) {
      throw new ValidationError(
        `Nhận xét #${index + 1} có nội dung nhận xét của giáo viên bị trống.`
      );
    }

    return {
      id: id.trim(),
      promptId: promptId.trim(),
      partNumber: authoritativePartNumber,
      timestampSeconds,
      category: category as SpeakingReviewAnnotationCategory,
      originalQuote:
        typeof originalQuote === "string" && originalQuote.trim()
          ? originalQuote.trim()
          : undefined,
      teacherComment: teacherComment.trim(),
      createdAt:
        typeof createdAt === "string" && createdAt.trim()
          ? createdAt.trim()
          : new Date().toISOString(),
    };
  });
}

export function validateHomeworkAssessment(
  input: PublishAssessmentInput,
  options?: {
    assignmentPrompts?: Array<{ promptId: string; partNumber: 1 | 2 | 3 }>;
    audioResponses?: Array<{ promptId: string; durationMs?: number }>;
  }
) {
  // Validate 4 IELTS Speaking criteria
  const fc = validateBandScore("Fluency & Coherence", input.fluencyCoherence);
  const lr = validateBandScore("Lexical Resource", input.lexicalResource);
  const gra = validateBandScore(
    "Grammatical Range & Accuracy",
    input.grammaticalRangeAccuracy
  );
  const pr = validateBandScore("Pronunciation", input.pronunciation);

  // Mandatory overall feedback
  if (
    typeof input.overallFeedback !== "string" ||
    !input.overallFeedback.trim()
  ) {
    throw new ValidationError(
      "Nhận xét tổng quan của Giáo viên là bắt buộc trước khi Duyệt & Công bố."
    );
  }

  // Derive IELTS Overall Band with official rounding rules
  const overallBand = calculateIeltsSpeakingOverallBand(fc, lr, gra, pr);

  let validatedAnnotations = input.annotations;
  if (
    options?.assignmentPrompts &&
    options?.audioResponses &&
    input.annotations
  ) {
    validatedAnnotations = validateAndNormalizeSpeakingAnnotations(
      input.annotations,
      options.assignmentPrompts,
      options.audioResponses
    );
  }

  return {
    ...input,
    fluencyCoherence: fc,
    lexicalResource: lr,
    grammaticalRangeAccuracy: gra,
    pronunciation: pr,
    overallBand,
    overallFeedback: input.overallFeedback.trim(),
    annotations: validatedAnnotations,
  };
}
