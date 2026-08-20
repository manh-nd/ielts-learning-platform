# IELTS Writing Assessment: LLM Prompt Engineering & Structured JSON Output Schema

**Document Version:** 1.0.0  
**Status:** Approved Architectural Specification  
**Target Module:** IELTS Writing AI Evaluation Engine (Task 1 & Task 2)  
**Primary Standards:** Official IELTS Band Descriptors (May 2023 Update) & CEFR Alignment

---

## 1. Overview & System Architecture

The automated IELTS Writing evaluation engine is designed to deliver immediate, examiner-grade feedback for student mock tests and pre-graded submissions for teacher review.

```
┌─────────────────┐       ┌───────────────────────────────┐       ┌────────────────────────┐
│  Student Essay  │  ──>  │  LLM Assessment Engine        │  ──>  │  Deterministic Post-  │
│  & Task Prompt  │       │  (Gemini / Claude / OpenAI)   │       │  Processing & Math     │
└─────────────────┘       │  • Constrained JSON Output    │       └────────────────────────┘
                          │  • Criterion Descriptors      │                   │
                          │  • In-Schema Chain of Thought │                   ▼
                          └───────────────────────────────┘       ┌────────────────────────┐
                                                                  │  Grounding Verifier    │
                                                                  │  (Quote Substring Check)│
                                                                  └────────────────────────┘
                                                                              │
                                                                              ▼
                                                                  ┌────────────────────────┐
                                                                  │  Teacher Review UI /   │
                                                                  │  Student Report        │
                                                                  └────────────────────────┘
```

### Key Principles

1. **Separation of Evaluation and Arithmetic:** The LLM evaluates qualitative criteria ($TA/TR, CC, LR, GRA \in [1.0, 9.0]$ in 0.5 increments). The server computes the composite task band and overall writing band using deterministic IELTS mathematical rounding.
2. **Strict Verbatim Quoting:** Any identified error or suggested upgrade must link to an exact substring in the student's submission to eliminate hallucinated text.
3. **Actionable Improvement Paths:** Every score must include concrete upgrade recommendations (lexical collocations, structural variety, cohesive flow) showing how to reach the next band level (+0.5 / +1.0).

---

## 2. Official IELTS Writing Criteria & Band Descriptors

Assessment adheres to the official updated IELTS public band descriptors (Cambridge / IDP / British Council).

### 2.1 Task 1: Task Achievement (TA)

Measures how accurately, appropriately, and relevantly the response fulfills the task prompt (minimum 150 words recommended).

- **Academic Task 1 (Charts, Graphs, Tables, Diagrams, Maps, Processes):**
  - **Overview Requirement:** A clear, concise overview summarizing main trends, differences, or stages is mandatory for Band 6.0+. Responses lacking an overview cannot exceed Band 5.0.
  - **Key Features:** Key data points and comparisons must be selected and reported accurately without personal opinion or unsupported speculation.
- **General Training Task 1 (Letters):**
  - **Purpose & Tone:** Clear statement of purpose and consistent register (formal, semi-formal, or informal).
  - **Bullet Points:** All bullet points in the prompt must be covered adequately and appropriately.

| Band    | Key TA Descriptors (Academic)                                                                                                                                |
| :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **9.0** | Fully satisfies all requirements; comprehensive overview; key features skillfully selected, highlighted, and fully extended.                                 |
| **8.0** | Covers all requirements appropriately and sufficiently; clear overview highlighting key trends/differences; key features well supported with accurate data.  |
| **7.0** | Covers requirements; presents a clear overview; highlights main features clearly, but some data may be lightly extended or generalized.                      |
| **6.0** | Addresses requirements; presents an overview (may lack clarity or data focus); highlights key features but may contain minor data inaccuracies or omissions. |
| **5.0** | Generally addresses the task; no clear overview or mechanical overview; recounts detail mechanically with inadequate focus on key features.                  |
| **4.0** | Attempts task but fails to present an overview; key features largely omitted, inaccurate, or confused.                                                       |

### 2.2 Task 2: Task Response (TR)

Measures how fully and appropriately the candidate formulates and supports an argument in response to the prompt (minimum 250 words recommended).

- **Addressing All Parts:** Directly answering all prompt prompts (e.g., both views + opinion, advantages vs disadvantages, cause and solution).
- **Clear Position Throughout:** The writer's stance must be evident in the introduction, maintained through body arguments, and confirmed in the conclusion.
- **Idea Extension & Support:** Arguments must be supported with logical explanations and examples, avoiding sweeping over-generalizations.

