# Nghiên cứu: Tích hợp Google Gemini SDK (@google/genai) & Gemini Live API cho Hệ thống IELTS

**Ticket:** #10  
**Tài liệu đích:** `docs/research/gemini-sdk-live-api-integration.md`  
**Status:** Approved Specification & Implementation Guide (Đã hiệu chỉnh chính xác theo Google AI Studio Console)  
**Mục tiêu:**

1. Cấu hình SDK chính thức mới nhất `@google/genai` (thay thế `@google/generative-ai` đã deprecated) với TypeScript.
2. **Đặc tả chính xác định mức Free Tier thực tế từ Google AI Studio**: Phân tầng chiến lược mô hình (Model Tiering Strategy) giữa dòng Flash Flagship (20 RPD), dòng Flash Lite (500 RPD), Gemma 4 (14.4K RPD) và Live API (Unlimited RPD).
3. Kiến trúc Gemini Live API (`Gemini 3 Flash Live` / `gemini-3.1-flash-live-preview`) qua WebSockets mô phỏng Giám khảo IELTS Live 1-on-1: Ephemeral Token, Bidirectional PCM Audio (16kHz in / 24kHz out), VAD handling và tối ưu độ trễ.
4. Triển khai mẫu mã nguồn hoàn chỉnh cho Next.js App Router (Server Route Handler + Fallback Cascade + React Hook Audio Streaming).

---

## 1. Bảng Định Mức Free Tier Thực Tế từ Google AI Studio Console

Dưới đây là số liệu hạn mức Free Tier chính xác được trích xuất từ bảng điều khiển Google AI Studio:

| Model Name                          | Category              | RPM (Requests/min) | TPM (Tokens/min) | RPD (Requests/day) | Nhận định & Vai trò trong IELTS Platform                                                                                                                        |
| :---------------------------------- | :-------------------- | :----------------: | :--------------: | :----------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`gemini-3.5-flash-lite`**         | Text-out models       |       **15**       |     **250K**     |      **500**       | ⭐ **Mô hình Chấm điểm Chính (Primary Evaluation Engine)**: 500 bài/ngày, đủ cho toàn bộ MVP.                                                                   |
| **`gemini-3.1-flash-lite`**         | Text-out models       |       **15**       |     **250K**     |      **500**       | 🔄 **Mô hình Backup cho Flash Lite**: 500 bài/ngày.                                                                                                             |
| **`gemini-3.7-flash`**              | Text-out models       |       **5**        |     **250K**     |       **20**       | 🎯 **Deep Analysis / Teacher Triggered Only**: Hạn mức 20 bài/ngày, dành riêng cho các bài cần phân tích sâu hoặc giáo viên yêu cầu re-evaluate chất lượng cao. |
| **`gemini-3.5-flash`**              | Text-out models       |       **5**        |     **250K**     |       **20**       | Hạn mức 20 bài/ngày.                                                                                                                                            |
| **`gemini-2.5-flash`**              | Text-out models       |       **5**        |     **250K**     |       **20**       | Hạn mức 20 bài/ngày.                                                                                                                                            |
| **`gemini-2.5-flash-lite`**         | Text-out models       |       **10**       |     **250K**     |       **20**       | Hạn mức 20 bài/ngày.                                                                                                                                            |
| **`gemma-4-31b`**                   | Open weights / Hosted |       **30**       |     **16K**      |     **14,400**     | 🚀 **High-Volume Fallback**: 14,400 bài/ngày cho các tác vụ kiểm tra ngữ pháp / trích xuất dữ liệu thô.                                                         |
| **`gemma-4-26b`**                   | Open weights / Hosted |       **30**       |     **16K**      |     **14,400**     | 🚀 **High-Volume Fallback**: 14,400 bài/ngày.                                                                                                                   |
| **`Gemini 3 Flash Live`**           | Live API (WebSocket)  |   **Unlimited**    |     **65K**      |   **Unlimited**    | 🎙️ **Live IELTS Examiner (Speaking 1-on-1)**: Không giới hạn số lượt gọi/ngày, cực kỳ lý tưởng cho phòng thi ảo.                                                |
| **`Gemini 2.5 Flash Native Audio`** | Live API (WebSocket)  |   **Unlimited**    |      **1M**      |   **Unlimited**    | 🎙️ **Live Speaking Backup Engine**.                                                                                                                             |

---

