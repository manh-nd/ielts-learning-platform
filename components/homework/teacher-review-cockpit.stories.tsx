import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";
import { TeacherReviewCockpit } from "./teacher-review-cockpit";
import type { TeacherReviewCockpitData } from "@/modules/homework/domain/homework-types";

const mockCockpitDataProposalReady: TeacherReviewCockpitData = {
  assignment: {
    id: "asg_cockpit_01",
    classroomId: "cls_cockpit_01",
    teacherId: "tch_cockpit_01",
    title: "IELTS Speaking Part 2 & Part 3: Environment & Climate Change",
    instructions:
      "Vui lòng trả lời bằng tiếng Anh lưu loát, chú ý cách sử dụng từ vựng nâng cao cho chủ đề Môi trường và biến đổi khí hậu.",
    prompts: [
      {
        promptId: "p_env_1",
        partNumber: 2,
        text: "Describe an environmental problem in your city.",
        subPrompts: [
          "What the problem is",
          "How it affects people",
          "What causes it",
          "And explain what can be done to solve it",
        ],
      },
      {
        promptId: "p_env_2",
        partNumber: 3,
        text: "How can individuals contribute to environmental protection in daily life?",
      },
    ],
    submissionDeadline: new Date(Date.now() + 86400000),
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  submission: {
    id: "sub_cockpit_01",
    assignmentId: "asg_cockpit_01",
    learnerId: "lrn_cockpit_01",
    status: "in_review",
    currentAttemptNumber: 1,
    reviewedAttemptNumber: 1,
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(),
  },
  attempt: {
    id: "att_cockpit_01",
    submissionId: "sub_cockpit_01",
    attemptNumber: 1,
    audioResponses: [
      {
        promptId: "p_env_1",
        storageKey: "homework/lrn_cockpit_01/asg_cockpit_01/p_env_1.webm",
        durationMs: 115000,
        audioBytes: 154000,
      },
      {
        promptId: "p_env_2",
        storageKey: "homework/lrn_cockpit_01/asg_cockpit_01/p_env_2.webm",
        durationMs: 52000,
        audioBytes: 72000,
      },
    ],
    submittedAt: new Date(Date.now() - 3600000),
  },
  student: {
    id: "lrn_cockpit_01",
    name: "Nguyễn Minh Châu",
    email: "chau.nguyen@example.com",
    avatarUrl: null,
  },
  aiProposal: {
    id: "aip_cockpit_01",
    submissionId: "sub_cockpit_01",
    attemptId: "att_cockpit_01",
    attemptNumber: 1,
    status: "ready",
    scores: {
      fluencyAndCoherence: 7.0,
      lexicalResource: 6.5,
      grammaticalRangeAndAccuracy: 7.0,
      pronunciation: 7.5,
    },
    overallBand: 7.0,
    feedbackSummary:
      "Bài nói tự tin, phát âm chuẩn và diễn đạt mạch lạc. Điểm mạnh là khả năng triển khai ý có cấu trúc tốt theo Part 2.",
    strengths: [
      "Tốc độ nói đều, tự nhiên, chuyển ý mạch lạc giữa các ý chính.",
      "Sử dụng đúng ngữ cảnh các thuật ngữ: pressing issue, vehicular traffic.",
    ],
    improvements: [
      "Đôi chỗ ngập ngừng tìm từ nối phức tạp.",
      "Có thể bổ sung thêm collocations C1 về phát triển bền vững.",
    ],
    actionPlan: [
      "Luyện tập thêm collocations chủ đề môi trường.",
      "Tập trung kiểm soát âm đuôi -s/-es.",
    ],
    pronunciationNotes: [],
    rawProposalJson: null,
    modelVersion: "gemini-2.5-flash",
    createdAt: new Date(Date.now() - 1800000),
    updatedAt: new Date(Date.now() - 1800000),
  },
  teacherDraft: null,
  publishedAssessment: null,
};

const mockCockpitDataAiFailed: TeacherReviewCockpitData = {
  ...mockCockpitDataProposalReady,
  aiProposal: {
    id: "aip_failed_01",
    submissionId: "sub_cockpit_01",
    attemptId: "att_cockpit_01",
    attemptNumber: 1,
    status: "failed",
    scores: {
      fluencyAndCoherence: 0,
      lexicalResource: 0,
      grammaticalRangeAndAccuracy: 0,
      pronunciation: 0,
    },
    overallBand: 0,
    feedbackSummary: null,
    strengths: [],
    improvements: [],
    actionPlan: [],
    pronunciationNotes: [],
    rawProposalJson: null,
    modelVersion: "gemini-2.5-flash",
    createdAt: new Date(Date.now() - 1800000),
    updatedAt: new Date(Date.now() - 1800000),
  },
};

const mockCockpitDataSubmittedFresh: TeacherReviewCockpitData = {
  ...mockCockpitDataProposalReady,
  submission: {
    ...mockCockpitDataProposalReady.submission,
    status: "submitted",
    reviewedAttemptNumber: null,
  },
};

const mockCockpitDataPublished: TeacherReviewCockpitData = {
  ...mockCockpitDataProposalReady,
  submission: {
    ...mockCockpitDataProposalReady.submission,
    status: "published",
  },
  publishedAssessment: {
    id: "pub_01",
    submissionId: "sub_cockpit_01",
    assignmentId: "asg_cockpit_01",
    teacherAssessmentId: "ta_cockpit_01",
    learnerId: "lrn_cockpit_01",
    teacherId: "tch_cockpit_01",
    attemptNumber: 1,
    fluencyCoherence: 7.5,
    lexicalResource: 7.0,
    grammaticalRangeAccuracy: 7.0,
    pronunciation: 7.5,
    overallBand: 7.5,
    criteriaFeedback: {
      fluencyAndCoherence: "Lưu loát vượt mong đợi, chuyển ý rất mượt mà.",
      lexicalResource: "Từ vựng tốt, dùng linh hoạt.",
      grammaticalRangeAndAccuracy: "Ngữ pháp vững, chỉ 1-2 lỗi chia thì nhỏ.",
      pronunciation: "Phát âm tự nhiên và chuẩn.",
    },
    overallFeedback:
      "Bài nói hoàn thành xuất sắc! Thầy đánh giá cao sự tiến bộ trong cách diễn đạt của em.",
    publishedAt: new Date(Date.now() - 600000),
  },
};

const meta = {
  title: "Homework/TeacherReviewCockpit",
  component: TeacherReviewCockpit,
  parameters: {
    layout: "padded",
    a11y: { test: "error" },
  },
  tags: ["autodocs"],
  args: {
    initialData: mockCockpitDataProposalReady,
    mockMode: true,
  },
} satisfies Meta<typeof TeacherReviewCockpit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProposalReady: Story = {
  args: {
    initialData: mockCockpitDataProposalReady,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify student and assignment info
    await expect(canvas.getByText(/Nguyễn Minh Châu/i)).toBeInTheDocument();
    await expect(
      canvas.getByText(/chau\.nguyen@example\.com/i)
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        /IELTS Speaking Part 2 & Part 3: Environment & Climate Change/i
      )
    ).toBeInTheDocument();

    // Verify AI proposal card exists with band 7.0
    await expect(
      canvas.getByText(/Đề Xuất Đánh Giá Tự Động Từ AI/i)
    ).toBeInTheDocument();
    await expect(canvas.getByTestId("ai-overall-band")).toHaveTextContent(
      "7.0"
    );

    // Check sliders are present
    const fcSlider = canvas.getByTestId("slider-fluencyAndCoherence");
    await expect(fcSlider).toBeInTheDocument();

    // Verify Apply AI button exists and can be clicked
    const applyAiBtn = canvas.getByTestId("apply-ai-scores-button");
    await expect(applyAiBtn).toBeInTheDocument();
    await userEvent.click(applyAiBtn);

    // Verify feedback textarea
    const feedbackInput = canvas.getByTestId("overall-feedback-textarea");
    await expect(feedbackInput).toBeInTheDocument();
  },
};