| Band    | Key TR Descriptors                                                                                                                                                          |
| :------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **9.0** | Fully addresses all parts of the prompt; presents a fully developed position with well-supported and nuanced ideas throughout.                                              |
| **8.0** | Sufficiently addresses all parts; well-developed response with relevant, extended, and supported ideas; clear position throughout.                                          |
| **7.0** | Addresses all parts; clear position throughout; main ideas extended and supported, though some over-generalization or lack of depth may occur.                              |
| **6.0** | Addresses all parts (some more fully than others); presents a relevant position though conclusions may be repetitive or unclear; ideas adequately developed but lack depth. |
| **5.0** | Addresses the task only partially; position expressed but development is unclear or inconsistent; ideas limited or poorly supported.                                        |
| **4.0** | Responds in a minimal or tangential way; position unclear; ideas repetitive, irrelevant, or unsupported.                                                                    |

### 2.3 Coherence & Cohesion (CC)

Measures the clarity of thought progression, paragraph architecture, and linking mechanisms.

- **Paragraphing:** Each body paragraph must focus on a clear central topic with logical progression from introduction to conclusion.
- **Cohesive Devices:** Varied use of conjunctions, transitions, referencing (pronouns, demonstratives), and lexical substitution.
- **Avoidance of Mechanical Linking:** Overuse of canned transitions (e.g., "Firstly", "Secondly", "Furthermore", "In a nutshell") caps CC at Band 6.0.

| Band    | Key CC Descriptors                                                                                                                                                            |
| :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **9.0** | Cohesion is seamless and attracts no attention; paragraphing is expertly managed with natural thematic progression.                                                           |
| **8.0** | Sequences ideas logically; manages all aspects of cohesion effectively; uses paragraphing appropriately and sufficiently.                                                     |
| **7.0** | Logically organizes ideas with clear progression; uses a range of cohesive devices appropriately (occasional under/overuse); clear central topic per paragraph.               |
| **6.0** | Coherent overall progression; uses cohesive devices effectively, but cohesion within/between sentences may be faulty or mechanical; paragraphing used but not always logical. |
| **5.0** | Some organization, but lacks overall progression; makes inadequate, inaccurate, or excessive use of cohesive devices; faulty paragraphing.                                    |

### 2.4 Lexical Resource (LR)

Measures vocabulary range, precision, register appropriateness, and word-formation accuracy.

- **Lexical Range:** Use of topic-specific vocabulary, uncommon lexical items, and natural collocations.
- **Accuracy:** Minimizing errors in word choice, spelling, and morphological form (prefixes/suffixes).

| Band    | Key LR Descriptors                                                                                                                                                            |
| :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **9.0** | Full flexibility and precise use of wide vocabulary; natural and sophisticated control of lexical features; rare minor 'slips'.                                               |
| **8.0** | Wide range of vocabulary used flexibly to convey precise meanings; skillfully uses uncommon lexical items and collocations; rare spelling/formation errors.                   |
| **7.0** | Sufficient range allowing flexibility and precision; uses less common vocabulary with awareness of style and collocation; produces occasional errors in word choice/spelling. |
| **6.0** | Adequate range for the task; attempts less common vocabulary but with noticeable inaccuracies; spelling/formation errors do not impede communication.                         |
| **5.0** | Limited vocabulary range; minimally adequate; noticeable errors in spelling/formation that cause difficulty for the reader.                                                   |

### 2.5 Grammatical Range & Accuracy (GRA)

Measures the variety and syntactic complexity of sentence structures, error density, and punctuation control.

- **Syntactic Range:** Balance of simple, compound, and complex sentences (relative clauses, conditionals, passive voice, inversions, participle clauses).
- **Error-Free Ratio:**
  - **Band 7.0 Requirement:** Frequent error-free sentences ($> 50\%$).
  - **Band 8.0 Requirement:** Majority of sentences are error-free ($> 75\%$).
- **Punctuation:** Accurate use of commas, full stops, apostrophes, and semicolons without comma splices or run-on sentences.

| Band    | Key GRA Descriptors                                                                                                                           |
| :------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **9.0** | Wide range of structures with full flexibility and accuracy; rare minor 'slips'.                                                              |
| **8.0** | Wide range of sentence structures; majority of sentences are error-free; only occasional non-systematic errors.                               |
| **7.0** | Uses a variety of complex structures; produces frequent error-free sentences; good control of grammar and punctuation with occasional errors. |
| **6.0** | Mix of simple and complex forms; some errors in grammar and punctuation, but they rarely impede communication.                                |
| **5.0** | Limited range of structures; complex attempts are often inaccurate; frequent grammatical errors and punctuation faults cause reader strain.   |