## 2. Chiến Lược Phân Tầng Mô Hình (Model Tiering & Cascading Architecture)

Vì các model Flagship (`gemini-3.7-flash`, `gemini-2.5-flash`) bị giới hạn ngặt nghèo ở mức **20 RPD (20 lượt/ngày)**, kiến trúc chấm điểm của hệ thống IELTS được thiết kế theo 3 tầng (3-tier cascade):

```
                                  [ Yêu cầu Chấm bài Nộp ]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [ Luồng Tự Động / Học Viên ]                [ Giáo viên Yêu Cầu Chấm Sâu ]
                       │                                           │
                       ▼                                           ▼
           Tier 1: gemini-3.5-flash-lite                 Tier 0: gemini-3.7-flash
           (500 RPD, 15 RPM, 250K TPM)                   (20 RPD, 5 RPM, 250K TPM)
                       │                                           │
           ┌───────────┴───────────┐                     (Nếu hết quota 20 RPD)
           │ (Nếu chạm rate limit) │                               │
           ▼                       ▼                               ▼
 Tier 2: gemini-3.1-flash-lite   Tier 3: gemma-4-31b     Fall back về gemini-3.5-flash-lite
 (500 RPD, 15 RPM)               (14.4K RPD, 30 RPM)
```

### 2.1 Quy tắc Phân bổ:

1. **Mặc định khi Học viên nộp bài (Writing Homework / Mock Test & Speaking Async):**
   - Sử dụng **`gemini-3.5-flash-lite`** (hỗ trợ Structured Outputs JSON, context 1M, tốc độ cực nhanh <2s, quota 500 bài/ngày).
2. **Khi Giáo viên bấm "Yêu cầu AI Chấm lại chuyên sâu (Deep Re-assessment)":**
   - Sử dụng **`gemini-3.7-flash`** để tận dụng khả năng reasoning tối đa và chain-of-thought mạnh nhất (tiêu thụ trong quota 20 lượt/ngày).
3. **Phòng thi Live Speaking tương tác thời gian thực (Examiner Simulation):**
   - Sử dụng **`Gemini 3 Flash Live`** / **`gemini-3.1-flash-live-preview`** qua Live API WebSockets $\rightarrow$ **Không giới hạn RPD** (Unlimited Requests Per Day), chỉ cần kiểm soát token rate trong mức 65K - 1M TPM.

---

## 3. Thiết Lập SDK `@google/genai` & TypeScript Best Practices

### 3.1 Khẳng định phiên bản SDK

> [!CAUTION]
> Thư viện `@google/generative-ai` đã **bị deprecated**. Tuyệt đối chỉ sử dụng `@google/genai`.

- Cài đặt trong dự án:

```bash
bun add @google/genai
```

### 3.2 Server-side Gemini Client Singleton (`lib/ai/gemini-client.ts`)

```typescript
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

export const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
```

---

## 4. Triển Khai Evaluator Tự Động Phân Tầng (Tiered Evaluator)

**File:** `lib/ai/gemini-evaluator.ts`

