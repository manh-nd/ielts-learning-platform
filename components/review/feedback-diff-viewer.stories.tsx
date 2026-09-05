import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { FeedbackDiffViewer } from "./feedback-diff-viewer";
import type { AssessmentScores, FeedbackDiffItem } from "./types";

const mockAIScores: AssessmentScores = {
  TASK_ACHIEVEMENT: 7.0,
  COHERENCE_COHESION: 7.5,
  LEXICAL_RESOURCE: 6.5,
  GRAMMATICAL_RANGE_ACCURACY: 6.5,
};

const mockTeacherScores: AssessmentScores = {
  TASK_ACHIEVEMENT: 7.5,
  COHERENCE_COHESION: 7.5,
  LEXICAL_RESOURCE: 7.0,
  GRAMMATICAL_RANGE_ACCURACY: 6.5,
};

const mockDiffItems: FeedbackDiffItem[] = [
  {
    errorId: "diff-1",
    criterion: "LEXICAL_RESOURCE",
    originalQuote: "more effective in reducing",
    aiSuggestedCorrection: "more impactful in reducing",
    teacherFinalText: "more impactful in reducing",
    explanation:
      "Repetitive word choice for 'effective'. Suggested high-level collocation accepted.",
    resolution: "accepted",
    teacherNote: "Đồng ý với AI, từ thay thế phù hợp ngữ cảnh học thuật.",
  },
  {
    errorId: "diff-2",
    criterion: "GRAMMATICAL_RANGE_ACCURACY",
    originalQuote: "reduce crime",
    aiSuggestedCorrection: "reduce crime rates",
    teacherFinalText: "reduce crime rates",
    explanation: "Missing context noun in formal essay structure.",
    resolution: "accepted",
  },
  {
    errorId: "diff-3",
    criterion: "TASK_ACHIEVEMENT",
    originalQuote: "seen some reduction in repeat offenses",
    aiSuggestedCorrection: "seen a 25% decrease according to DOJ statistics",
    explanation:
      "AI suggested adding speculative percentage statistics not present in candidate prompt.",
    resolution: "rejected",
    teacherNote:
      "Bác bỏ vì thí sinh không được tự bịa số liệu chi tiết quá mức cần thiết ở Task 2.",
  },
  {
    errorId: "diff-4",
    criterion: "COHERENCE_COHESION",
    originalQuote: "In modern society",
    teacherFinalText: "In contemporary academic discourse",
    explanation: "Teacher upgraded introduction paragraph opening hook.",
    resolution: "teacher_added",
    teacherNote:
      "Giáo viên bổ sung để giúp bài đạt tiêu chuẩn Lexical Resource & Cohesion 8.0.",
  },
];

const meta: Meta<typeof FeedbackDiffViewer> = {
  title: "Product/Writing/FeedbackDiffViewer",
  component: FeedbackDiffViewer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof FeedbackDiffViewer>;

/**
 * 1. Default Score & Error Resolution Diff
 */
export const DefaultComparison: Story = {
  args: {
    aiScores: mockAIScores,
    teacherScores: mockTeacherScores,
    diffItems: mockDiffItems,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify Agreement rate badge
    const agreementBadge = canvas.getByTestId("agreement-rate-badge");
    await expect(agreementBadge).toBeInTheDocument();

    // 2. Verify score cards rendered
    const taCard = canvas.getByTestId("score-card-ta");
    await expect(taCard).toHaveTextContent("AI:7.0");
    await expect(taCard).toHaveTextContent("GV:7.5");

    const lrCard = canvas.getByTestId("score-card-lr");
    await expect(lrCard).toHaveTextContent("AI:6.5");
    await expect(lrCard).toHaveTextContent("GV:7.0");

    // 3. Verify Diff items rendered
    const diffList = canvas.getByTestId("diff-items-list");
    await expect(diffList).toBeInTheDocument();
  },
};

/**
 * 2. Full Alignment Case (Teacher agrees 100% with AI Proposal)
 */
export const FullAlignment: Story = {
  args: {
    aiScores: {
      TASK_ACHIEVEMENT: 7.0,
      COHERENCE_COHESION: 7.0,
      LEXICAL_RESOURCE: 7.0,
      GRAMMATICAL_RANGE_ACCURACY: 7.0,
    },
    teacherScores: {
      TASK_ACHIEVEMENT: 7.0,
      COHERENCE_COHESION: 7.0,
      LEXICAL_RESOURCE: 7.0,
      GRAMMATICAL_RANGE_ACCURACY: 7.0,
    },
    diffItems: [
      {
        errorId: "diff-align-1",
        criterion: "LEXICAL_RESOURCE",
        originalQuote: "good way",
        aiSuggestedCorrection: "viable approach",
        teacherFinalText: "viable approach",
        explanation: "Collocation upgrade",
        resolution: "accepted",
      },
    ],
  },
};

/**
 * 3. Significant Divergence (Teacher adjusted multiple scores & rejected suggestions)
 */
export const SignificantDivergence: Story = {
  args: {
    aiScores: {
      TASK_ACHIEVEMENT: 6.0,
      COHERENCE_COHESION: 6.0,
      LEXICAL_RESOURCE: 5.5,
      GRAMMATICAL_RANGE_ACCURACY: 5.5,
    },
    teacherScores: {
      TASK_ACHIEVEMENT: 7.0,
      COHERENCE_COHESION: 7.0,
      LEXICAL_RESOURCE: 6.5,
      GRAMMATICAL_RANGE_ACCURACY: 6.5,
    },
    diffItems: [
      {
        errorId: "diff-div-1",
        criterion: "TASK_ACHIEVEMENT",
        originalQuote: "both sides discussed",
        explanation: "AI claimed candidate missed second perspective.",
        resolution: "rejected",
        teacherNote:
          "AI hiểu sai luận điểm đoạn 2, thí sinh đã phân tích đầy đủ.",
      },
      {
        errorId: "diff-div-2",
        criterion: "LEXICAL_RESOURCE",
        originalQuote: "broad terminology",
        explanation: "AI hallucinated inaccurate synonym.",
        resolution: "rejected",
        teacherNote: "Gợi ý của AI sai ngữ cảnh.",
      },
    ],
  },
};