---

## 3. Band Score Calculation & Exact Rounding Rules

### 3.1 Single Task Band Calculation

Each task is evaluated across all 4 criteria on a 1.0–9.0 scale with 0.5 increments:

$$\text{Task Criterion Mean} = \frac{\text{TA (or TR)} + \text{CC} + \text{LR} + \text{GRA}}{4}$$

$$\text{Task Band Score} = \text{round}_{\text{IELTS}}(\text{Task Criterion Mean})$$

### 3.2 Overall Writing Band Calculation (Task 1 + Task 2)

When both tasks are completed together, Task 2 is weighted **two-thirds ($2/3$)** and Task 1 **one-third ($1/3$)**:

$$\text{Overall Writing Mean} = \frac{\text{Task 1 Band} + (2 \times \text{Task 2 Band})}{3}$$

$$\text{Overall Writing Band Score} = \text{round}_{\text{IELTS}}(\text{Overall Writing Mean})$$

### 3.3 IELTS Official Rounding Algorithm

Given any arithmetic mean $M$:

1. Let integer component $I = \lfloor M \rfloor$.
2. Let fractional remainder $R = M - I$.

| Fractional Range    | Rounding Rule         | Example Calculation                                                      | Final Band |
| :------------------ | :-------------------- | :----------------------------------------------------------------------- | :--------- |
| $R < 0.25$          | Round down to $I.0$   | $6.125 \to 6.0$                                                          | **6.0**    |
| $0.25 \le R < 0.75$ | Round to $I.5$        | $6.250 \to 6.5$<br>$6.375 \to 6.5$<br>$6.500 \to 6.5$<br>$6.625 \to 6.5$ | **6.5**    |
| $R \ge 0.75$        | Round up to $I + 1.0$ | $6.750 \to 7.0$<br>$6.875 \to 7.0$                                       | **7.0**    |

### 3.4 TypeScript Reference Implementation

```typescript
/**
 * IELTS Official Rounding Standard
 * British Council / IDP / Cambridge Assessment Specification
 */
export function roundToIeltsBand(rawScore: number): number {
  if (rawScore < 0 || rawScore > 9) {
    throw new Error(
      `Invalid IELTS score: ${rawScore}. Must be between 0.0 and 9.0`
    );
  }

  const floor = Math.floor(rawScore);
  const remainder = Number((rawScore - floor).toFixed(4));

  if (remainder < 0.25) {
    return floor;
  } else if (remainder < 0.75) {
    return floor + 0.5;
  } else {
    return floor + 1.0;
  }
}

export interface IeltsCriterionScores {
  taOrTr: number; // Task Achievement (Task 1) or Task Response (Task 2)
  cc: number; // Coherence & Cohesion
  lr: number; // Lexical Resource
  gra: number; // Grammatical Range & Accuracy
}

export function calculateTaskBand(scores: IeltsCriterionScores): {
  rawMean: number;
  roundedBand: number;
} {
  const rawMean = (scores.taOrTr + scores.cc + scores.lr + scores.gra) / 4;
  return {
    rawMean: Number(rawMean.toFixed(4)),
    roundedBand: roundToIeltsBand(rawMean),
  };
}

export function calculateOverallWritingBand(
  task1Band: number,
  task2Band: number
): {
  weightedMean: number;
  overallBand: number;
} {
  const weightedMean = (task1Band + 2 * task2Band) / 3;
  return {
    weightedMean: Number(weightedMean.toFixed(4)),
    overallBand: roundToIeltsBand(weightedMean),
  };
}
```

---

## 4. Structured JSON Output Schema (Zod Specification)

