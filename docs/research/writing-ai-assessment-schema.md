# Research: IELTS Writing Assessment với Gemini Structured Outputs & Zod Schema

**Ticket:** #2  
**Tài liệu đích:** `docs/research/writing-ai-assessment-schema.md`  
**Status:** Approved Architectural Specification (Đã nâng cấp với Google GenAI SDK & Interactions API Structured Output)  
**Target Module:** IELTS Writing AI Evaluation Engine (Task 1 & Task 2)  
**Primary Standards:** Cambridge / IDP / British Council Official IELTS Band Descriptors (May 2023 Update) & CEFR Alignment

---

## 1. Tổng Quan Kiến Trúc Đánh Giá Writing với Gemini Structured Outputs

Hệ thống chấm IELTS Writing tự động sử dụng tính năng **Structured Outputs** của **Google Gemini Interactions API** (`@google/genai`). Cơ chế này đảm bảo mô hình trả về dữ liệu tuân thủ 100% định dạng JSON Schema định sẵn, loại bỏ hoàn toàn lỗi vỡ cấu trúc JSON (Broken JSON), sinh markdown rác, hoặc sai kiểu dữ liệu.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 STUDENT SUBMISSION                                       │
│   • Task Type: TASK_1_ACADEMIC | TASK_1_GENERAL | TASK_2                                 │
│   • Prompt Text + Chart/Table Description                                                │
│   • Student Essay Text (Clean Plain Text từ TipTap Editor)                               │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                    GEMINI INTERACTIONS API (Structured Output)                           │
│  • Model: gemini-3.5-flash-lite (Tier 1 Default) / gemini-3.7-flash (Deep Analysis)     │
│  • response_format: { type: "text", mime_type: "application/json", schema: jsonSchema }  │
│  • In-Schema Internal Examiner Audit (CoT chống lạm phát điểm)                          │
│  • 4 IELTS Criteria Sub-scores (TA/TR, CC, LR, GRA: 1.0 - 9.0 in 0.5 steps)              │
│  • Verbatim Grounded Detected Errors (original_quote + suggested_correction)            │
│  • Actionable Band Upgrade Recommendations (+0.5 / +1.0 Band)                            │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │ JSON Output (output_text)
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                          SERVER-SIDE VERIFICATION & MATH                                 │
│  1. Zod Runtime Validation: IeltsWritingAssessmentSchema.parse(json)                     │
│  2. Quote Grounding Verifier: Xác minh mọi original_quote tồn tại chính xác trong essay  │
│  3. Deterministic Arithmetic Rounding: Tính Overall Band theo chuẩn Cambridge            │
└────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                         PERSISTENCE & USER INTERFACE                                     │
│  • Lưu vào Aggregate AiAssessmentProposal                                                │
│  • Render lên Teacher Review Workspace (shadcn/ui + TipTap Error Highlights)             │
│  • Học viên xem báo cáo chi tiết kèm lộ trình nâng band                                  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tiêu Chí Chấm Điểm 4 Bảng Chuẩn IELTS (May 2023 Update)

Động cơ AI đánh giá bài viết theo 4 tiêu chí chính thức của Cambridge / IDP:

### 2.1 Task 1: Task Achievement (TA)

- **Academic Task 1:** Bắt buộc phải có **Overview** nêu rõ xu hướng chính/sự khác biệt nổi bật (Không có overview $\rightarrow$ tối đa Band 5.0). Lựa chọn và báo cáo số liệu chính xác, không đưa quan điểm cá nhân.
- **General Training Task 1:** Xác định rõ mục đích, văn phong nhất quán (Formal / Semi-formal / Informal), trả lời đầy đủ tất cả các ý trong prompt.

### 2.2 Task 2: Task Response (TR)

