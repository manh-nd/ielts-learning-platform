import type { Meta, StoryObj } from "@storybook/react";
import { LivePart1PracticeFeedback } from "./live-part1-practice-feedback";
import { expect, within, fn } from "storybook/test";
import { PracticeFeedback } from "@/lib/gemini/speaking-schema";

const mockPracticeFeedback: PracticeFeedback = {
  evidenceScope: {
    mode: "part_1",
    responseCount: 3,
  },
  estimatedPerformance: {
    fluencyAndCoherence: 7.0,
    lexicalResource: 7.5,
    grammaticalRangeAndAccuracy: 6.5,
    pronunciation: 7.0,
  },
  evidenceSufficiency: "sufficient_for_practice_feedback",
  summary:
    "Thí sinh phản xạ tốt với các câu hỏi quen thuộc về nơi sống và thói quen hàng ngày. Ngữ pháp tương đối chính xác nhưng cần thêm các cấu trúc phức tạp như câu chẻ (cleft sentences) hoặc liên từ tương phản để đạt band 7.5+.",
  strengths: [
    {
      criterion: "FC",
      observation: "Trả lời ngay lập tức không chần chừ, tốc độ nói tự nhiên.",
      suggestion: "Tiếp tục duy trì sự tự tin khi nói các chủ đề trừu tượng.",
    },
    {
      criterion: "LR",
      observation:
        "Dùng tốt các từ vựng cụ thể: residential area, amenities, bustling.",
      suggestion: "Bổ sung thêm collocations tự nhiên.",
    },
  ],
  priorities: [
    {
      criterion: "GRA",
      observation: "Chủ yếu dùng câu đơn và câu ghép với 'and', 'but'.",
      suggestion: "Thử dùng mệnh đề quan hệ và đảo ngữ để đa dạng cấu trúc.",
    },
  ],
};

const mockRecordedAudio = {
  blob: new Blob(["mock-audio"], { type: "audio/webm" }),
  url: "mock-audio-url",
  durationSeconds: 42,
  mimeType: "audio/webm",
};

const mockTranscripts = [
  {
    id: "t1",
    sender: "examiner",
    text: "Let's talk about your hometown. Where is your hometown located?",
    timestamp: 0,
  },
  {
    id: "t2",
    sender: "candidate",
    text: "I was born and raised in Da Nang, a coastal city in central Vietnam known for its scenic beaches and rapid modernization.",
    timestamp: 4000,
  },
];

const meta: Meta<typeof LivePart1PracticeFeedback> = {
  title: "Speaking/Live/Result/Part1PracticeFeedback",
  component: LivePart1PracticeFeedback,
  parameters: {
    layout: "centered",
  },
  args: {
    practiceFeedback: mockPracticeFeedback,
    recordedAudio: mockRecordedAudio,
    transcripts: mockTranscripts,
    candidateName: "Minh Anh",
    onRestartTest: fn(),
    onBackToDashboard: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[840px] max-w-full p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LivePart1PracticeFeedback>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify Part 1 practice badge & coaching header
    expect(canvas.getByText("Luyện tập Speaking Part 1")).toBeInTheDocument();
    expect(canvas.getByText(/Nhận xét Hướng dẫn Sư phạm/i)).toBeInTheDocument();

    // 2. Verify criteria estimation cards
    expect(canvas.getAllByText("Fluency & Coherence").length).toBeGreaterThan(
      0
    );
    expect(canvas.getAllByText("7.0").length).toBe(2);
    expect(canvas.getByText("7.5")).toBeInTheDocument();

    // 3. Verify Audio Waveform Player exists
    expect(canvas.getByText("Bản ghi âm Part 1 của bạn")).toBeInTheDocument();

    // 4. Verify Strengths & Priorities
    expect(canvas.getByText(/Điểm mạnh ghi nhận/i)).toBeInTheDocument();
    expect(canvas.getByText(/Ưu tiên cần khắc phục/i)).toBeInTheDocument();

    // 5. Verify Transcript
    expect(canvas.getByText(/Minh Anh/i)).toBeInTheDocument();
  },
};

export const LimitedEvidenceState: Story = {
  args: {
    practiceFeedback: {
      ...mockPracticeFeedback,
      evidenceSufficiency: "limited",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByText(/Bằng chứng câu trả lời còn ngắn/i)
    ).toBeInTheDocument();
  },
};
