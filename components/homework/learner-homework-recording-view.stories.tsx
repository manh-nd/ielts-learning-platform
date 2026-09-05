import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";
import { LearnerHomeworkRecordingView } from "./learner-homework-recording-view";
import type { LearnerHomeworkDetail } from "@/modules/homework/application/homework-read-models";

const mockAssignmentDetail: LearnerHomeworkDetail = {
  assignment: {
    id: "asg_sb_01",
    classroomId: "cls_sb_01",
    teacherId: "tch_sb_01",
    title: "IELTS Speaking Part 1 & Part 2: Travel & Tourism",
    instructions:
      "Vui lòng trả lời bằng tiếng Anh lưu loát, chú ý cách sử dụng từ vựng và thì quá khứ cho câu chuyện ở Part 2. Hạn chế dừng ngập ngừng quá lâu.",
    prompts: [
      {
        promptId: "p_sb_1",
        text: "Do you prefer traveling alone or with friends? Why?",
        partNumber: 1,
      },
      {
        promptId: "p_sb_2",
        text: "Describe a memorable journey you have been on.",
        partNumber: 2,
        subPrompts: [
          "Where you went",
          "Who you went with",
          "What happened on the journey",
          "Why it was memorable to you",
        ],
      },
    ],
    submissionDeadline: new Date(Date.now() + 86400000), // 24 hours future
    status: "published",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  classroom: {
    id: "cls_sb_01",
    name: "IELTS Intensive Speaking Class A1",
  },
  submission: null,
  currentAttempt: null,
  allAttempts: [],
};

const meta = {
  title: "Homework/LearnerHomeworkRecordingView",
  component: LearnerHomeworkRecordingView,
  parameters: {
    layout: "padded",
    a11y: { test: "error" },
  },
  tags: ["autodocs"],
  args: {
    detail: mockAssignmentDetail,
    mockMode: true,
    hasConsent: true,
  },
} satisfies Meta<typeof LearnerHomeworkRecordingView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreshAssignment: Story = {
  args: {
    detail: mockAssignmentDetail,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(/IELTS Speaking Part 1 & Part 2: Travel & Tourism/i)
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/Do you prefer traveling alone or with friends\? Why\?/i)
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/Describe a memorable journey you have been on\./i)
    ).toBeInTheDocument();

    const submitBtn = canvas.getByTestId("submit-homework-btn");
    await expect(submitBtn).toBeDisabled();
  },
};

export const RecordingInteraction: Story = {
  args: {
    detail: mockAssignmentDetail,
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const startRecordBtns = canvas.getAllByRole("button", {
      name: /Bắt đầu thu âm/i,
    });
    await expect(startRecordBtns.length).toBeGreaterThan(0);

    // Click start recording on first prompt
    await userEvent.click(startRecordBtns[0]);

    // Check recording UI appeared
    await expect(
      canvas.getByText(/Đang thu âm microphone\.\.\./i)
    ).toBeInTheDocument();
    const finishBtn = canvas.getByRole("button", {
      name: /Hoàn thành câu trả lời/i,
    });
    await expect(finishBtn).toBeInTheDocument();

    // Click finish recording
    await userEvent.click(finishBtn);

    // Verify clip now has playback button
    await expect(
      canvas.getByRole("button", { name: /Phát lại/i })
    ).toBeInTheDocument();
  },
};

export const AllPromptsRecordedReadyToSubmit: Story = {
  args: {
    detail: mockAssignmentDetail,
    mockMode: true,
    initialRecordedClips: {
      p_sb_1: {
        storageKey: "homework/mock/p1.webm",
        durationSeconds: 45,
        url: "https://example.com/audio1.webm",
      },
      p_sb_2: {
        storageKey: "homework/mock/p2.webm",
        durationSeconds: 120,
        url: "https://example.com/audio2.webm",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/2 \/ 2 câu hỏi/i)).toBeInTheDocument();

    const submitBtn = canvas.getByTestId("submit-homework-btn");
    await expect(submitBtn).toBeEnabled();
  },
};