- **Trả lời đầy đủ yêu cầu đề bài:** Bao quát toàn bộ câu hỏi (Both views + opinion, Advantages/Disadvantages, Problem/Solution).
- **Lập trường rõ ràng (Clear Position Throughout):** Thể hiện rõ quan điểm xuyên suốt từ mở bài, thân bài đến kết luận.
- **Phát triển và mở rộng ý:** Luận điểm có dẫn chứng, giải thích logic, tránh kết luận chung chung, giáo điều.

### 2.3 Coherence & Cohesion (CC)

- **Cấu trúc đoạn văn (Paragraphing):** Mỗi đoạn thân bài tập trung vào một chủ đề trung tâm rõ ràng.
- **Phương tiện liên kết (Cohesive Devices):** Sử dụng đa dạng từ nối, đại từ thay thế (referencing), tránh lạm dụng từ nối cơ học (như _Firstly, Secondly, In a nutshell_).

### 2.4 Lexical Resource (LR)

- **Độ đa dạng & Chính xác:** Sử dụng từ vựng đúng ngữ cảnh, kết hợp từ tự nhiên (collocations), ít lỗi chính tả và biến hình từ (morphology).
- **Từ vựng học thuật ít phổ biến (Less Common Lexical Items):** Dùng tự nhiên ở band 7.0+.

### 2.5 Grammatical Range & Accuracy (GRA)

- **Độ đa dạng cấu trúc câu:** Kết hợp linh hoạt câu đơn, câu ghép, câu phức (mệnh đề quan hệ, câu điều kiện, câu bị động, đảo ngữ, rút gọn mệnh đề).
- **Tỷ lệ câu không lỗi (Error-Free Sentences Ratio):**
  - **Band 7.0:** $> 50\%$ tổng số câu không mắc lỗi ngữ pháp/chấm câu.
  - **Band 8.0:** $> 75\%$ câu hoàn toàn không có lỗi.

---

## 3. Thuật Toán Làm Tròn Điểm IELTS Chuẩn Server-Side

> [!IMPORTANT]
> **Nguyên tắc bất biến:** Không để LLM tự tính toán và làm tròn điểm Band tổng. LLM chỉ đánh giá 4 sub-scores ($TA, CC, LR, GRA$). Server sẽ tính trung bình cộng và làm tròn theo quy tắc ngưỡng chính thức của Cambridge.

### 3.1 Quy Tắc Làm Tròn Ngưỡng (Threshold Rules)

Cho trung bình cộng $M = \frac{TA + CC + LR + GRA}{4}$, phần nguyên $I = \lfloor M \rfloor$, phần dư $R = M - I$:

- Nếu $R < 0.25 \rightarrow$ Làm tròn xuống $I.0$ (Ví dụ: $6.125 \rightarrow \mathbf{6.0}$)
- Nếu $0.25 \le R < 0.75 \rightarrow$ Làm tròn thành $I.5$ (Ví dụ: $6.25 \rightarrow \mathbf{6.5}$, $6.625 \rightarrow \mathbf{6.5}$)
- Nếu $R \ge 0.75 \rightarrow$ Làm tròn lên $I + 1.0$ (Ví dụ: $6.75 \rightarrow \mathbf{7.0}$, $6.875 \rightarrow \mathbf{7.0}$)

### 3.2 Trọng Số Bài Viết Tổng Hợp (Task 1 + Task 2)

$$\text{Overall Writing Mean} = \frac{\text{Task 1 Band} + (2 \times \text{Task 2 Band})}{3}$$

---

## 4. Đặc Tả Zod Schema & JSON Schema cho Gemini Structured Output

File: `lib/ai/schemas/ielts-writing-schema.ts`

