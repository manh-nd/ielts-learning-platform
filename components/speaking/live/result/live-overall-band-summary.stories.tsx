import type { Meta, StoryObj } from "@storybook/react";
import { LiveOverallBandSummary } from "./live-overall-band-summary";
import { expect, within } from "storybook/test";

const meta: Meta<typeof LiveOverallBandSummary> = {
  title: "Speaking/Live/Result/OverallBandSummary",
  component: LiveOverallBandSummary,
  parameters: {
    layout: "centered",
  },
  args: {
    candidateName: "Nguyễn Văn A",
    testTitle: "IELTS Speaking Full Mock Test",
    scores: {
      fluencyAndCoherence: 7.5,
      lexicalResource: 8.0,
      grammaticalRangeAndAccuracy: 7.0,
      pronunciation: 7.5,
    },
    executiveSummary:
      "Thí sinh thể hiện năng lực phát âm và từ vựng tự nhiên, duy trì bài nói tốt mà không bị ngắt quãng dài. Cần chú ý hoàn thiện thêm một số cấu trúc đảo ngữ phức tạp.",
    keyStrengths: [
      "Diễn đạt mạch lạc, dùng discourse markers tự nhiên",
      "Vốn từ học thuật phong phú theo chủ đề môi trường",
      "Ngữ điệu và trọng âm câu tốt",
    ],
    priorityImprovements: [
      "Tránh sửa sai lặp lại khi nói cấu trúc điều kiện loại 3",
      "Kéo dài câu trả lời Part 3 bằng cách thêm dẫn chứng phản biện",
    ],
    traceMetadata: {
      modelUsed: "gemini-2.5-flash",
      isFallback: false,
      durationMs: 2400,
      tokensUsed: {
        promptTokens: 1200,
        candidatesTokens: 650,
        totalTokens: 1850,
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[780px] max-w-full p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LiveOverallBandSummary>;

export const Band75Proficient: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByText("IELTS Speaking Full Mock Test")
    ).toBeInTheDocument();
    expect(canvas.getByText(/CEFR: C1/i)).toBeInTheDocument();
    expect(canvas.getByText(/Điểm mạnh nổi bật/i)).toBeInTheDocument();
    expect(canvas.getByText(/Điểm cần cải thiện/i)).toBeInTheDocument();
  },
};

export const Band60Independent: Story = {
  args: {
    scores: {
      fluencyAndCoherence: 6.0,
      lexicalResource: 6.0,
      grammaticalRangeAndAccuracy: 5.5,
      pronunciation: 6.5,
    },
    executiveSummary:
      "Thí sinh giao tiếp tương đối tự tin, tuy nhiên còn lạm dụng một số từ nối đơn giản và ngập ngừng khi diễn đạt ý phức tạp.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/CEFR: B2/i)).toBeInTheDocument();
  },
};

export const Band85Mastery: Story = {
  args: {
    scores: {
      fluencyAndCoherence: 8.5,
      lexicalResource: 9.0,
      grammaticalRangeAndAccuracy: 8.5,
      pronunciation: 8.5,
    },
    executiveSummary:
      "Thí sinh sử dụng ngôn ngữ đặc biệt trôi chảy, linh hoạt và chuẩn xác ở cấp độ gần như người bản xứ.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/CEFR: C2/i)).toBeInTheDocument();
  },
};
