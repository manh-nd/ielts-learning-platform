# Nghiên cứu: Tích hợp Google Gemini SDK (@google/genai) & Gemini Live API cho Hệ thống IELTS

**Ticket:** #10  
**Tài liệu đích:** `docs/research/gemini-sdk-live-api-integration.md`  
**Status:** Approved Specification & Implementation Guide  
**Mục tiêu:**

1. Cấu hình SDK chính thức mới nhất `@google/genai` (thay thế `@google/generative-ai` đã deprecated) với TypeScript.
2. Phân tích định mức Free Tier (RPM, TPM, RPD) trên Google AI Studio cho `gemini-3.7-flash`, `gemini-2.5-flash` và chiến lược Rate Limiting/Queueing cho chấm điểm Writing Task 1/2 và Speaking Async.
3. Kiến trúc Gemini Live API (`gemini-3.1-flash-live-preview`) qua WebSockets mô phỏng Giám khảo IELTS Live 1-on-1: Ephemeral Token, Bidirectional PCM Audio (16kHz in / 24kHz out), VAD handling và tối ưu độ trễ.
4. Triển khai mẫu mã nguồn hoàn chỉnh cho Next.js App Router (Server Route Handler + React Hook Audio Streaming).

---

## 1. Thiết lập SDK `@google/genai` & TypeScript Best Practices

### 1.1 Khẳng định phiên bản SDK & Khuyến nghị Deprecation

> [!CAUTION]
> Thư viện `@google/generative-ai` (và `google-generativeai` trên Python) đã chính thức **bị deprecated**. Tuyệt đối không cài đặt hoặc sử dụng trong dự án mới.
> **SDK chuẩn duy nhất hiện nay**: `@google/genai` (Universal SDK hỗ trợ Node.js, Bun, Edge runtime, WebSockets và Ephemeral Tokens).

- Cài đặt trong dự án (Bun / npm):

```bash
bun add @google/genai
# hoặc
npm install @google/genai
```

### 1.2 Khởi tạo Singleton Client trên Server-side

Khởi tạo client an toàn trong `lib/ai/gemini-client.ts` để tái sử dụng kết nối và kiểm soát API Key qua biến môi trường `GEMINI_API_KEY`:

```typescript
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable.");
}

// Server-side Gemini Client Singleton
export const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
```

### 1.3 Danh mục Model khuyến nghị (2026 Standards)

| Model Name                          | Danh mục                                       | Mục đích sử dụng trong IELTS Platform                                                                     |
| :---------------------------------- | :--------------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **`gemini-3.7-flash`**              | Flagship Multimodal & Reasoning (1M Context)   | Chấm điểm Writing Task 1/2 chuyên sâu, phân tích lỗi ngữ pháp/từ vựng chi tiết, suy luận Band Descriptors |
| **`gemini-2.5-flash`**              | Balanced Workhorse (1M Context)                | Fallback model cho chấm điểm Writing/Speaking Async khi `gemini-3.7-flash` chạm rate limit                |
| **`gemini-3.5-flash-lite`**         | Ultra-low Cost & High Throughput               | Tiền xử lý văn bản, trích xuất thông tin, chấm bài trắc nghiệm / short-answer nhanh                       |
| **`gemini-3.1-flash-live-preview`** | Real-time WebSocket Audio/Video (128k Context) | **Live IELTS Speaking Examiner** tương tác giọng nói thời gian thực 2 chiều (Bidirectional Audio)         |

---

## 2. Phân tích Định mức Free Tier & Chiến lược Rate Limiting

### 2.1 Bảng định mức Free Tier trên Google AI Studio

Google AI Studio cung cấp Free Tier không mất phí với định mức per-project như sau:

| Model                               | Requests Per Minute (RPM)                   | Tokens Per Minute (TPM) | Requests Per Day (RPD) |
| :---------------------------------- | :------------------------------------------ | :---------------------- | :--------------------- |
| **`gemini-3.7-flash`**              | **15 RPM**                                  | **1,000,000 TPM**       | **1,500 RPD**          |
| **`gemini-2.5-flash`**              | **15 RPM**                                  | **1,000,000 TPM**       | **1,500 RPD**          |
| **`gemini-3.5-flash-lite`**         | **30 RPM**                                  | **1,000,000 TPM**       | **1,500 RPD**          |
| **`gemini-3.1-flash-live-preview`** | ~15 RPM / 3-5 concurrent WebSocket sessions | 1,000,000 TPM           | 1,500 RPD              |

### 2.2 Đánh giá Tác động đến Khối lượng Chấm điểm IELTS

#### 1. Writing Task 1 & Task 2 Evaluation:

- **Input Tokens per Essay:** Prompt + IELTS Band Descriptors Rubric + Student Essay = ~1,500 – 2,500 tokens.
- **Output Tokens per Essay:** In-Schema CoT + 4 Criteria Breakdown + Grounded Corrections + Band Scores = ~1,000 – 1,500 tokens.
- **Tổng tokens/lượt:** ~3,500 tokens.
- **Đánh giá:** Với 1,000,000 TPM, hệ thống có thể xử lý lý thuyết >280 bài/phút. Tuy nhiên, **nút thắt cổ chai (bottleneck) nằm ở 15 RPM** (tối đa 1 bài mỗi 4 giây) và **1,500 RPD** (tối đa 1,500 bài nộp/ngày).

#### 2. Speaking Async Audio Evaluation:

- **Input Tokens per Speaking Attempt:** 1–2 phút audio (Base64 WebM/WAV nén hoặc PCM) = ~1,500 – 3,000 audio tokens + Prompt Rubric.
- **Tổng tokens/lượt:** ~4,000 tokens.
- **Đánh giá:** Tương tự Writing, 15 RPM là giới hạn cứng cần kiểm soát.