```typescript
import { z } from "zod";

export const IeltsTaskTypeEnum = z.enum([
  "TASK_1_ACADEMIC",
  "TASK_1_GENERAL",
  "TASK_2",
]);

export const IeltsCriterionEnum = z.enum([
  "TASK_ACHIEVEMENT",
  "TASK_RESPONSE",
  "COHERENCE_COHESION",
  "LEXICAL_RESOURCE",
  "GRAMMATICAL_RANGE_ACCURACY",
]);

export const ErrorSeverityEnum = z.enum([
  "minor_slip", // Lỗi nhỏ không ảnh hưởng truyền đạt
  "systematic_error", // Lỗi có hệ thống
  "impedes_communication", // Lỗi nghiêm trọng gây khó hiểu
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
  "missing_overview_feature",
  "unsupported_claim",
  "off_topic_tangent",
  "inaccurate_data_report",
]);

export const DetectedErrorSchema = z.object({
  id: z.string().describe("Unique identifier for this error, e.g. err_gra_1"),
  criterion: IeltsCriterionEnum,
  category: ErrorCategoryEnum,
  severity: ErrorSeverityEnum,
  original_quote: z
    .string()
    .describe(
      "Exact verbatim substring from the student essay (case-sensitive)"
    ),
  context_sentence: z
    .string()
    .describe("The full sentence in which the error occurred"),
  explanation: z
    .string()
    .describe(
      "Clear pedagogical explanation citing IELTS band descriptor rationale"
    ),
  suggested_correction: z
    .string()
    .describe("Recommended high-band natural correction or restructuring"),
});

export const CriterionEvaluationSchema = z.object({
  score: z
    .number()
    .min(1.0)
    .max(9.0)
    .describe("Criterion band score from 1.0 to 9.0 in 0.5 increments"),
  justification: z
    .string()
    .describe(
      "Detailed justification referencing May 2023 IELTS band descriptors"
    ),
  strengths: z
    .array(z.string())
    .describe("Demonstrated strengths in this criterion"),
  areas_for_improvement: z
    .array(z.string())
    .describe("Specific deficiencies preventing the next higher band"),
});

export const BandUpgradeRecommendationSchema = z.object({
  category: z.enum(["lexical", "grammatical", "cohesive", "task_strategy"]),
  original_phrase_or_sentence: z
    .string()
    .describe("Verbatim excerpt from student submission"),
  upgraded_version: z
    .string()
    .describe("High-band (C1/C2 or Band 8.0+) alternative expression"),
  target_band_level: z
    .number()
    .min(7.0)
    .max(9.0)
    .describe("Target band level achieved by this upgrade"),
  linguistic_principle: z
    .string()
    .describe("Why this upgrade elevates the band score"),
});

export const ModelRevisionSchema = z.object({
  revised_introduction: z
    .string()
    .describe("Exemplary rewrite of the student's introduction"),
  revised_sample_body_paragraph: z
    .string()
    .describe(
      "Exemplary rewrite of one body paragraph demonstrating structure"
    ),
  key_enhancements_annotated: z
    .array(z.string())
    .describe("List of enhancements applied in the revision"),
});

// Root Schema
export const IeltsWritingAssessmentSchema = z.object({
  task_type: IeltsTaskTypeEnum,
  word_count: z
    .number()
    .int()
    .positive()
    .describe("Calculated word count of the student submission"),
  is_underlength: z
    .boolean()
    .describe("True if Task 1 < 150 words or Task 2 < 250 words"),

  // Chain-of-Thought Audit
  internal_examiner_audit: z.object({
    task_fulfillment_notes: z
      .string()
      .describe("CoT notes on prompt requirements coverage & overview quality"),
    cohesion_and_flow_notes: z
      .string()
      .describe("CoT notes on paragraphing and linking device naturalness"),
    lexical_sophistication_notes: z
      .string()
      .describe("CoT notes on vocabulary range and collocation precision"),
    grammatical_accuracy_ratio_notes: z
      .string()
      .describe("CoT notes on error-free sentences ratio vs total sentences"),
  }),

  // Criterion Sub-scores
  criteria: z.object({
    task_achievement_or_response: CriterionEvaluationSchema,
    coherence_and_cohesion: CriterionEvaluationSchema,
    lexical_resource: CriterionEvaluationSchema,
    grammatical_range_and_accuracy: CriterionEvaluationSchema,
  }),

  // Granular Grounded Errors
  detected_errors: z.array(DetectedErrorSchema),

  // Actionable Band Upgrades
  upgrade_recommendations: z.array(BandUpgradeRecommendationSchema).min(3),

  // Model Revision
  model_revision: ModelRevisionSchema,

  // Qualitative Summary
  examiner_summary: z
    .string()
    .describe(
      "Comprehensive summary of strengths, weaknesses, and key priority actions"
    ),
});

export type IeltsWritingAssessment = z.infer<
  typeof IeltsWritingAssessmentSchema
>;
```

