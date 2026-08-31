import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { UnifiedCriteriaScorecard } from "./unified-criteria-scorecard";

const meta: Meta<typeof UnifiedCriteriaScorecard> = {
  title: "Shared/Assessment/UnifiedCriteriaScorecard",
  component: UnifiedCriteriaScorecard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Thẻ điểm IELTS thống nhất (UnifiedCriteriaScorecard) hỗ trợ preset Speaking và Writing, làm tròn Overall Band quốc tế, huy hiệu CEFR, so sánh AI proposal và điều chỉnh điểm.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof UnifiedCriteriaScorecard>;

export const SpeakingInteractive: Story = {
  args: {
    preset: "speaking",
    editable: true,
    scores: {
      fluencyAndCoherence: 7.0,
      lexicalResource: 6.5,
      grammaticalRangeAndAccuracy: 7.0,
      pronunciation: 6.5,
    },
    aiProposalScores: {
      fluencyAndCoherence: 6.5,
      lexicalResource: 6.5,
      grammaticalRangeAndAccuracy: 6.5,
      pronunciation: 6.5,
    },
    traceMetadata: {
      modelUsed: "gemini-3.7-flash",
      isFallback: false,
      durationMs: 1850,
      tokensUsed: {
        promptTokens: 1200,
        candidatesTokens: 640,
        totalTokens: 1840,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByText(/Bảng Điểm 4 Tiêu Chí IELTS Speaking/i)
    ).toBeInTheDocument();
    expect(canvas.getByText("7.0")).toBeInTheDocument();
  },
};

export const WritingInteractive: Story = {
  args: {
    preset: "writing",
    editable: true,
    scores: {
      taskAchievement: 7.5,
      coherenceAndCohesion: 7.0,
      lexicalResource: 7.5,
      grammaticalRangeAndAccuracy: 7.0,
    },
    aiProposalScores: {
      taskAchievement: 7.0,
      coherenceAndCohesion: 7.0,
      lexicalResource: 7.0,
      grammaticalRangeAndAccuracy: 7.0,
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByText(/Bảng Điểm 4 Tiêu Chí IELTS Writing/i)
    ).toBeInTheDocument();
    expect(canvas.getByText("7.5")).toBeInTheDocument();
  },
};

export const LearnerReadonly: Story = {
  args: {
    preset: "speaking",
    editable: false,
    scores: {
      fluencyAndCoherence: 8.0,
      lexicalResource: 8.0,
      grammaticalRangeAndAccuracy: 8.5,
      pronunciation: 8.0,
    },
  },
};
