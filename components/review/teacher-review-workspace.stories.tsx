import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { TeacherReviewWorkspace } from "./teacher-review-workspace";
import type { ReviewAnnotation } from "./types";

const mockStudent = {
  name: "Nguyễn Minh Anh",
  avatar: "NMA",
  class: "IELTS Master 7.5+ (K24)",
  submissionAttempt: 1,
  submittedAt: "22/08/2026 14:30",
};

const mockPrompt = {
  id: "prompt-w-t2-042",
  title: "Writing Task 2 — Tuần 5: Crime & Punishment",
  taskType: "TASK_2" as const,
  targetBand: 7.5,
  wordCountMin: 250,
  wordCountMax: 320,
  promptText:
    "Some people think that the best way to reduce crime is to give longer prison sentences. Others, however, believe there are better alternative ways of reducing crime. Discuss both views and give your opinion.",
  keyInstructions: [
    "Thảo luận đầy đủ cả 2 quan điểm (Both Views) một cách cân bằng.",
    "Đưa ra quan điểm cá nhân rõ ràng (Clear Position).",
    "Sử dụng ví dụ và dẫn chứng thực tế.",
  ],
};

const mockAiScores = {
  TASK_ACHIEVEMENT: 7.0,
  COHERENCE_COHESION: 7.5,
  LEXICAL_RESOURCE: 6.5,
  GRAMMATICAL_RANGE_ACCURACY: 6.5,
};

const mockAnnotations: ReviewAnnotation[] = [
  {
    errorId: "err-1",
    criterion: "LEXICAL_RESOURCE",
    category: "Lặp từ vựng (Word Repetition)",
    severity: "systematic_error",
    explanation:
      "Từ 'effective' bị lặp lại 3 lần. Nên đổi sang 'impactful' hoặc 'beneficial'.",
    suggestedCorrection: "impactful",
    originalQuote: "more effective in reducing",
    source: "ai",
  },
  {
    errorId: "err-2",
    criterion: "GRAMMATICAL_RANGE_ACCURACY",
    category: "Mệnh đề phức & Quan hệ (Complex Structures)",
    severity: "minor_slip",
    explanation:
      "Cấu trúc 'there is compelling evidence that' có thể viết gọn thành 'compelling evidence suggests that'.",
    suggestedCorrection: "compelling evidence suggests that",
    originalQuote: "there is compelling evidence that",
    source: "ai",
  },
  {
    errorId: "err-3",
    criterion: "COHERENCE_COHESION",
    category: "Từ nối & Chuyển tiếp (Discourse Markers)",
    severity: "minor_slip",
    explanation: "Dùng 'Conversely' giúp câu liên kết mượt mà hơn.",
    suggestedCorrection: "Conversely",
    originalQuote: "On the other hand",
    source: "ai",
  },
];

const mockEssayHtml = `<p>In today's society, crime remains one of the most pressing issues that governments worldwide must address. While some people advocate for longer prison sentences as the most effective deterrent, others argue that alternative approaches, such as education and rehabilitation programmes, can be <span data-criterion="LEXICAL_RESOURCE" data-error-id="err-1" data-severity="systematic_error" data-explanation="Từ effective lặp lại" data-suggested-correction="impactful" data-category="Lặp từ vựng" data-source="ai">more effective in reducing</span> crime rates.</p><p><span data-criterion="COHERENCE_COHESION" data-error-id="err-3" data-severity="minor_slip" data-explanation="Dùng Conversely" data-suggested-correction="Conversely" data-category="Từ nối" data-source="ai">On the other hand</span>, <span data-criterion="GRAMMATICAL_RANGE_ACCURACY" data-error-id="err-2" data-severity="minor_slip" data-explanation="Rút gọn mệnh đề" data-suggested-correction="compelling evidence suggests that" data-category="Mệnh đề phức" data-source="ai">there is compelling evidence that</span> rehabilitation is successful.</p>`;

const mockEssayPlainText =
  "In today's society, crime remains one of the most pressing issues that governments worldwide must address. While some people advocate for longer prison sentences as the most effective deterrent, others argue that alternative approaches, such as education and rehabilitation programmes, can be more effective in reducing crime rates.\n\nOn the other hand, there is compelling evidence that rehabilitation is successful.";

const meta: Meta<typeof TeacherReviewWorkspace> = {
  title: "Product/Writing/TeacherReviewWorkspace",
  component: TeacherReviewWorkspace,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    student: mockStudent,
    prompt: mockPrompt,
    initialEssayHtml: mockEssayHtml,
    initialEssayPlainText: mockEssayPlainText,
    aiScores: mockAiScores,
    initialAnnotations: mockAnnotations,
    initialExaminerSummary:
      "Bài luận lập luận tốt, cấu trúc rõ ràng. Cần nâng cao vốn từ vựng C1/C2.",
    initialStrengths: ["Cấu trúc 4 đoạn chặt chẽ", "Luận điểm rõ ràng"],
    initialImprovements: ["Mở rộng vốn từ học thuật", "Đa dạng hóa câu phức"],
    initialStatus: "ai_proposal_available",
    onOpenPromptDetails: fn(),
    onPublishClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof TeacherReviewWorkspace>;

export const DefaultDesktop: Story = {};

export const TabletViewport: Story = {
  parameters: {
    viewport: {
      defaultViewport: "ipad",
    },
  },
};

export const MobileViewport: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const PublishedReadonly: Story = {
  args: {
    initialStatus: "published",
  },
};

export const InteractiveResponsiveTabsTest: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify initial mobile tab is "Bài làm"
    expect(canvas.getByText(/Bài làm \(3\)/i)).toBeInTheDocument();

    // Click "Bảng điểm" tab in mobile mode
    const scorecardTab = canvas.getByRole("button", { name: /Bảng điểm/i });
    await userEvent.click(scorecardTab);

    // Verify Overall Band score card appears
    expect(canvas.getAllByText("7.0")[0]).toBeInTheDocument();

    // Click "Diff" tab in mobile mode
    const diffTab = canvas.getByRole("button", { name: /Diff/i });
    await userEvent.click(diffTab);

    // Verify Diff Viewer is visible
    expect(
      canvas.getByText(/So sánh Đánh giá AI vs Quyết định của Giáo viên/i)
    ).toBeInTheDocument();
  },
};
