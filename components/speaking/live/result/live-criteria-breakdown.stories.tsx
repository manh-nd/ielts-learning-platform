import type { Meta, StoryObj } from "@storybook/react";
import { LiveCriteriaBreakdown } from "./live-criteria-breakdown";
import { expect, userEvent, within, fn } from "storybook/test";
import { IeltsSpeakingEvaluationResult } from "@/lib/gemini/speaking-schema";

const mockEvaluation: IeltsSpeakingEvaluationResult = {
  overallScorecard: {
    overallBand: 7.5,
    criteriaScores: {
      fluencyAndCoherence: 7.5,
      lexicalResource: 8.0,
      grammaticalRangeAndAccuracy: 7.0,
      pronunciation: 7.5,
    },
    criteria: {
      fluencyAndCoherence: {
        score: 7.5,
        summary:
          "Thí sinh diễn đạt trôi chảy, không gặp trở ngại khi mở rộng ý.",
        strengths: ["Tốc độ nói đều đặn", "Dùng liên từ đa dạng"],
        weaknesses: ["Thỉnh thoảng tự sửa câu"],
        estimatedWpm: 135,
        hesitationFrequency: "low",
        tips: ["Tập trung phát triển ý tưởng trừu tượng"],
      },
      lexicalResource: {
        score: 8.0,
        summary:
          "Sử dụng từ vựng linh hoạt, chuẩn xác trong ngữ cảnh học thuật.",
        strengths: ["Cụm từ cố định tự nhiên", "Không lặp từ"],
        weaknesses: ["Có một lỗi dùng giới từ nhỏ"],
        upgrades: [
          {
            originalExpression: "very good point",
            betterAlternative: "compelling argument",
            bandLevel: "Band 8.0+",
            contextExample:
              "This represents a compelling argument in favor of renewable energy.",
          },
        ],
        tips: ["Duy trì sử dụng collocations học thuật"],
      },
      grammaticalRangeAndAccuracy: {
        score: 7.0,
        summary:
          "Kết hợp tốt câu đơn và phức, đa phần các câu không có lỗi sai.",
        strengths: ["Dùng mệnh đề quan hệ chuẩn xác"],
        weaknesses: ["Nhầm thì quá khứ hoàn thành ở câu điều kiện"],
        complexStructuresCount: 10,
        errors: [
          {
            originalPhrase: "If I would know about this",
            correctedPhrase: "Had I known / If I had known about this",
            ruleViolated: "Third conditional structure",
            explanation:
              "Dùng quá khứ hoàn thành trong mệnh đề IF của câu điều kiện loại 3.",
          },
        ],
        tips: ["Luyện tập câu điều kiện loại 3"],
      },
      pronunciation: {
        score: 7.5,
        summary:
          "Phát âm rõ ràng, ngữ điệu tự nhiên, người nghe dễ dàng theo dõi.",
        strengths: ["Trọng âm từ chính xác", "Nối âm tự nhiên"],
        weaknesses: ["Âm đuôi /s/ đôi lúc bị nuốt"],
        intonationQuality: "natural",
        specificErrors: [
          {
            word: "comfortable",
            expectedIpa: "/ˈkʌmftəbl/",
            detectedIssue: "Phát âm thừa âm tiết thứ 3 (/kʌm-fɔː-teɪ-bl/)",
            recommendation: "Luyện phát âm 3 âm tiết",
          },
        ],
        tips: ["Chú ý âm đuôi /s/"],
      },
    },
    generalFeedback: {
      executiveSummary: "Tổng quan bài thi tốt.",
      keyStrengths: ["Nói trôi chảy", "Từ vựng phong phú"],
      priorityImprovements: ["Cải thiện ngữ pháp câu điều kiện"],
      actionPlan: ["Luyện nói hàng ngày"],
      practiceMonologue:
        "To be quite frank, I have always found myself to be exceptionally productive during the early morning hours, when ambient distractions are virtually nonexistent.",
    },
  },
  partEvaluations: [
    {
      partNumber: 1,
      itemIndex: 0,
      promptQuestion: "Do you prefer working in the morning or in the evening?",
      candidateTranscript:
        "I generally prefer working early in the morning because my concentration is at its peak.",
      verifiedTranscript:
        "I generally prefer working early in the morning because my concentration is at its peak.",
      partSummary: "Candidate responded clearly and fluently.",
      lexicalUpgrades: [],
      grammarCorrections: [],
      pronunciationNotes: [
        {
          word: "concentration",
          expectedIpa: "/ˌkɒnsnˈtreɪʃn/",
          detectedIssue: "Trọng âm rơi sai âm tiết thứ nhất",
          recommendation: "Nhấn trọng âm vào âm tiết thứ 3",
          timestampSeconds: 12,
        },
      ],
    },
  ],
  trace: {
    modelUsed: "gemini-2.5-flash",
    isFallback: false,
    fallbackReason: null,
    durationMs: 2400,
    tokensUsed: {
      promptTokens: 100,
      candidatesTokens: 200,
      totalTokens: 300,
    },
    keyFingerprint: "test-fp",
    timestamp: "2026-08-31T00:00:00.000Z",
  },
};

const meta: Meta<typeof LiveCriteriaBreakdown> = {
  title: "Speaking/Live/Result/CriteriaBreakdown",
  component: LiveCriteriaBreakdown,
  parameters: {
    layout: "centered",
  },
  args: {
    evaluationResult: mockEvaluation,
    onSeekToTime: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[820px] max-w-full p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LiveCriteriaBreakdown>;

export const DefaultCriteriaView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify 4 criteria cards rendered
    expect(canvas.getByText("Fluency & Coherence (FC)")).toBeInTheDocument();
    expect(canvas.getByText("Lexical Resource (LR)")).toBeInTheDocument();
    expect(
      canvas.getByText("Grammatical Range & Accuracy (GRA)")
    ).toBeInTheDocument();
    expect(canvas.getByText("Pronunciation (PR)")).toBeInTheDocument();

    // Verify vocabulary upgrade exists
    expect(canvas.getAllByText(/compelling argument/).length).toBeGreaterThan(
      0
    );

    // Verify model monologue exists
    expect(canvas.getByText(/Bài Nói Mẫu Band 8.0+/i)).toBeInTheDocument();
  },
};

export const PartByPartTab: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Switch to Part tab
    const partTabBtn = canvas.getByRole("tab", { name: /Đánh giá từng Part/i });
    await userEvent.click(partTabBtn);

    // Verify Part 1 prompt & transcript
    expect(
      canvas.getByText(/Do you prefer working in the morning/i)
    ).toBeInTheDocument();

    // Click timestamp button to seek
    const timestampBtn = canvas.getByRole("button", { name: /12s/i });
    await userEvent.click(timestampBtn);
    expect(args.onSeekToTime).toHaveBeenCalledWith(12);
  },
};
