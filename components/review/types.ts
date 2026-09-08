/**
 * IELTS Review & Annotation Types
 */

export type Criterion =
  | "TASK_ACHIEVEMENT"
  | "COHERENCE_COHESION"
  | "LEXICAL_RESOURCE"
  | "GRAMMATICAL_RANGE_ACCURACY";

export const CRITERIA_ORDER: Criterion[] = [
  "TASK_ACHIEVEMENT",
  "COHERENCE_COHESION",
  "LEXICAL_RESOURCE",
  "GRAMMATICAL_RANGE_ACCURACY",
];

export interface CriterionInfo {
  label: string;
  short: string;
  bgLight: string;
  bgDark: string;
  border: string;
  text: string;
  badgeBg: string;
}

export const CRITERION_META: Record<Criterion, CriterionInfo> = {
  TASK_ACHIEVEMENT: {
    label: "Task Achievement",
    short: "TA",
    bgLight: "bg-criterion-ta-bg",
    bgDark: "dark:bg-criterion-ta-bg",
    border: "border-criterion-ta-subtle dark:border-criterion-ta",
    text: "text-criterion-ta",
    badgeBg:
      "bg-criterion-ta-bg text-foreground border border-criterion-ta-subtle",
  },
  COHERENCE_COHESION: {
    label: "Coherence & Cohesion",
    short: "CC",
    bgLight: "bg-criterion-cc-bg",
    bgDark: "dark:bg-criterion-cc-bg",
    border: "border-criterion-cc-subtle dark:border-criterion-cc",
    text: "text-criterion-cc",
    badgeBg:
      "bg-criterion-cc-bg text-foreground border border-criterion-cc-subtle",
  },
  LEXICAL_RESOURCE: {
    label: "Lexical Resource",
    short: "LR",
    bgLight: "bg-criterion-lr-bg",
    bgDark: "dark:bg-criterion-lr-bg",
    border: "border-criterion-lr-subtle dark:border-criterion-lr",
    text: "text-criterion-lr",
    badgeBg:
      "bg-criterion-lr-bg text-foreground border border-criterion-lr-subtle",
  },
  GRAMMATICAL_RANGE_ACCURACY: {
    label: "Grammatical Range & Accuracy",
    short: "GRA",
    bgLight: "bg-criterion-gra-bg",
    bgDark: "dark:bg-criterion-gra-bg",
    border: "border-criterion-gra-subtle dark:border-criterion-gra",
    text: "text-criterion-gra",
    badgeBg:
      "bg-criterion-gra-bg text-foreground border border-criterion-gra-subtle",
  },
};

export type ErrorSeverity =
  "minor_slip" | "systematic_error" | "impedes_communication";

export const SEVERITY_META: Record<
  ErrorSeverity,
  { label: string; badgeVariant: "outline" | "secondary" | "destructive" }
> = {
  minor_slip: { label: "Lỗi nhẹ (Minor Slip)", badgeVariant: "outline" },
  systematic_error: {
    label: "Lỗi lặp lại (Systematic)",
    badgeVariant: "secondary",
  },
  impedes_communication: {
    label: "Lỗi nghiêm trọng (Critical)",
    badgeVariant: "destructive",
  },
};

export const CATEGORY_PRESETS: Record<Criterion, string[]> = {
  TASK_ACHIEVEMENT: [
    "Trình bày quan điểm (Clear Position)",
    "Phát triển luận điểm (Idea Development)",
    "Ví dụ & Dẫn chứng (Examples & Evidence)",
    "Phạm vi yêu cầu đề (Task Coverage)",
    "Cấu trúc đoạn văn (Paragraph Structure)",
  ],
  COHERENCE_COHESION: [
    "Từ nối & Chuyển tiếp (Discourse Markers)",
    "Phân đoạn logic (Paragraphing)",
    "Đại từ & Quy chiếu (Referencing)",
    "Mạch lạc luận cứ (Logical Flow)",
    "Liên kết câu (Sentence Linking)",
  ],
  LEXICAL_RESOURCE: [
    "Lặp từ vựng (Word Repetition)",
    "Kết hợp từ (Collocation)",
    "Dùng từ chưa tự nhiên (Inappropriate Word Choice)",
    "Chính tả & Dạng từ (Spelling & Word Formation)",
    "Nâng cấp từ vựng C1/C2 (Advanced Lexicon)",
  ],
  GRAMMATICAL_RANGE_ACCURACY: [
    "Thì động từ (Verb Tense)",
    "Hòa hợp chủ vị (Subject-Verb Agreement)",
    "Mệnh đề phức & Quan hệ (Complex Structures)",
    "Mạo từ & Giới từ (Articles & Prepositions)",
    "Dấu câu & Ngắt câu (Punctuation)",
  ],
};

export interface ReviewAnnotation {
  errorId: string;
  criterion: Criterion;
  category?: string;
  severity: ErrorSeverity;
  explanation: string;
  suggestedCorrection?: string;
  originalQuote?: string;
  source: "ai" | "teacher";
  isResolved?: boolean;
  offsetStart?: number;
  offsetEnd?: number;
  createdAt?: string;
}

export type AssessmentScores = Record<Criterion, number>;

export interface AssessmentFeedback {
  examinerSummary?: string;
  strengths?: string[];
  improvements?: string[];
}

export type FeedbackDiffResolution =
  "accepted" | "rejected" | "modified" | "teacher_added";

export interface FeedbackDiffItem {
  errorId: string;
  criterion: Criterion;
  originalQuote: string;
  aiSuggestedCorrection?: string;
  teacherFinalText?: string;
  explanation: string;
  resolution: FeedbackDiffResolution;
  teacherNote?: string;
}

export const BAND_OPTIONS = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0,
  8.5, 9.0,
];

/**
 * Calculates IELTS overall band score from 4 criteria according to IELTS official rounding rules:
 * - Average fractional part < 0.25 -> round down (e.g. 6.125 -> 6.0)
 * - Average fractional part >= 0.25 and < 0.75 -> round to .5 (e.g. 6.25 -> 6.5, 6.625 -> 6.5)
 * - Average fractional part >= 0.75 -> round up to next whole (e.g. 6.75 -> 7.0)
 */
export function calculateOverallBand(scores: AssessmentScores): number {
  const vals = CRITERIA_ORDER.map((c) => scores[c] ?? 0);
  const mean = vals.reduce((a, b) => a + b, 0) / 4;
  const floor = Math.floor(mean);
  const remainder = mean - floor;
  if (remainder < 0.25) return floor;
  if (remainder < 0.75) return floor + 0.5;
  return floor + 1;
}