---

## 5. Tích Hợp Google GenAI SDK & Interactions API

### 5.1 JSON Schema Trực Tiếp Cho Interactions API (`response_format`)

```typescript
export const IELTS_WRITING_JSON_SCHEMA = {
  type: "object",
  properties: {
    task_type: {
      type: "string",
      enum: ["TASK_1_ACADEMIC", "TASK_1_GENERAL", "TASK_2"],
    },
    word_count: { type: "integer", description: "Word count" },
    is_underlength: { type: "boolean" },
    internal_examiner_audit: {
      type: "object",
      properties: {
        task_fulfillment_notes: { type: "string" },
        cohesion_and_flow_notes: { type: "string" },
        lexical_sophistication_notes: { type: "string" },
        grammatical_accuracy_ratio_notes: { type: "string" },
      },
      required: [
        "task_fulfillment_notes",
        "cohesion_and_flow_notes",
        "lexical_sophistication_notes",
        "grammatical_accuracy_ratio_notes",
      ],
    },
    criteria: {
      type: "object",
      properties: {
        task_achievement_or_response: {
          type: "object",
          properties: {
            score: {
              type: "number",
              description: "Band 1.0 to 9.0 in 0.5 steps",
            },
            justification: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            areas_for_improvement: { type: "array", items: { type: "string" } },
          },
          required: [
            "score",
            "justification",
            "strengths",
            "areas_for_improvement",
          ],
        },
        coherence_and_cohesion: {
          type: "object",
          properties: {
            score: { type: "number" },
            justification: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            areas_for_improvement: { type: "array", items: { type: "string" } },
          },
          required: [
            "score",
            "justification",
            "strengths",
            "areas_for_improvement",
          ],
        },
        lexical_resource: {
          type: "object",
          properties: {
            score: { type: "number" },
            justification: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            areas_for_improvement: { type: "array", items: { type: "string" } },
          },
          required: [
            "score",
            "justification",
            "strengths",
            "areas_for_improvement",
          ],
        },
        grammatical_range_and_accuracy: {
          type: "object",
          properties: {
            score: { type: "number" },
            justification: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            areas_for_improvement: { type: "array", items: { type: "string" } },
          },
          required: [
            "score",
            "justification",
            "strengths",
            "areas_for_improvement",
          ],
        },
      },
      required: [
        "task_achievement_or_response",
        "coherence_and_cohesion",
        "lexical_resource",
        "grammatical_range_and_accuracy",
      ],
    },
    detected_errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          criterion: {
            type: "string",
            enum: [
              "TASK_ACHIEVEMENT",
              "TASK_RESPONSE",
              "COHERENCE_COHESION",
              "LEXICAL_RESOURCE",
              "GRAMMATICAL_RANGE_ACCURACY",
            ],
          },
          category: { type: "string" },
          severity: {
            type: "string",
            enum: ["minor_slip", "systematic_error", "impedes_communication"],
          },
          original_quote: {
            type: "string",
            description: "Verbatim quote substring",
          },
          context_sentence: { type: "string" },
          explanation: { type: "string" },
          suggested_correction: { type: "string" },
        },
        required: [
          "id",
          "criterion",
          "category",
          "severity",
          "original_quote",
          "context_sentence",
          "explanation",
          "suggested_correction",
        ],
      },
    },
    upgrade_recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["lexical", "grammatical", "cohesive", "task_strategy"],
          },
          original_phrase_or_sentence: { type: "string" },
          upgraded_version: { type: "string" },
          target_band_level: { type: "number" },
          linguistic_principle: { type: "string" },
        },
        required: [
          "category",
          "original_phrase_or_sentence",
          "upgraded_version",
          "target_band_level",
          "linguistic_principle",
        ],
      },
    },
    model_revision: {
      type: "object",
      properties: {
        revised_introduction: { type: "string" },
        revised_sample_body_paragraph: { type: "string" },
        key_enhancements_annotated: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "revised_introduction",
        "revised_sample_body_paragraph",
        "key_enhancements_annotated",
      ],
    },
    examiner_summary: { type: "string" },
  },
  required: [
    "task_type",
    "word_count",
    "is_underlength",
    "internal_examiner_audit",
    "criteria",
    "detected_errors",
    "upgrade_recommendations",
    "model_revision",
    "examiner_summary",
  ],
};
```

