import { getIeltsBandScoreIssue } from "../domain/ielts-band-score";
import { calculateIeltsSpeakingOverallBand } from "../domain/homework-types";
import type { PublishAssessmentInput } from "./homework-inputs";
import { ValidationError } from "@/lib/errors";

export { IELTS_BAND_SCORE } from "../domain/ielts-band-score";

function validateBandScore(name: string, score: unknown): number {
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

export function validateHomeworkAssessment(input: PublishAssessmentInput) {
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

  return {
    ...input,
    fluencyCoherence: fc,
    lexicalResource: lr,
    grammaticalRangeAccuracy: gra,
    pronunciation: pr,
    overallBand,
    overallFeedback: input.overallFeedback.trim(),
  };
}
