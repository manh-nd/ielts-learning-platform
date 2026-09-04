import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";
import { LearnerPublishedAssessmentView } from "./learner-published-assessment-view";
import type { LearnerPublishedAssessmentData } from "@/modules/homework/domain/homework-types";

const mockPublishedDataHighBand: LearnerPublishedAssessmentData = {
  assignment: {
    id: "asg_pub_01",
    classroomId: "cls_pub_01",
    teacherId: "tch_pub_01",
    title: "IELTS Speaking Part 1 & Part 2: Travel & Memories",
    instructions:
      "Record your answers clearly. Pay attention to grammar accuracy in Part 2.",
    prompts: [
      {
        promptId: "p_trav_1",
        partNumber: 1,
        text: "Do you prefer traveling alone or with a group of friends? Why?",
      },
      {
        promptId: "p_trav_2",
        partNumber: 2,
        text: "Describe a memorable journey you have been on.",
        subPrompts: [
          "Where you went",
          "Who you went with",
          "What happened on the journey",
          "And explain why it was memorable to you",
        ],
      },
    ],
    submissionDeadline: new Date(Date.now() + 86400000),
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  classroom: {
    id: "cls_pub_01",
    name: "IELTS Masterclass K18",
  },
  submission: {
    id: "sub_pub_01",
    assignmentId: "asg_pub_01",
    learnerId: "lrn_pub_01",
    status: "published",
    currentAttemptNumber: 1,
    reviewedAttemptNumber: 1,
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(),
  },
  attempt: {
    id: "att_pub_01",
    submissionId: "sub_pub_01",
    attemptNumber: 1,
    audioResponses: [
      {
        promptId: "p_trav_1",
        storageKey: "homework/lrn_pub_01/asg_pub_01/p_trav_1.webm",
        durationMs: 45000,
        audioBytes: 60000,
      },
      {
        promptId: "p_trav_2",
        storageKey: "homework/lrn_pub_01/asg_pub_01/p_trav_2.webm",
        durationMs: 118000,
        audioBytes: 158000,
      },
    ],
    submittedAt: new Date(Date.now() - 3600000),
  },
  publishedAssessment: {
    id: "pub_ass_01",
    submissionId: "sub_pub_01",
    assignmentId: "asg_pub_01",
    teacherAssessmentId: "tch_ass_01",
    learnerId: "lrn_pub_01",
    teacherId: "tch_pub_01",
    attemptNumber: 1,
    fluencyCoherence: 7.5,
    lexicalResource: 7.5,
    grammaticalRangeAccuracy: 7.0,
    pronunciation: 7.5,
    overallBand: 7.5,
    overallFeedback:
      "Bài nói hoàn thành rất tốt! Em có độ lưu loát cao, phát âm rõ ràng và ngữ điệu tự nhiên. Trong Part 2 câu chuyện được kể mạch lạc, từ vựng phong phú. Thầy đặc biệt khen ngợi cách em kiểm soát thì quá khứ hoàn thành và quá khứ đơn.",
    criteriaFeedback: {
      fluencyAndCoherence:
        "Tốc độ nói rất đều, chuyển ý mượt mà bằng các discourse markers như 'As far as I remember', 'To be completely honest'.",
      lexicalResource:
        "Sử dụng tự nhiên nhiều collocations hay: 'off the beaten track', 'breathtaking landscape', 'hustle and bustle'.",
      grammaticalRangeAndAccuracy:
        "Kiểm soát ngữ pháp chắc chắn, có sử dụng mệnh đề quan hệ và câu điều kiện. Cần chú ý thêm sự hòa hợp thì trong câu phức.",
      pronunciation:
        "Ngữ điệu tự nhiên, nhấn đúng trọng âm câu và từ. Âm cuối được phát âm rõ ràng.",
    },
    publishedAt: new Date(Date.now() - 1800000),
  },
  teacher: {
    id: "tch_pub_01",
    name: "Thầy Đặng Hoàng Long (IELTS 8.5)",
  },
};

const mockPublishedDataMinimalFeedback: LearnerPublishedAssessmentData = {
  ...mockPublishedDataHighBand,
  publishedAssessment: {
    ...mockPublishedDataHighBand.publishedAssessment,
    id: "pub_ass_02",
    fluencyCoherence: 6.0,
    lexicalResource: 6.5,
    grammaticalRangeAccuracy: 6.0,
    pronunciation: 6.5,
    overallBand: 6.5,
    overallFeedback:
      "Bài nói đạt yêu cầu cơ bản, diễn đạt dễ hiểu. Cần luyện tập thêm phản xạ để giảm bớt khoảng ngừng ngập ngừng trong Part 2.",
    criteriaFeedback: null,
  },
};

const meta = {
  title: "Homework/LearnerPublishedAssessmentView",
  component: LearnerPublishedAssessmentView,
  parameters: {
    layout: "padded",
    a11y: { test: "error" },
  },
  tags: ["autodocs"],
  args: {
    data: mockPublishedDataHighBand,
    mockMode: true,
  },
} satisfies Meta<typeof LearnerPublishedAssessmentView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultPublished: Story = {
  args: {
    data: mockPublishedDataHighBand,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify title and classroom
    await expect(
      canvas.getByText(/IELTS Speaking Part 1 & Part 2: Travel & Memories/i)
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/IELTS Masterclass K18/i)
    ).toBeInTheDocument();

    // Verify Official Published Badge
    const pubBadge = canvas.getByTestId("published-badge");
    await expect(pubBadge).toBeInTheDocument();
    await expect(pubBadge).toHaveTextContent("Kết quả chính thức");

    // Verify Overall Band score
    const overallScore = canvas.getByTestId("overall-band-badge");
    await expect(overallScore).toBeInTheDocument();
    await expect(overallScore).toHaveTextContent("7.5");

    // Verify 4 criteria scores are rendered
    await expect(canvas.getByTestId("score-fc")).toHaveTextContent("7.5");
    await expect(canvas.getByTestId("score-lr")).toHaveTextContent("7.5");
    await expect(canvas.getByTestId("score-gra")).toHaveTextContent("7.0");
    await expect(canvas.getByTestId("score-pr")).toHaveTextContent("7.5");

    // Verify Teacher overall feedback
    const feedbackText = canvas.getByTestId("teacher-overall-feedback-text");
    await expect(feedbackText).toHaveTextContent("Bài nói hoàn thành rất tốt!");
    await expect(canvas.getByTestId("overall-band-card")).toHaveTextContent(
      "Thầy Đặng Hoàng Long"
    );
  },
};