---

## 6. Pipeline Thực Thi Hoàn Chỉnh (`lib/ai/writing-evaluator.ts`)

```typescript
import { GoogleGenAI } from "@google/genai";
import {
  IeltsWritingAssessmentSchema,
  IeltsWritingAssessment,
  IeltsTaskTypeEnum,
} from "./schemas/ielts-writing-schema";
import { IELTS_WRITING_JSON_SCHEMA } from "./schemas/ielts-writing-json-schema";
import { roundToIeltsBand, calculateTaskBand } from "./ielts-scoring";
import { z } from "zod";

const client = new GoogleGenAI({});

export interface WritingEvaluationInput {
  taskType: z.infer<typeof IeltsTaskTypeEnum>;
  promptTitle: string;
  promptBody: string;
  chartDataDescription?: string; // Bắt buộc cho Task 1 Academic
  essayText: string;
  isDeepAnalysis?: boolean; // Sử dụng gemini-3.7-flash nếu true
}

export interface EvaluatedWritingResult {
  assessment: IeltsWritingAssessment;
  scoring: {
    rawMean: number;
    overallTaskBand: number;
    criterionScores: {
      taOrTr: number;
      cc: number;
      lr: number;
      gra: number;
    };
  };
  groundingVerification: {
    totalErrors: number;
    groundedErrors: number;
    invalidQuotes: string[];
  };
}

/**
 * Executes Examiner-grade IELTS Writing evaluation with Gemini Structured Outputs
 */
export async function evaluateIeltsWritingSubmission(
  input: WritingEvaluationInput
): Promise<EvaluatedWritingResult> {
  const modelName = input.isDeepAnalysis
    ? "gemini-3.7-flash"
    : "gemini-3.5-flash-lite";

  const systemInstruction = `You are a Senior Cambridge Certified IELTS Examiner.
Evaluate the candidate's essay strictly according to the official May 2023 IELTS Band Descriptors.
You must conduct an internal audit first before assigning scores.
All quotes in detected_errors must be EXACT VERBATIM substrings from the candidate's text.
Do not inflate scores. Band 7+ requires substantial error-free grammar and natural collocation control.`;

  const userPrompt = `
TASK TYPE: ${input.taskType}
PROMPT TITLE: ${input.promptTitle}

PROMPT INSTRUCTIONS:
${input.promptBody}

${input.chartDataDescription ? `DATA / CHART DESCRIPTION:\n${input.chartDataDescription}\n` : ""}

