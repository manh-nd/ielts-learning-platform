import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import { AssessmentScorecard } from "./assessment-scorecard";
import { AssessmentScores } from "./types";

const mockAiScores: AssessmentScores = {
  TASK_ACHIEVEMENT: 6.0,
  COHERENCE_COHESION: 6.5,
  LEXICAL_RESOURCE: 6.0,
  GRAMMATICAL_RANGE_ACCURACY: 6.5,
};

const mockTeacherScores: AssessmentScores = {
  TASK_ACHIEVEMENT: 6.5,
  COHERENCE_COHESION: 6.5,
  LEXICAL_RESOURCE: 7.0,
  GRAMMATICAL_RANGE_ACCURACY: 6.5,
};

const meta: Meta<typeof AssessmentScorecard> = {
  title: "IELTS/Assessment/AssessmentScorecard",
  component: AssessmentScorecard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Thẻ điểm tổng hợp IELTS AssessmentScorecard tính toán Overall Band Score chuẩn xác theo quy tắc làm tròn quốc tế, hỗ trợ so sánh AI Proposal vs Teacher Score và tác vụ Chấp nhận toàn bộ AI.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AssessmentScorecard>;

/**
 * 1. Interactive Teacher Grading Session
 */
export const InteractiveTeacherReview: Story = {
  render: function InteractiveDemo() {
    const [scores, setScores] = useState<AssessmentScores>(mockTeacherScores);

    return (
      <div className="max-w-2xl mx-auto">
        <AssessmentScorecard
          scores={scores}
          aiProposalScores={mockAiScores}
          mode="interactive"
          taskType="TASK_2"
          title="Đánh Giá Bài Viết Task 2 — Học Viên Nguyễn Văn A"
          examinerFeedback="Bài viết có lập luận rõ ràng, vốn từ phong phú. Cần lưu ý hạn chế một số lỗi ngữ pháp về thì động từ ở đoạn thân bài 2."
          onScoresChange={(newScores) => setScores(newScores)}
        />
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("1. Kiểm tra Overall Band ban đầu là 6.5", async () => {
      const overallBadge = canvas.getByTestId("overall-band-badge");
      await expect(overallBadge).toHaveTextContent("6.5");

      const aiOverall = canvas.getByTestId("ai-overall-text");
      await expect(aiOverall).toHaveTextContent("6.5");
    });

    await step(
      "2. Tăng điểm Lexical Resource lên 8.0 và kiểm tra Overall Band nhảy lên 7.0",
      async () => {
        const plusBtnLr = canvas.getByTestId("stepper-plus-lr");
        await userEvent.click(plusBtnLr);
        await userEvent.click(plusBtnLr);

        // Scores: TA: 6.5, CC: 6.5, LR: 8.0, GRA: 6.5 => Mean: 6.875 => Overall Band: 7.0
        const overallBadge = canvas.getByTestId("overall-band-badge");
        await expect(overallBadge).toHaveTextContent("7.0");
      }
    );
  },
};

/**
 * 2. IELTS Overall Band Rounding Edge Cases Test
 */
export const IeltsRoundingEdgeCasesTest: Story = {
  render: function RoundingTestDemo() {
    const [scores, setScores] = useState<AssessmentScores>({
      TASK_ACHIEVEMENT: 6.0,
      COHERENCE_COHESION: 6.5,
      LEXICAL_RESOURCE: 6.5,
      GRAMMATICAL_RANGE_ACCURACY: 6.5,
    });

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Quick Test Presets */}
        <div className="flex flex-wrap gap-2 p-3 bg-muted/40 rounded-xl border text-xs">
          <span className="font-semibold text-muted-foreground mr-1 self-center">
            Test Case Presets:
          </span>
          <button
            type="button"
            className="px-2.5 py-1 bg-background border rounded font-mono hover:bg-muted"
            data-testid="preset-6375-btn"
            onClick={() =>
              setScores({
                TASK_ACHIEVEMENT: 6.0,
                COHERENCE_COHESION: 6.5,
                LEXICAL_RESOURCE: 6.5,
                GRAMMATICAL_RANGE_ACCURACY: 6.5,
              })
            }
          >
            6.0, 6.5, 6.5, 6.5 (tb 6.375 → 6.5)
          </button>
          <button
            type="button"
            className="px-2.5 py-1 bg-background border rounded font-mono hover:bg-muted"
            data-testid="preset-6125-btn"
            onClick={() =>
              setScores({
                TASK_ACHIEVEMENT: 6.0,
                COHERENCE_COHESION: 6.0,
                LEXICAL_RESOURCE: 6.0,
                GRAMMATICAL_RANGE_ACCURACY: 6.5,
              })
            }
          >
            6.0, 6.0, 6.0, 6.5 (tb 6.125 → 6.0)
          </button>
          <button
            type="button"
            className="px-2.5 py-1 bg-background border rounded font-mono hover:bg-muted"
            data-testid="preset-6250-btn"
            onClick={() =>
              setScores({
                TASK_ACHIEVEMENT: 6.0,
                COHERENCE_COHESION: 6.0,
                LEXICAL_RESOURCE: 6.5,
                GRAMMATICAL_RANGE_ACCURACY: 6.5,
              })
            }
          >
            6.0, 6.0, 6.5, 6.5 (tb 6.250 → 6.5)
          </button>
          <button
            type="button"
            className="px-2.5 py-1 bg-background border rounded font-mono hover:bg-muted"
            data-testid="preset-6750-btn"
            onClick={() =>
              setScores({
                TASK_ACHIEVEMENT: 6.5,
                COHERENCE_COHESION: 6.5,
                LEXICAL_RESOURCE: 7.0,
                GRAMMATICAL_RANGE_ACCURACY: 7.0,
              })
            }
          >
            6.5, 6.5, 7.0, 7.0 (tb 6.750 → 7.0)
          </button>
          <button
            type="button"
            className="px-2.5 py-1 bg-background border rounded font-mono hover:bg-muted"
            data-testid="preset-6875-btn"
            onClick={() =>
              setScores({
                TASK_ACHIEVEMENT: 6.5,
                COHERENCE_COHESION: 7.0,
                LEXICAL_RESOURCE: 7.0,
                GRAMMATICAL_RANGE_ACCURACY: 7.0,
              })
            }
          >
            6.5, 7.0, 7.0, 7.0 (tb 6.875 → 7.0)
          </button>
        </div>

        <AssessmentScorecard
          scores={scores}
          mode="interactive"
          onScoresChange={(newScores) => setScores(newScores)}
        />
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step(
      "1. Case tb 6.375 (6.0, 6.5, 6.5, 6.5) làm tròn thành 6.5",
      async () => {
        const presetBtn = canvas.getByTestId("preset-6375-btn");
        await userEvent.click(presetBtn);

        const overallBadge = canvas.getByTestId("overall-band-badge");
        await expect(overallBadge).toHaveTextContent("6.5");
      }
    );

    await step(
      "2. Case tb 6.125 (6.0, 6.0, 6.0, 6.5) phần dư < 0.25 làm tròn xuống 6.0",
      async () => {
        const presetBtn = canvas.getByTestId("preset-6125-btn");
        await userEvent.click(presetBtn);

        const overallBadge = canvas.getByTestId("overall-band-badge");
        await expect(overallBadge).toHaveTextContent("6.0");
      }
    );

    await step(
      "3. Case tb 6.250 (6.0, 6.0, 6.5, 6.5) phần dư = 0.25 làm tròn lên 6.5",
      async () => {
        const presetBtn = canvas.getByTestId("preset-6250-btn");
        await userEvent.click(presetBtn);

        const overallBadge = canvas.getByTestId("overall-band-badge");
        await expect(overallBadge).toHaveTextContent("6.5");
      }
    );

    await step(
      "4. Case tb 6.750 (6.5, 6.5, 7.0, 7.0) phần dư = 0.75 làm tròn lên 7.0",
      async () => {
        const presetBtn = canvas.getByTestId("preset-6750-btn");
        await userEvent.click(presetBtn);

        const overallBadge = canvas.getByTestId("overall-band-badge");
        await expect(overallBadge).toHaveTextContent("7.0");
      }
    );

    await step(
      "5. Case tb 6.875 (6.5, 7.0, 7.0, 7.0) phần dư >= 0.75 làm tròn lên 7.0",
      async () => {
        const presetBtn = canvas.getByTestId("preset-6875-btn");
        await userEvent.click(presetBtn);

        const overallBadge = canvas.getByTestId("overall-band-badge");
        await expect(overallBadge).toHaveTextContent("7.0");
      }
    );
  },
};

/**
 * 3. Accept All AI Proposals Interaction Test
 */
export const AcceptAllAiProposalsTest: Story = {
  render: function AcceptAllAiDemo() {
    const [scores, setScores] = useState<AssessmentScores>({
      TASK_ACHIEVEMENT: 8.0,
      COHERENCE_COHESION: 8.0,
      LEXICAL_RESOURCE: 8.0,
      GRAMMATICAL_RANGE_ACCURACY: 8.0,
    });

    const aiProposalScores: AssessmentScores = {
      TASK_ACHIEVEMENT: 6.0,
      COHERENCE_COHESION: 6.5,
      LEXICAL_RESOURCE: 6.0,
      GRAMMATICAL_RANGE_ACCURACY: 6.5,
    };

    return (
      <div className="max-w-2xl mx-auto">
        <AssessmentScorecard
          scores={scores}
          aiProposalScores={aiProposalScores}
          mode="interactive"
          onScoresChange={(newScores) => setScores(newScores)}
        />
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step(
      "1. Ban đầu điểm giáo viên 8.0, AI đề xuất 6.5, nút Chấp nhận toàn bộ AI hiển thị",
      async () => {
        const overallBadge = canvas.getByTestId("overall-band-badge");
        await expect(overallBadge).toHaveTextContent("8.0");

        const acceptAllBtn = canvas.getByTestId("accept-all-ai-btn");
        await expect(acceptAllBtn).toBeInTheDocument();
        await expect(acceptAllBtn).toHaveTextContent(
          "Chấp nhận toàn bộ AI (4)"
        );
      }
    );

    await step(
      "2. Click 'Chấp nhận toàn bộ AI' và kiểm tra toàn bộ điểm đồng bộ về AI (Overall 6.5)",
      async () => {
        const acceptAllBtn = canvas.getByTestId("accept-all-ai-btn");
        await userEvent.click(acceptAllBtn);

        const overallBadge = canvas.getByTestId("overall-band-badge");
        await expect(overallBadge).toHaveTextContent("6.5");

        const taBadge = canvas.getByTestId("current-score-badge-ta");
        await expect(taBadge).toHaveTextContent("6.0");

        const ccBadge = canvas.getByTestId("current-score-badge-cc");
        await expect(ccBadge).toHaveTextContent("6.5");
      }
    );
  },
};

/**
 * 4. Read-Only Mode (Student Result Report)
 */
export const ReadOnlyStudentReport: Story = {
  args: {
    scores: {
      TASK_ACHIEVEMENT: 7.5,
      COHERENCE_COHESION: 7.0,
      LEXICAL_RESOURCE: 7.5,
      GRAMMATICAL_RANGE_ACCURACY: 7.0,
    },
    aiProposalScores: {
      TASK_ACHIEVEMENT: 7.0,
      COHERENCE_COHESION: 7.0,
      LEXICAL_RESOURCE: 7.0,
      GRAMMATICAL_RANGE_ACCURACY: 7.0,
    },
    mode: "readonly",
    taskType: "TASK_2",
    title: "Kết Quả Đánh Giá IELTS Writing Task 2",
    examinerFeedback:
      "Bài viết phát triển ý mạch lạc, sử dụng từ vựng học thuật phong phú và chính xác. Cấu trúc câu đa dạng, đạt chuẩn Band 7.5 Task 2.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const overallBadge = canvas.getByTestId("overall-band-badge");
    await expect(overallBadge).toHaveTextContent("7.5");

    // Steppers should NOT exist in read-only mode
    const plusBtn = canvas.queryByTestId("stepper-plus-ta");
    await expect(plusBtn).toBeNull();
  },
};
