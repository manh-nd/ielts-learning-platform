/**
 * PROTOTYPE — throwaway mock data for Teacher Review Workspace.
 * Three variants of this page, switchable via ?variant=A|B|C.
 */

// ── IELTS Criteria ──────────────────────────────────────────────
export type Criterion =
  | "TASK_ACHIEVEMENT"
  | "COHERENCE_COHESION"
  | "LEXICAL_RESOURCE"
  | "GRAMMATICAL_RANGE_ACCURACY";

export const CRITERION_META: Record<
  Criterion,
  {
    label: string;
    short: string;
    color: string;
    bgLight: string;
    bgDark: string;
    border: string;
  }
> = {
  TASK_ACHIEVEMENT: {
    label: "Task Achievement",
    short: "TA",
    color: "emerald",
    bgLight: "bg-emerald-100 text-emerald-950",
    bgDark: "dark:bg-emerald-950/50 dark:text-emerald-200",
    border: "border-emerald-500 dark:border-emerald-400",
  },
  COHERENCE_COHESION: {
    label: "Coherence & Cohesion",
    short: "CC",
    color: "amber",
    bgLight: "bg-amber-100 text-amber-950",
    bgDark: "dark:bg-amber-950/50 dark:text-amber-200",
    border: "border-amber-500 dark:border-amber-400",
  },
  LEXICAL_RESOURCE: {
    label: "Lexical Resource",
    short: "LR",
    color: "blue",
    bgLight: "bg-blue-100 text-blue-950",
    bgDark: "dark:bg-blue-950/50 dark:text-blue-200",
    border: "border-blue-500 dark:border-blue-400",
  },
  GRAMMATICAL_RANGE_ACCURACY: {
    label: "Grammatical Range & Accuracy",
    short: "GRA",
    color: "red",
    bgLight: "bg-red-100 text-red-950",
    bgDark: "dark:bg-red-950/50 dark:text-red-200",
    border: "border-red-500 dark:border-red-400",
  },
};

export const CRITERIA_ORDER: Criterion[] = [
  "TASK_ACHIEVEMENT",
  "COHERENCE_COHESION",
  "LEXICAL_RESOURCE",
  "GRAMMATICAL_RANGE_ACCURACY",
];

// ── Band score helpers ──────────────────────────────────────────
export const BAND_OPTIONS = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0,
  8.5, 9.0,
];

export function calculateOverallBand(
  scores: Record<Criterion, number>
): number {
  const vals = CRITERIA_ORDER.map((c) => scores[c]);
  const mean = vals.reduce((a, b) => a + b, 0) / 4;
  const floor = Math.floor(mean);
  const remainder = mean - floor;
  if (remainder < 0.25) return floor;
  if (remainder < 0.75) return floor + 0.5;
  return floor + 1;
}

// ── Annotation model ────────────────────────────────────────────
export interface AnnotationError {
  errorId: string;
  criterion: Criterion;
  category: string;
  severity: "minor_slip" | "systematic_error" | "impedes_communication";
  explanation: string;
  suggestedCorrection: string;
  originalQuote: string;
  /** character offsets in the plain text, for highlighting */
  offsetStart: number;
  offsetEnd: number;
}

// ── Assessment states ───────────────────────────────────────────
export type AssessmentStatus =
  | "created"
  | "ai_proposal_available"
  | "teacher_assessed"
  | "approved"
  | "published";

export const STATUS_FLOW: AssessmentStatus[] = [
  "created",
  "ai_proposal_available",
  "teacher_assessed",
  "approved",
  "published",
];

export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  created: "Chờ chấm",
  ai_proposal_available: "AI đã đề xuất",
  teacher_assessed: "Đã chấm",
  approved: "Đã duyệt",
  published: "Đã công bố",
};

// ── Mock data ───────────────────────────────────────────────────

export const MOCK_STUDENT = {
  name: "Nguyễn Minh Anh",
  avatar: "NMA",
  class: "IELTS Advanced 7.0 — Lớp A3",
};

export const MOCK_HOMEWORK = {
  title: "Writing Task 2 — Tuần 5",
  prompt:
    "Some people think that the best way to reduce crime is to give longer prison sentences. Others, however, believe there are better alternative ways of reducing crime. Discuss both views and give your opinion.",
  taskType: "Task 2" as const,
  dueDate: "2026-08-20",
  wordLimit: { min: 250, max: 300 },
};

export const MOCK_ESSAY = `In today's society, crime remains one of the most pressing issues that governments and communities worldwide must address. While some people advocate for longer prison sentences as the most effective deterrent, others argue that alternative approaches, such as education and rehabilitation programmes, can be more effective in reducing crime rates. This essay will discuss both perspectives before presenting my own view.

On the one hand, proponents of longer prison sentences argue that harsher punishments serve as a powerful deterrent. When potential offenders are aware that they face extended periods of incarceration, they may think twice before committing crimes. For instance, countries that have implemented strict sentencing guidelines, such as the "three strikes" law in the United States, have seen some reduction in repeat offenses. Moreover, keeping criminals behind bars for longer periods ensures that they are removed from society, thereby preventing them from committing further crimes during their sentence.

On the other hand, there is compelling evidence that alternative methods can be more successful in tackling the root causes of criminal behaviour. Educational programmes within prisons can equip inmates with valuable skills and qualifications, making them more employable upon release and less likely to reoffend. Furthermore, community-based rehabilitation initiatives, such as drug treatment programmes and mental health support, address the underlying issues that often drive individuals to crime. For example, Norway's rehabilitation-focused prison system has achieved one of the lowest recidivism rates in the world, at approximately 20%.

In my opinion, while longer sentences may have some deterrent effect, they alone are insufficient to significantly reduce crime. A more holistic approach that combines appropriate sentencing with rehabilitation and education is likely to be more effective in the long term. By addressing the root causes of criminal behaviour, society can not only reduce crime rates but also help former offenders become productive members of society.

In conclusion, although extending prison sentences can play a role in crime reduction, I believe that investing in education, rehabilitation, and social support systems offers a more sustainable and humane solution to the problem of crime.`;

