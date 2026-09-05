import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import { CriteriaScoreSlider } from "./criteria-score-slider";
import { WRITING_CRITERIA_ORDER, WritingCriterion } from "./types";

const meta: Meta<typeof CriteriaScoreSlider> = {
  title: "Patterns/Assessment/CriteriaScoreSlider",
  component: CriteriaScoreSlider,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Thành phần Slider chấm điểm từng tiêu chí IELTS (0.0 - 9.0, bước 0.5) với màu sắc 4 tiêu chí chuẩn, nút Stepper +/- 0.5, popover tra cứu Band Descriptors và ma trận Rubric đầy đủ.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CriteriaScoreSlider>;

/**
 * 1. Default Interactive Slider (Task Achievement)
 */
export const Default: Story = {
  render: function DefaultDemo() {
    const [score, setScore] = useState<number>(6.5);
    return (
      <div className="max-w-md">
        <CriteriaScoreSlider
          criterion="TASK_ACHIEVEMENT"
          score={score}
          onChange={setScore}
        />
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("1. Kiểm tra render ban đầu điểm 6.5", async () => {
      const badge = canvas.getByTestId("current-score-badge-ta");
      await expect(badge).toHaveTextContent("6.5");
    });

    await step("2. Bấm nút Stepper (+) để tăng lên 7.0", async () => {
      const plusBtn = canvas.getByTestId("stepper-plus-ta");
      await userEvent.click(plusBtn);

      const badge = canvas.getByTestId("current-score-badge-ta");
      await expect(badge).toHaveTextContent("7.0");
    });

    await step("3. Bấm nút Stepper (-) hai lần để giảm xuống 6.0", async () => {
      const minusBtn = canvas.getByTestId("stepper-minus-ta");
      await userEvent.click(minusBtn);
      await userEvent.click(minusBtn);

      const badge = canvas.getByTestId("current-score-badge-ta");
      await expect(badge).toHaveTextContent("6.0");
    });
  },
};

/**
 * 2. Slider with AI Proposal Comparison & Reset Interaction Test
 */
export const WithAiComparisonAndDelta: Story = {
  render: function AiComparisonDemo() {
    const [score, setScore] = useState<number>(7.0);
    const aiProposalScore = 6.0;

    return (
      <div className="max-w-md">
        <CriteriaScoreSlider
          criterion="LEXICAL_RESOURCE"
          score={score}
          aiProposalScore={aiProposalScore}
          onChange={setScore}
          onResetToAI={() => setScore(aiProposalScore)}
        />
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step(
      "1. Kiểm tra hiển thị AI Proposal và Delta badge (+1)",
      async () => {
        const aiBadge = canvas.getByTestId("ai-proposal-score-lr");
        await expect(aiBadge).toHaveTextContent("AI: 6.0");

        const deltaBadge = canvas.getByTestId("delta-badge-lr");
        await expect(deltaBadge).toHaveTextContent("+1");
      }
    );

    await step("2. Bấm nút Reset to AI để khôi phục về điểm 6.0", async () => {
      const resetBtn = canvas.getByTestId("reset-to-ai-btn-lr");
      await userEvent.click(resetBtn);

      const currentBadge = canvas.getByTestId("current-score-badge-lr");
      await expect(currentBadge).toHaveTextContent("6.0");
    });
  },
};

/**
 * 3. Band Descriptor Popover & Full Matrix Dialog Interaction Test
 */
export const BandDescriptorAndRubricDialogTest: Story = {
  render: function RubricDemo() {
    const [score, setScore] = useState<number>(7.0);
    return (
      <div className="max-w-md">
        <CriteriaScoreSlider
          criterion="GRAMMATICAL_RANGE_ACCURACY"
          score={score}
          onChange={setScore}
          showRubricTrigger={true}
        />
      </div>
    );
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await step("1. Click icon info để mở Popover mô tả Band 7.0", async () => {
      const infoBtn = canvas.getByTestId("rubric-popover-trigger-gra");
      await userEvent.click(infoBtn);

      const popoverContent = await body.findByTestId(
        "rubric-popover-content-gra"
      );
      await expect(popoverContent).toBeInTheDocument();
      await expect(popoverContent).toHaveTextContent("Band Descriptors");
      await expect(popoverContent).toHaveTextContent(
        "Sử dụng nhiều cấu trúc phức"
      );
    });

    await step("2. Click link Ma trận full để mở Dialog chi tiết", async () => {
      const fullMatrixLink = await body.findByTestId(
        "open-full-rubric-from-popover-gra"
      );
      await userEvent.click(fullMatrixLink);

      const dialog = await body.findByTestId("full-rubric-dialog-gra");
      await expect(dialog).toBeInTheDocument();
      await expect(dialog).toHaveTextContent(
        "Bảng Ma Trận IELTS Band Descriptors"
      );
    });
  },
};

/**
 * 4. All 4 IELTS Criteria Grid
 */
export const AllFourCriteria: Story = {
  render: function AllCriteriaDemo() {
    const [scores, setScores] = useState<Record<WritingCriterion, number>>({
      TASK_ACHIEVEMENT: 6.5,
      COHERENCE_COHESION: 7.0,
      LEXICAL_RESOURCE: 6.0,
      GRAMMATICAL_RANGE_ACCURACY: 7.5,
    });

    return (
      <div className="max-w-xl space-y-3">
        {WRITING_CRITERIA_ORDER.map((crit) => (
          <CriteriaScoreSlider
            key={crit}
            criterion={crit}
            score={scores[crit]}
            onChange={(val) => setScores((prev) => ({ ...prev, [crit]: val }))}
          />
        ))}
      </div>
    );
  },
};

/**
 * 5. Read-Only Mode (Student View)
 */
export const ReadOnlyMode: Story = {
  args: {
    criterion: "COHERENCE_COHESION",
    score: 8.0,
    editable: false,
    aiProposalScore: 7.5,
    showAiComparison: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const badge = canvas.getByTestId("current-score-badge-cc");
    await expect(badge).toHaveTextContent("8.0");

    // Steppers should not be present in read-only mode
    const minusBtn = canvas.queryByTestId("stepper-minus-cc");
    await expect(minusBtn).toBeNull();
  },
};