export const SubmittedAttempt1: Story = {
  args: {
    detail: {
      ...mockAssignmentDetail,
      submission: {
        id: "sub_sb_01",
        assignmentId: "asg_sb_01",
        learnerId: "lrn_sb_01",
        status: "submitted",
        currentAttemptNumber: 1,
        reviewedAttemptNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      currentAttempt: {
        id: "att_sb_01",
        submissionId: "sub_sb_01",
        attemptNumber: 1,
        audioResponses: [
          {
            promptId: "p_sb_1",
            storageKey: "homework/mock/p1.webm",
            durationMs: 45000,
            audioBytes: 90000,
          },
          {
            promptId: "p_sb_2",
            storageKey: "homework/mock/p2.webm",
            durationMs: 120000,
            audioBytes: 240000,
          },
        ],
        submittedAt: new Date(),
      },
      allAttempts: [],
    },
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByTestId("submission-success-banner")
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/Bạn đã nộp bài thành công \(Lượt nộp #1\)/i)
    ).toBeInTheDocument();
  },
};

export const UnderReviewConflictLocked: Story = {
  args: {
    detail: {
      ...mockAssignmentDetail,
      submission: {
        id: "sub_sb_locked",
        assignmentId: "asg_sb_01",
        learnerId: "lrn_sb_01",
        status: "in_review",
        currentAttemptNumber: 1,
        reviewedAttemptNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      currentAttempt: {
        id: "att_sb_01",
        submissionId: "sub_sb_locked",
        attemptNumber: 1,
        audioResponses: [
          {
            promptId: "p_sb_1",
            storageKey: "homework/mock/p1.webm",
            durationMs: 45000,
            audioBytes: 90000,
          },
          {
            promptId: "p_sb_2",
            storageKey: "homework/mock/p2.webm",
            durationMs: 120000,
            audioBytes: 240000,
          },
        ],
        submittedAt: new Date(),
      },
      allAttempts: [],
    },
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByTestId("conflict-warning-banner")
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/Đang chấm điểm \(Khóa nộp lại\)/i)
    ).toBeInTheDocument();

    // Re-record buttons should not be present
    expect(canvas.queryByRole("button", { name: /Thu âm lại/i })).toBeNull();
  },
};

export const DeadlinePassedReadonly: Story = {
  args: {
    detail: {
      ...mockAssignmentDetail,
      assignment: {
        ...mockAssignmentDetail.assignment,
        submissionDeadline: new Date(Date.now() - 3600000), // 1 hour in the past
      },
    },
    mockMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const expiredElements = canvas.getAllByText(/Đã hết hạn/i);
    await expect(expiredElements.length).toBeGreaterThan(0);
  },
};

export const PublishedAssessmentReadonly: Story = {
  args: {
    detail: {
      ...mockAssignmentDetail,
      submission: {
        id: "sub_sb_published",
        assignmentId: "asg_sb_01",
        learnerId: "lrn_sb_01",
        status: "published",
        currentAttemptNumber: 1,
        reviewedAttemptNumber: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      currentAttempt: {
        id: "att_sb_published",
        submissionId: "sub_sb_published",
        attemptNumber: 1,
        audioResponses: [
          {
            promptId: "p_sb_1",
            storageKey: "homework/mock/p1.webm",
            durationMs: 42000,
            audioBytes: 85000,
          },
          {
            promptId: "p_sb_2",
            storageKey: "homework/mock/p2.webm",
            durationMs: 120000,
            audioBytes: 240000,
          },
        ],
        submittedAt: new Date(),
      },
      allAttempts: [],
    },
    mockMode: true,
    hasConsent: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByTestId("submission-published-banner")
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/Đã công bố kết quả \(Khóa nộp lại\)/i)
    ).toBeInTheDocument();
    await expect(canvas.getByText(/Đã chấm xong/i)).toBeInTheDocument();

    // Re-record buttons should not be present
    expect(canvas.queryByRole("button", { name: /Thu âm lại/i })).toBeNull();
  },
};