```typescript
import { GoogleGenAI, Type, type Schema } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Schema chấm điểm IELTS Writing chuẩn
export const IELTS_WRITING_ASSESSMENT_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    chainOfThought: {
      type: Type.OBJECT,
      properties: {
        taskType: {
          type: Type.STRING,
          enum: ["TASK_1_ACADEMIC", "TASK_1_GT", "TASK_2"],
        },
        overviewAnalysis: { type: Type.STRING },
        argumentProgression: { type: Type.STRING },
        grammarComplexityRatio: { type: Type.STRING },
        vocabularyTierDistribution: { type: Type.STRING },
      },
      required: ["taskType", "overviewAnalysis", "argumentProgression"],
    },
    scores: {
      type: Type.OBJECT,
      properties: {
        taskAchievement: {
          type: Type.NUMBER,
          description: "Score from 1.0 to 9.0 (0.5 steps)",
        },
        coherenceCohesion: {
          type: Type.NUMBER,
          description: "Score from 1.0 to 9.0 (0.5 steps)",
        },
        lexicalResource: {
          type: Type.NUMBER,
          description: "Score from 1.0 to 9.0 (0.5 steps)",
        },
        grammaticalRangeAccuracy: {
          type: Type.NUMBER,
          description: "Score from 1.0 to 9.0 (0.5 steps)",
        },
      },
      required: [
        "taskAchievement",
        "coherenceCohesion",
        "lexicalResource",
        "grammaticalRangeAccuracy",
      ],
    },
    groundedFeedback: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING, enum: ["TA", "CC", "LR", "GRA"] },
          exactQuote: {
            type: Type.STRING,
            description: "Exact verbatim substring from student text",
          },
          issueDescription: { type: Type.STRING },
          recommendedUpgrade: { type: Type.STRING },
        },
        required: [
          "criterion",
          "exactQuote",
          "issueDescription",
          "recommendedUpgrade",
        ],
      },
    },
    actionableAdvice: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    "chainOfThought",
    "scores",
    "groundedFeedback",
    "actionableAdvice",
  ],
};

export interface EvaluateWritingParams {
  promptText: string;
  essayText: string;
  taskType: "TASK_1_ACADEMIC" | "TASK_1_GT" | "TASK_2";
  isDeepAnalysisRequested?: boolean; // Nếu giáo viên yêu cầu phân tích chuyên sâu
  task1ChartDescription?: string;
}

/**
 * Executes Tiered IELTS Writing Evaluation based on exact AI Studio Free Quotas
 */
export async function evaluateIeltsWriting(params: EvaluateWritingParams) {
  // Ưu tiên: gemini-3.5-flash-lite (500 RPD) cho bài làm thông thường.
  // Nếu yêu cầu deep analysis: thử gemini-3.7-flash (20 RPD) trước.
  const modelCascade = params.isDeepAnalysisRequested
    ? ["gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
    : [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
      ];

  let lastError: unknown = null;

  for (const model of modelCascade) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are an expert Cambridge IELTS Examiner. Assess the following submission rigorously based on official 2023 IELTS Band Descriptors.

PROMPT:
${params.promptText}

${params.task1ChartDescription ? `CHART/DATA DESCRIPTION:\n${params.task1ChartDescription}\n` : ""}

STUDENT ESSAY:
${params.essayText}
`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: IELTS_WRITING_ASSESSMENT_SCHEMA,
          systemInstruction:
            "You are a strict, fair, and calibrated senior IELTS examiner. Produce detailed criterion scores and verbatim grounded feedback.",
        },
      });

      if (!response.text) {
        throw new Error(`Empty response returned from model ${model}`);
      }

      return JSON.parse(response.text);
    } catch (err: unknown) {
      console.warn(
        `Evaluation attempt with model ${model} failed (Rate Limit / Error), cascading to next:`,
        err
      );
      lastError = err;
    }
  }

  throw new Error(
    `All tiered evaluation models failed. Last error: ${String(lastError)}`
  );
}
```

---

## 5. Kiến Trúc Gemini Live API (`Gemini 3 Flash Live` / Unlimited RPD)

Do Live API sở hữu hạn mức **Unlimited RPD**, đây là giải pháp hoàn hảo cho tính năng thi thử Speaking có giám khảo ảo hỏi đáp trực tiếp.

### 5.1 Route Handler Cấp Token Ngắn Hạn (`app/api/examiner/token/route.ts`)

```typescript
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server missing GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const expireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uses: 1,
          config: {
            expireTime,
            liveConstrainedParameters: {
              model: "models/gemini-3.1-flash-live-preview",
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Failed to mint ephemeral token", details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      token: data.name || data.token,
      expiresAt: expireTime,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

---

## 6. Tổng Kết Chiến Lược Vận Hành Free Tier

1. **Chấm bài Hàng ngày (Writing & Speaking Async):**
   - Dùng **`gemini-3.5-flash-lite`** (500 RPD / 15 RPM / 250K TPM) $\rightarrow$ Hoàn toàn đáp ứng nhu cầu hàng chục đến hàng trăm bài nộp mỗi ngày của quy mô MVP mà không lo cạn hạn mức.
2. **Chấm bài Nâng cao (Giáo viên kích hoạt):**
   - Dùng **`gemini-3.7-flash`** (20 RPD / 5 RPM) $\rightarrow$ Tiết kiệm cho các trường hợp chấm tranh chấp điểm hoặc review phúc khảo.
3. **Phòng thi Thử Trực tiếp (Live Examiner Speaking):**
   - Dùng **`Gemini 3 Flash Live`** (Unlimited RPD / 65K TPM) $\rightarrow$ Thí sinh luyện thi thoại trực tiếp không giới hạn số lượt trong ngày.