CANDIDATE ESSAY TEXT:
"""
${input.essayText}
"""
`;

  // 1. Gọi Gemini Interactions API với Structured Output response_format
  const interaction = await client.interactions.create({
    model: modelName,
    input: `${systemInstruction}\n\n${userPrompt}`,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: IELTS_WRITING_JSON_SCHEMA,
    },
  });

  if (!interaction.output_text) {
    throw new Error(
      `Gemini evaluation returned empty output_text from model ${modelName}`
    );
  }

  // 2. Parse JSON & Validate với Zod Schema
  const rawParsed = JSON.parse(interaction.output_text);
  const validatedAssessment: IeltsWritingAssessment =
    IeltsWritingAssessmentSchema.parse(rawParsed);

  // 3. Verbatim Quote Grounding Check
  const invalidQuotes: string[] = [];
  let groundedCount = 0;

  validatedAssessment.detected_errors.forEach((err) => {
    if (input.essayText.includes(err.original_quote)) {
      groundedCount++;
    } else {
      invalidQuotes.push(err.original_quote);
      console.warn(
        `[Grounding Warning] Hallucinated error quote detected: "${err.original_quote}"`
      );
    }
  });

  // Lọc bỏ các lỗi không tồn tại trong văn bản thực tế
  const filteredErrors = validatedAssessment.detected_errors.filter(
    (err) => !invalidQuotes.includes(err.original_quote)
  );
  validatedAssessment.detected_errors = filteredErrors;

  // 4. Tính toán điểm toán học chuẩn xác
  const criterionScores = {
    taOrTr: validatedAssessment.criteria.task_achievement_or_response.score,
    cc: validatedAssessment.criteria.coherence_and_cohesion.score,
    lr: validatedAssessment.criteria.lexical_resource.score,
    gra: validatedAssessment.criteria.grammatical_range_and_accuracy.score,
  };

  const { rawMean, roundedBand } = calculateTaskBand(criterionScores);

  return {
    assessment: validatedAssessment,
    scoring: {
      rawMean,
      overallTaskBand: roundedBand,
      criterionScores,
    },
    groundingVerification: {
      totalErrors: rawParsed.detected_errors?.length || 0,
      groundedErrors: groundedCount,
      invalidQuotes,
    },
  };
}
```

---

## 7. Hỗ Trợ Streaming Structured Output

Gemini Interactions API cho phép truyền luồng dữ liệu structured JSON theo thời gian thực (`stream: true`), giúp giao diện hiển thị dần kết quả đánh giá (Progressive Rendering):

```typescript
export async function* streamIeltsWritingEvaluation(
  input: WritingEvaluationInput
) {
  const modelName = input.isDeepAnalysis
    ? "gemini-3.7-flash"
    : "gemini-3.5-flash-lite";

  const stream = await client.interactions.create({
    model: modelName,
    input: `Evaluate this IELTS essay:\n\n${input.essayText}`,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: IELTS_WRITING_JSON_SCHEMA,
    },
    stream: true,
  });

  let accumulatedJson = "";

  for await (const event of stream) {
    if (
      event.event_type === "step.delta" &&
      event.delta.type === "text" &&
      event.delta.text
    ) {
      accumulatedJson += event.delta.text;
      yield { chunk: event.delta.text, accumulated: accumulatedJson };
    }
  }
}
```

---

## 8. Bảng Tổng Kết Nghiên Cứu

| Hạng mục                  | Giải pháp Kỹ thuật                                                                                                 |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------- |
| **API Chuẩn**             | Google GenAI SDK (`@google/genai`) Interactions API (`client.interactions.create`).                                |
| **Đảm bảo Cấu trúc JSON** | `response_format: { type: "text", mime_type: "application/json", schema: ... }`.                                   |
| **Type Safety**           | Zod Schema (`IeltsWritingAssessmentSchema`) + JSON Schema chuẩn.                                                   |
| **Chống Lạm phát điểm**   | `internal_examiner_audit` (CoT) thực hiện trước khi sinh điểm số các tiêu chí.                                     |
| **Chống Ảo giác Lỗi**     | Verbatim Quote Substring Verification (loại bỏ quote không khớp văn bản gốc).                                      |
| **Tính toán Điểm số**     | Server-side arithmetic mean + Cambridge rounding rules ($<0.25 \to .0$, $0.25..0.75 \to .5$, $\ge 0.75 \to +1.0$). |