export const MOCK_ESSAY_WORD_COUNT = MOCK_ESSAY.split(/\s+/).length;

export const MOCK_AI_SCORES: Record<Criterion, number> = {
  TASK_ACHIEVEMENT: 7.0,
  COHERENCE_COHESION: 7.5,
  LEXICAL_RESOURCE: 6.5,
  GRAMMATICAL_RANGE_ACCURACY: 6.5,
};

export const MOCK_AI_OVERALL = calculateOverallBand(MOCK_AI_SCORES);

export const MOCK_AI_FEEDBACK = {
  examiner_summary:
    "The essay demonstrates a clear understanding of the topic with a well-structured argument. Both views are discussed with relevant examples. However, lexical range could be broader, and there are some grammatical inaccuracies that prevent a higher band score.",
  strengths: [
    "Well-organized with clear introduction, body paragraphs, and conclusion",
    "Effective use of the Norway example as supporting evidence",
    "Good use of cohesive devices and logical paragraph progression",
    "Clear position stated in the introduction and conclusion",
  ],
  improvements: [
    "Expand vocabulary range — some word choices are repetitive ('effective', 'reduce')",
    "Minor grammatical errors in complex sentence structures",
    "Could develop the first body paragraph with more specific examples",
    "Consider using more sophisticated linking phrases",
  ],
};

export const MOCK_AI_ERRORS: AnnotationError[] = [
  {
    errorId: "err-1",
    criterion: "LEXICAL_RESOURCE",
    category: "Word Choice / Repetition",
    severity: "systematic_error",
    explanation:
      "The word 'effective' is used three times across the essay. Consider using synonyms like 'impactful', 'productive', or 'beneficial' to demonstrate a wider lexical range.",
    suggestedCorrection: "impactful",
    originalQuote: "more effective in reducing",
    offsetStart: 398,
    offsetEnd: 428,
  },
  {
    errorId: "err-2",
    criterion: "GRAMMATICAL_RANGE_ACCURACY",
    category: "Subject-Verb Agreement",
    severity: "minor_slip",
    explanation:
      "In formal academic writing, 'there is compelling evidence' is correct, but the subsequent clause structure is overly complex. Consider simplifying.",
    suggestedCorrection: "strong evidence exists that",
    originalQuote: "there is compelling evidence that",
    offsetStart: 793,
    offsetEnd: 826,
  },
  {
    errorId: "err-3",
    criterion: "COHERENCE_COHESION",
    category: "Referencing / Cohesion",
    severity: "minor_slip",
    explanation:
      "The transition 'On the other hand' is appropriate but predictable. More sophisticated discourse markers would improve cohesion scoring.",
    suggestedCorrection: "Conversely",
    originalQuote: "On the other hand",
    offsetStart: 791,
    offsetEnd: 809,
  },
  {
    errorId: "err-4",
    criterion: "TASK_ACHIEVEMENT",
    category: "Development of Ideas",
    severity: "minor_slip",
    explanation:
      "The first body paragraph could benefit from more concrete data or statistics to strengthen the argument for longer sentences.",
    suggestedCorrection: "",
    originalQuote: "have seen some reduction in repeat offenses",
    offsetStart: 634,
    offsetEnd: 678,
  },
  {
    errorId: "err-5",
    criterion: "GRAMMATICAL_RANGE_ACCURACY",
    category: "Article Usage",
    severity: "minor_slip",
    explanation:
      "Missing article before 'crime' when used as a general concept in this context.",
    suggestedCorrection: "reduce crime rates",
    originalQuote: "reduce crime",
    offsetStart: 210,
    offsetEnd: 222,
  },
];

export const MOCK_AI_CRITERIA_DETAIL: Record<
  Criterion,
  { justification: string; strengths: string[]; improvements: string[] }
> = {
  TASK_ACHIEVEMENT: {
    justification:
      "The essay addresses all parts of the task, presenting both views and a clear personal opinion. However, ideas could be more fully developed in places.",
    strengths: [
      "Both views clearly discussed",
      "Clear opinion stated",
      "Relevant examples used",
    ],
    improvements: [
      "Develop first body paragraph further",
      "Add more concrete data/statistics",
    ],
  },
  COHERENCE_COHESION: {
    justification:
      "The essay is well-organized with clear progression throughout. Cohesive devices are used effectively, though some are predictable.",
    strengths: [
      "Logical paragraph structure",
      "Clear topic sentences",
      "Effective use of linking words",
    ],
    improvements: [
      "Use more varied discourse markers",
      "Strengthen referencing between paragraphs",
    ],
  },
  LEXICAL_RESOURCE: {
    justification:
      "Vocabulary is adequate but could be broader. Some good collocations but also noticeable repetition of key terms.",
    strengths: [
      "Good use of topic-specific vocabulary",
      "Some effective collocations",
    ],
    improvements: [
      "Reduce repetition of 'effective' and 'reduce'",
      "Use more sophisticated vocabulary",
      "Attempt less common expressions",
    ],
  },
  GRAMMATICAL_RANGE_ACCURACY: {
    justification:
      "Uses a mix of simple and complex sentences with generally good control. Some errors in complex structures but they do not impede communication.",
    strengths: [
      "Good range of sentence structures",
      "Complex sentences generally accurate",
    ],
    improvements: [
      "Minor article usage errors",
      "Some overly complex clause structures",
      "Review subject-verb agreement in complex clauses",
    ],
  },
};
