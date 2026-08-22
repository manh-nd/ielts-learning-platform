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
  color: "emerald" | "amber" | "blue" | "rose";
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
    color: "emerald",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-950/50",
    border: "border-emerald-500 dark:border-emerald-400",
    text: "text-emerald-700 dark:text-emerald-300",
    badgeBg: "bg-emerald-500 text-white",
    accentColor: "text-emerald-600 dark:text-emerald-400",
  },
  COHERENCE_COHESION: {
    key: "COHERENCE_COHESION",
    label: "Coherence & Cohesion",
    short: "CC",
    vietnameseLabel: "Độ mạch lạc & Liên kết",
    color: "amber",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-950/50",
    border: "border-amber-500 dark:border-amber-400",
    text: "text-amber-700 dark:text-amber-300",
    badgeBg: "bg-amber-500 text-white",
    accentColor: "text-amber-600 dark:text-amber-400",
  },
  LEXICAL_RESOURCE: {
    key: "LEXICAL_RESOURCE",
    label: "Lexical Resource",
    short: "LR",
    vietnameseLabel: "Vốn từ vựng & Độ chuẩn xác",
    color: "blue",
    bgLight: "bg-blue-50",
    bgDark: "dark:bg-blue-950/50",
    border: "border-blue-500 dark:border-blue-400",
    text: "text-blue-700 dark:text-blue-300",
    badgeBg: "bg-blue-500 text-white",
    accentColor: "text-blue-600 dark:text-blue-400",
  },
  GRAMMATICAL_RANGE_ACCURACY: {
    key: "GRAMMATICAL_RANGE_ACCURACY",
    label: "Grammatical Range & Accuracy",
    short: "GRA",
    vietnameseLabel: "Ngữ pháp & Cấu trúc đa dạng",
    color: "rose",
    bgLight: "bg-rose-50",
    bgDark: "dark:bg-rose-950/50",
    border: "border-rose-500 dark:border-rose-400",
    text: "text-rose-700 dark:text-rose-300",
    badgeBg: "bg-rose-500 text-white",
    accentColor: "text-rose-600 dark:text-rose-400",
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