export const PromptTabSwitchingAndAudioPlayer: Story = {
  args: {
    data: mockPublishedDataHighBand,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify Prompt 1 is active initially
    await expect(
      canvas.getByText(
        /Do you prefer traveling alone or with a group of friends\? Why\?/i
      )
    ).toBeInTheDocument();

    // Switch to Prompt 2 tab
    const prompt2Tab = canvas.getByTestId("prompt-tab-p_trav_2");
    await userEvent.click(prompt2Tab);

    // Verify Prompt 2 text and cue card sub-prompts appear
    await expect(
      canvas.getByText(/Describe a memorable journey you have been on\./i)
    ).toBeInTheDocument();
    await expect(canvas.getByText(/You should say:/i)).toBeInTheDocument();
    await expect(canvas.getByText(/Where you went/i)).toBeInTheDocument();

    // Verify audio player controls exist and can toggle play
    const playBtn = canvas.getByTestId("toggle-play-button");
    await expect(playBtn).toBeInTheDocument();
    await expect(playBtn).toHaveTextContent("Phát lại");

    await userEvent.click(playBtn);
    await expect(playBtn).toHaveTextContent("Tạm dừng");

    await userEvent.click(playBtn);
    await expect(playBtn).toHaveTextContent("Phát lại");
  },
};

export const MinimalFeedbackFallback: Story = {
  args: {
    data: mockPublishedDataMinimalFeedback,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify 6.5 band
    const overallScore = canvas.getByTestId("overall-band-badge");
    await expect(overallScore).toHaveTextContent("6.5");

    // Verify fallback comment message for criteria without individual feedback
    const fcComment = canvas.getByTestId("comment-fc");
    await expect(fcComment).toHaveTextContent(
      "Giáo viên không để lại nhận xét riêng cho tiêu chí này"
    );
  },
};