```typescript
import { z } from "zod";

export const IeltsCriterionEnum = z.enum([
  "TASK_ACHIEVEMENT", // Task 1
  "TASK_RESPONSE", // Task 2
  "COHERENCE_COHESION",
  "LEXICAL_RESOURCE",
  "GRAMMATICAL_RANGE_ACCURACY",
]);

export const ErrorSeverityEnum = z.enum([
  "minor_slip", // Isolated typo or non-systematic slip
  "systematic_error", // Repeated structural/grammatical issue
  "impedes_communication", // Severely obscures intended meaning
]);

export const ErrorCategoryEnum = z.enum([
  // Grammar & Mechanics (GRA)
  "subject_verb_agreement",
  "tense_aspect_inconsistency",
  "article_determiner_misuse",
  "preposition_error",
  "relative_clause_fault",
  "run_on_sentence_or_comma_splice",
  "punctuation_error",
  "word_order_syntax",

  // Lexical Resource (LR)
  "imprecise_word_choice",
  "collocation_error",
  "spelling_mistake",
  "inappropriate_register_slang",
  "word_formation_morphology",

  // Coherence & Cohesion (CC)
  "mechanical_connector_overuse",
  "faulty_pronoun_referencing",
  "missing_paragraph_transition",
  "incoherent_sentence_progression",

  // Task Fulfillment (TA/TR)
  "missing_overview_feature", // Task 1
  "unsupported_claim", // Task 2
  "off_topic_tangent",
  "inaccurate_data_report", // Task 1
]);

export const DetectedErrorSchema = z.object({
  id: z.string().describe("Unique identifier for this error annotation"),
  criterion: IeltsCriterionEnum,
  category: ErrorCategoryEnum,
  severity: ErrorSeverityEnum,
  original_quote: z
    .string()
    .describe("Exact verbatim substring from the student text"),
  context_sentence: z
    .string()
    .describe("The full sentence containing the original quote"),
  explanation: z
    .string()
    .describe(
      "Clear explanation of why this is incorrect under IELTS standards"
    ),
  suggested_correction: z
    .string()
    .describe("Corrected replacement text or sentence restructuring"),
});

export const CriterionEvaluationSchema = z.object({
  score: z
    .number()
    .min(1.0)
    .max(9.0)
    .describe("Criterion band score in 0.5 increments"),
  justification: z
    .string()
    .describe(
      "Detailed rationale citing official May 2023 IELTS band descriptors"
    ),
  strengths: z
    .array(z.string())
    .describe("Key proficiencies demonstrated in this criterion"),
  areas_for_improvement: z
    .array(z.string())
    .describe("Specific gaps preventing the next higher band"),
});

export const BandUpgradeRecommendationSchema = z.object({
  category: z.enum(["lexical", "grammatical", "cohesive", "task_strategy"]),
  original_phrase_or_sentence: z
    .string()
    .describe("Original text segment from the essay"),
  upgraded_version: z
    .string()
    .describe("High-band (C1/C2 or Band 8.0+) alternative"),
  target_band_level: z.number().min(7.0).max(9.0),
  linguistic_principle: z
    .string()
    .describe("Explanation of why this upgrade enhances band score"),
});

export const ModelRevisionSchema = z.object({
  revised_introduction: z
    .string()
    .describe("Model rewrite of the introductory paragraph"),
  revised_sample_body_paragraph: z
    .string()
    .describe("Model rewrite of one body paragraph showing target structure"),
  key_enhancements_annotated: z
    .array(z.string())
    .describe(
      "List of structural and lexical techniques applied in the model rewrite"
    ),
});

export const IeltsWritingAssessmentSchema = z.object({
  task_type: z.enum(["TASK_1_ACADEMIC", "TASK_1_GENERAL", "TASK_2"]),
  word_count: z
    .number()
    .int()
    .positive()
    .describe("Exact calculated word count of the submission"),
  is_underlength: z
    .boolean()
    .describe("True if Task 1 < 150 words or Task 2 < 250 words"),

  // Chain of Thought / Examiner Reflection (Executed before scoring)
  internal_examiner_audit: z.object({
    task_fulfillment_notes: z.string(),
    cohesion_and_flow_notes: z.string(),
    lexical_sophistication_notes: z.string(),
    grammatical_accuracy_ratio_notes: z
      .string()
      .describe("Analysis of error-free sentences vs total sentences"),
  }),

  // Criterion Scoring Breakdown
  criteria: z.object({
    task_achievement_or_response: CriterionEvaluationSchema,
    coherence_and_cohesion: CriterionEvaluationSchema,
    lexical_resource: CriterionEvaluationSchema,
    grammatical_range_and_accuracy: CriterionEvaluationSchema,
  }),

  // Granular Error Diagnostics
  detected_errors: z.array(DetectedErrorSchema),

  // Actionable Upgrades
  upgrade_recommendations: z.array(BandUpgradeRecommendationSchema).min(3),

  // Exemplary Model Section
  model_revision: ModelRevisionSchema,

  // Overall Qualitative Summary
  examiner_summary: z
    .string()
    .describe(
      "Overall qualitative assessment and strategic advice for the student"
    ),
});

export type IeltsWritingAssessment = z.infer<
  typeof IeltsWritingAssessmentSchema
>;
```
