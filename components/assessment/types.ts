/**
 * IELTS Assessment & Criteria Scoring Types
 */

export type WritingCriterion =
  | "TASK_ACHIEVEMENT"
  | "COHERENCE_COHESION"
  | "LEXICAL_RESOURCE"
  | "GRAMMATICAL_RANGE_ACCURACY";

export type SpeakingCriterion =
  | "FLUENCY_COHERENCE"
  | "LEXICAL_RESOURCE"
  | "GRAMMATICAL_RANGE_ACCURACY"
  | "PRONUNCIATION";

export type Criterion = WritingCriterion;

export const WRITING_CRITERIA_ORDER: WritingCriterion[] = [
  "TASK_ACHIEVEMENT",
  "COHERENCE_COHESION",
  "LEXICAL_RESOURCE",
  "GRAMMATICAL_RANGE_ACCURACY",
];

export const CRITERIA_ORDER = WRITING_CRITERIA_ORDER;

export interface CriterionInfo {
  key: Criterion;
  label: string;
  short: string;
  vietnameseLabel: string;
  bgLight: string;
  bgDark: string;
  border: string;
  text: string;
  badgeBg: string;
  accentColor: string;
}

export const CRITERION_META: Record<WritingCriterion, CriterionInfo> = {
  TASK_ACHIEVEMENT: {
    key: "TASK_ACHIEVEMENT",
    label: "Task Achievement / Task Response",
    short: "TA",
    vietnameseLabel: "Đáp ứng yêu cầu đề bài",
    bgLight: "bg-criterion-ta-bg",
    bgDark: "dark:bg-criterion-ta-bg",
    border: "border-criterion-ta-subtle dark:border-criterion-ta",
    text: "text-criterion-ta",
    badgeBg:
      "bg-criterion-ta-bg text-foreground border border-criterion-ta-subtle",
    accentColor: "text-criterion-ta",
  },
  COHERENCE_COHESION: {
    key: "COHERENCE_COHESION",
    label: "Coherence & Cohesion",
    short: "CC",
    vietnameseLabel: "Độ mạch lạc & Liên kết",
    bgLight: "bg-criterion-cc-bg",
    bgDark: "dark:bg-criterion-cc-bg",
    border: "border-criterion-cc-subtle dark:border-criterion-cc",
    text: "text-criterion-cc",
    badgeBg:
      "bg-criterion-cc-bg text-foreground border border-criterion-cc-subtle",
    accentColor: "text-criterion-cc",
  },
  LEXICAL_RESOURCE: {
    key: "LEXICAL_RESOURCE",
    label: "Lexical Resource",
    short: "LR",
    vietnameseLabel: "Vốn từ vựng & Độ chuẩn xác",
    bgLight: "bg-criterion-lr-bg",
    bgDark: "dark:bg-criterion-lr-bg",
    border: "border-criterion-lr-subtle dark:border-criterion-lr",
    text: "text-criterion-lr",
    badgeBg:
      "bg-criterion-lr-bg text-foreground border border-criterion-lr-subtle",
    accentColor: "text-criterion-lr",
  },
  GRAMMATICAL_RANGE_ACCURACY: {
    key: "GRAMMATICAL_RANGE_ACCURACY",
    label: "Grammatical Range & Accuracy",
    short: "GRA",
    vietnameseLabel: "Ngữ pháp & Cấu trúc đa dạng",
    bgLight: "bg-criterion-gra-bg",
    bgDark: "dark:bg-criterion-gra-bg",
    border: "border-criterion-gra-subtle dark:border-criterion-gra",
    text: "text-criterion-gra",
    badgeBg:
      "bg-criterion-gra-bg text-foreground border border-criterion-gra-subtle",
    accentColor: "text-criterion-gra",
  },
};

export type AssessmentScores = Record<WritingCriterion, number>;

export interface BandDescriptor {
  band: number;
  summary: string;
  detail: string;
  bulletPoints?: string[];
}

export type CriterionRubrics = Record<number, BandDescriptor>;

export interface AssessmentComparisonItem {
  criterion: WritingCriterion;
  aiScore: number;
  teacherScore: number;
  delta: number;
  hasChanged: boolean;
}

export type AssessmentMode = "interactive" | "readonly";

export const BAND_OPTIONS = [
  0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0,
  7.5, 8.0, 8.5, 9.0,
];

/**
 * Calculates IELTS overall band score from 4 criteria according to official IELTS rounding rules:
 * - Average fractional part < 0.25 -> round down (e.g. 6.125 -> 6.0)
 * - Average fractional part >= 0.25 and < 0.75 -> round to .5 (e.g. 6.25 -> 6.5, 6.625 -> 6.5)
 * - Average fractional part >= 0.75 -> round up to next whole band (e.g. 6.75 -> 7.0)
 */
export function calculateOverallBand(
  scores: Partial<AssessmentScores>
): number {
  const vals = WRITING_CRITERIA_ORDER.map((c) => scores[c] ?? 0);
  const mean = vals.reduce((a, b) => a + b, 0) / 4;
  const floor = Math.floor(mean);
  const remainder = Number((mean - floor).toFixed(4));

  if (remainder < 0.25) return floor;
  if (remainder < 0.75) return floor + 0.5;
  return floor + 1;
}

/**
 * Returns raw unrounded average for breakdown and diff analytics
 */
export function calculateRawAverage(scores: Partial<AssessmentScores>): number {
  const vals = WRITING_CRITERIA_ORDER.map((c) => scores[c] ?? 0);
  return Number((vals.reduce((a, b) => a + b, 0) / 4).toFixed(3));
}