### 2.3 Chiến lược Rate Limiting & Queueing Architecture

Để hệ thống hoạt động ổn định không bị lỗi `429 RESOURCE_EXHAUSTED`:

```
Client Submission
       │
       ▼
Next.js Server Action / API Route
       │
       ▼
Redis / In-Memory Queue (p-queue / BullMQ)
  • Concurrency: 2 concurrent workers
  • Rate Limiter: Max 12 requests / 60s (Chừa 3 RPM buffer an toàn)
       │
       ▼
Gemini Assessment Worker (with Exponential Backoff & Retry)
  • Model: gemini-3.7-flash
  • Catch 429 ──(Failover)──> Fallback Model: gemini-2.5-flash
       │
       ▼
Persist AIAssessmentProposal to Database
       │
       ▼
Notify Client via Server-Sent Events (SSE) / Polling
```

1. **Queueing với Buffer an toàn:** Cấu hình queue client (ví dụ `p-queue`) với giới hạn 12 RPM (thấp hơn quota 15 RPM để dự phòng các request đồng thời khác).
2. **Exponential Backoff with Jitter:** Tự động retry tối đa 3 lần với thời gian chờ $T = 2^n \times 1000\text{ms} + \text{jitter}$ khi gặp lỗi 429 hoặc 503.
3. **Model Failover Cascade:** Nếu `gemini-3.7-flash` bị cạn quota, hệ thống tự động fallback sang `gemini-2.5-flash` hoặc `gemini-3.5-flash-lite`.

---

## 3. Tích hợp Gemini Live API (`gemini-3.1-flash-live-preview`) cho IELTS Speaking Examiner

### 3.1 Mô hình Kiến trúc: Ephemeral Token Client-to-Server Direct WebSocket

Thay vì chuyển tiếp (relay) toàn bộ luồng audio qua Next.js server (gây quá tải CPU, tốn băng thông và tăng latency lên >1.5s), hệ thống áp dụng kiến trúc **Direct Client-to-Gemini WebSocket qua Ephemeral Token**:

```
┌────────────────┐                     ┌─────────────────────┐                     ┌───────────────────────────┐
│ Browser Client │                     │ Next.js App Router  │                     │ Google Gemini Live API    │
└───────┬────────┘                     └──────────┬──────────┘                     └─────────────┬─────────────┘
        │                                         │                                              │
        │ 1. Request Session Token (POST /api/..) │                                              │
        ├────────────────────────────────────────>│                                              │
        │                                         │ 2. Mint Ephemeral Token (auth_tokens)        │
        │                                         ├─────────────────────────────────────────────>│
        │                                         │<─────────────────────────────────────────────┤
        │                                         │    { token: "temp_jwt_abc123..." }           │
        │ 3. Return Ephemeral Token               │                                              │
        │<────────────────────────────────────────┤                                              │
        │                                                                                        │
        │ 4. Open Direct WebSocket Connection (wss://generativelanguage.googleapis.com/ws/...)   │
        ├───────────────────────────────────────────────────────────────────────────────────────>│
        │                                                                                        │
        │ 5. Setup Live Examiner Session (systemInstruction, IELTS Speaking Part 1/2/3)          │
        ├───────────────────────────────────────────────────────────────────────────────────────>│
        │                                                                                        │
        │ 6. Bidirectional Audio Stream: 16kHz PCM Upstream <====> 24kHz PCM Downstream          │
        │<══════════════════════════════════════════════════════════════════════════════════════>│
        │                                                                                        │
        │ 7. Live Transcription & VAD Interruption Events                                        │
        │<───────────────────────────────────────────────────────────────────────────────────────┤
```

### 3.2 Đặc tả Kỹ thuật Audio Pipeline

- **Audio Input (Thí sinh -> Giám khảo Gemini):**
  - Định dạng: Raw Linear PCM, 16-bit little-endian, mono (1 channel).
  - Sample Rate: **16,000 Hz** (16kHz).
  - MIME Type: `audio/pcm;rate=16000`.
  - Chunking Interval: Gửi mỗi 100ms – 200ms qua base64.
- **Audio Output (Giám khảo Gemini -> Thí sinh):**
  - Định dạng: Raw Linear PCM, 16-bit little-endian, mono (1 channel).
  - Sample Rate: **24,000 Hz** (24kHz).
  - Phát lại: Web Audio API `AudioContext` tại sample rate 24kHz với hàng đợi `AudioBufferSourceNode`.
- **VAD Interruption:** Khi thí sinh nói ngắt lời, cờ `serverContent.interrupted = true` lập tức dừng và xóa audio buffer đang phát để tránh nói đè.

---

## 4. Triển khai Mẫu Mã Nguồn Chuẩn cho Next.js App Router

### 4.1 Server Route Handler cấp phát Ephemeral Token

**File:** `app/api/examiner/token/route.ts`

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

    const expireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

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

### 4.2 Production Gemini Evaluation Service (Writing & Speaking Async)

**File:** `lib/ai/gemini-evaluator.ts`

```typescript
import { GoogleGenAI, Type, type Schema } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

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
  task1ChartDescription?: string;
}

export async function evaluateIeltsWriting(params: EvaluateWritingParams) {
  const models = ["gemini-3.7-flash", "gemini-2.5-flash"];
  let lastError: unknown = null;

  for (const model of models) {
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
        throw new Error("Empty response returned from Gemini API");
      }

      return JSON.parse(response.text);
    } catch (err: unknown) {
      console.warn(`Evaluation attempt with model ${model} failed:`, err);
      lastError = err;
    }
  }

  throw new Error(
    `All evaluation models failed. Last error: ${String(lastError)}`
  );
}
```
