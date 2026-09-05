import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { ClassroomCard } from "./classroom-card";
import type { ClassroomWithMemberCount } from "@/modules/classroom/application/classroom-read-models";

const mockClassroom: ClassroomWithMemberCount = {
  id: "cls_101",
  teacherId: "teacher_01",
  name: "IELTS Speaking Intensive K24",
  description:
    "Lớp luyện đề chuyên sâu Speaking Part 2 & 3 cam kết đầu ra 7.0+",
  memberCount: 15,
  createdAt: new Date("2026-08-15T08:00:00Z"),
  updatedAt: new Date("2026-08-15T08:00:00Z"),
};

const meta: Meta<typeof ClassroomCard> = {
  title: "Classroom/ClassroomCard",
  component: ClassroomCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thẻ hiển thị thông tin tóm tắt lớp học của giáo viên bao gồm tên, mô tả, số lượng học viên và ngày tạo.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    classroom: mockClassroom,
    isSelected: false,
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ClassroomCard>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    isSelected: true,
  },
};

export const ZeroMembers: Story = {
  args: {
    classroom: {
      ...mockClassroom,
      id: "cls_zero",
      name: "IELTS Foundation Morning",
      description: "Lớp học mới tạo, chưa có học viên đăng ký.",
      memberCount: 0,
    },
  },
};

export const LongDescription: Story = {
  args: {
    classroom: {
      ...mockClassroom,
      name: "IELTS Masterclass Speaking & Writing - Fall 2026",
      description:
        "Khóa học chuyên sâu dành cho học viên trình độ B2 hướng tới C1. Nội dung bao gồm toàn bộ 4 tiêu chí chấm thi IELTS: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation. Có chấm bài trực tiếp cùng AI và Giảng viên.",
    },
  },
};

export const ClickInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByTestId("classroom-card-cls_101");
    await expect(card).toBeInTheDocument();

    await userEvent.click(card);
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    await expect(args.onSelect).toHaveBeenCalledWith(mockClassroom);
  },
};