export const AiFailedFallback: Story = {
  args: {
    initialData: mockCockpitDataAiFailed,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify AI failure alert is displayed gracefully
    await expect(
      canvas.getByText(/Đề xuất tự động từ AI tạm thời không khả dụng/i)
    ).toBeInTheDocument();

    // Verify manual scoring sliders are still active and usable
    const fcSlider = canvas.getByTestId("slider-fluencyAndCoherence");
    await expect(fcSlider).toBeInTheDocument();

    const publishBtn = canvas.getByTestId("publish-assessment-button");
    await expect(publishBtn).toBeInTheDocument();
  },
};

export const InReviewSession: Story = {
  args: {
    initialData: mockCockpitDataProposalReady,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify In Review status badge
    const statusBadge = canvas.getByTestId("submission-status-badge");
    await expect(statusBadge).toHaveTextContent("Đang Chấm Bài");

    // Verify active review timer exists
    const timer = canvas.getByTestId("active-review-timer-badge");
    await expect(timer).toBeInTheDocument();

    // Test prompt tab switching
    const part3Tab = canvas.getByTestId("tab-prompt-2");
    await userEvent.click(part3Tab);
    await expect(
      canvas.getByText(
        /How can individuals contribute to environmental protection in daily life\?/i
      )
    ).toBeInTheDocument();
  },
};

export const FreshSubmittedPendingStart: Story = {
  args: {
    initialData: mockCockpitDataSubmittedFresh,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Check Start Review button is prominent
    const startReviewBtn = canvas.getByTestId("start-review-button");
    await expect(startReviewBtn).toBeInTheDocument();
    await expect(startReviewBtn).toHaveTextContent(/Bắt đầu chấm/i);
  },
};

export const PublishedReadOnly: Story = {
  args: {
    initialData: mockCockpitDataPublished,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify published status
    const statusBadge = canvas.getByTestId("submission-status-badge");
    await expect(statusBadge).toHaveTextContent("Đã Công Bố");
    await expect(canvas.getByText("Đã khóa chính thức")).toBeInTheDocument();

    // Verify teacher overall feedback is displayed in textarea
    const feedbackTextarea = canvas.getByTestId("overall-feedback-textarea");
    await expect(feedbackTextarea).toHaveValue(
      "Bài nói hoàn thành xuất sắc! Thầy đánh giá cao sự tiến bộ trong cách diễn đạt của em."
    );

    // Sliders should not be rendered in published read-only mode
    expect(
      canvas.queryByTestId("slider-fluencyAndCoherence")
    ).not.toBeInTheDocument();
  },
};
