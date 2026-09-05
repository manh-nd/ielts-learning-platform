import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { ReviewHeader } from "./review-header";

const mockStudent = {
  name: "Nguyễn Minh Anh",
  avatar: "NMA",
  class: "IELTS Master 7.5+ (K24)",
  submissionAttempt: 1,
  submittedAt: "22/08/2026 14:30",
};

const meta: Meta<typeof ReviewHeader> = {
  title: "Patterns/Navigation/ReviewHeader",
  component: ReviewHeader,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    student: mockStudent,
    taskType: "TASK_2",
    wordCount: 284,
    status: "ai_proposal_available",
    onQuickApproveAi: fn(),
    onApproveInternal: fn(),
    onPublishClick: fn(),
    onReopenClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReviewHeader>;

export const DefaultAiProposed: Story = {
  args: {
    status: "ai_proposal_available",
  },
};

export const InReview: Story = {
  args: {
    status: "in_review",
  },
};

export const ApprovedInternal: Story = {
  args: {
    status: "approved",
  },
};

export const Published: Story = {
  args: {
    status: "published",
  },
};

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

export const InteractiveActionsTest: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify student name and word count are present
    expect(canvas.getByText("Nguyễn Minh Anh")).toBeInTheDocument();
    expect(canvas.getByText("284 từ")).toBeInTheDocument();

    // Click Quick Approve AI
    const quickApproveBtn = canvas.getByRole("button", {
      name: /Apply đề xuất AI/i,
    });
    expect(quickApproveBtn).toBeInTheDocument();
    await userEvent.click(quickApproveBtn);
    expect(args.onQuickApproveAi).toHaveBeenCalled();

    // Click Publish button
    const publishBtn = canvas.getByRole("button", {
      name: /Công bố kết quả/i,
    });
    await userEvent.click(publishBtn);
    expect(args.onPublishClick).toHaveBeenCalled();
  },
};
