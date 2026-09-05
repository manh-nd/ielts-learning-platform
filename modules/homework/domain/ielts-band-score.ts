/** Canonical input scale for Teacher IELTS criterion scores. */
export const IELTS_BAND_SCORE = { min: 0, max: 9, step: 0.5 } as const;

export type IeltsBandScoreIssue =
  "not_number" | "out_of_range" | "invalid_step";

export function getIeltsBandScoreIssue(
  score: unknown
): IeltsBandScoreIssue | null {
  if (typeof score !== "number" || Number.isNaN(score)) return "not_number";
  if (score < IELTS_BAND_SCORE.min || score > IELTS_BAND_SCORE.max)
    return "out_of_range";
  if (score % IELTS_BAND_SCORE.step !== 0) return "invalid_step";
  return null;
}
