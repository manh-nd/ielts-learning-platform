import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { HomeworkAssignmentCard } from "./homework-assignment-card";
import type { HomeworkAssignment } from "@/modules/homework/domain/homework-types";

const mockAssignment: HomeworkAssignment = {
  id: "asgn_card_01",
  classroomId: "cls_101",
  teacherId: "teacher_01",
  title: "Speaking Homework Part 1 & 2: Hometown & Journey",
  instructions:
    "Ghi âm câu trả lời hoàn chỉnh. Chú ý ngữ điệu tự nhiên và phân bổ thời gian hợp lý.",
  prompts: [
    {
      promptId: "p_card_1",
      text: "What is your hometown like?",
      partNumber: 1,
    },
    {
      promptId: "p_card_2",
      text: "Describe a memorable journey you have taken.",
      partNumber: 2,
      subPrompts: ["Where you went", "What you saw", "Why memorable"],
    },
  ],
  submissionDeadline: new Date(Date.now() + 86400000 * 3), // 3 days in future
  status: "published",
  createdAt: new Date("2026-08-20T10:00:00Z"),
  updatedAt: new Date("2026-08-20T10:00:00Z"),
};

const meta: Meta<typeof HomeworkAssignmentCard> = {
  title: "Homework/HomeworkAssignmentCard",
  component: HomeworkAssignmentCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thẻ tóm tắt thông tin bài tập Speaking discrete hiển thị trạng thái (Đã giao, Nháp, Lưu trữ), hạn nộp bài, số lượng prompts và các nút thao tác.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    assignment: mockAssignment,
    onViewDetails: fn(),
    onPublish: fn(),
    onArchive: fn(),
    onDeleteDraft: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HomeworkAssignmentCard>;

export const Published: Story = {};

export const Draft: Story = {
  args: {
    assignment: {
      ...mockAssignment,
      id: "asgn_card_draft",
      title: "Bản nháp bài tập Speaking Part 3: Technology",
      status: "draft",
    },
  },
};

export const Archived: Story = {
  args: {
    assignment: {
      ...mockAssignment,
      id: "asgn_card_archived",
      title: "Bài tập Speaking tháng 7 (Đã hoàn thành)",
      status: "archived",
    },
  },
};

export const Overdue: Story = {
  args: {
    assignment: {
      ...mockAssignment,
      id: "asgn_card_overdue",
      title: "Bài tập Speaking Part 1 (Đã quá hạn nộp bài)",
      submissionDeadline: new Date(Date.now() - 86400000 * 2), // 2 days ago
    },
  },
};

export const ViewDetailsInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const viewBtn = canvas.getByTestId("view-assignment-details-asgn_card_01");

    await userEvent.click(viewBtn);
    await expect(args.onViewDetails).toHaveBeenCalledTimes(1);
  },
};
