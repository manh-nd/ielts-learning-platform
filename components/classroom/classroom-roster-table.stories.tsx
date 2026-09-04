import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { ClassroomRosterTable } from "./classroom-roster-table";
import type {
  ClassroomWithMemberCount,
  ClassroomMemberDetail,
} from "@/modules/classroom/domain/classroom-types";

const mockClassroom: ClassroomWithMemberCount = {
  id: "cls_201",
  teacherId: "teacher_01",
  name: "IELTS Speaking Intensive K24",
  description:
    "Lớp luyện đề chuyên sâu Speaking Part 2 & 3 cam kết đầu ra 7.0+",
  memberCount: 3,
  createdAt: new Date("2026-08-20T09:00:00Z"),
  updatedAt: new Date("2026-08-20T09:00:00Z"),
};

const mockMembers: ClassroomMemberDetail[] = [
  {
    id: "mem_1",
    classroomId: "cls_201",
    learnerId: "learner_1",
    learnerName: "Nguyen Hoang Long",
    learnerEmail: "long.nguyen@example.com",
    learnerImage: null,
    joinedAt: new Date("2026-08-21T10:00:00Z"),
  },
  {
    id: "mem_2",
    classroomId: "cls_201",
    learnerId: "learner_2",
    learnerName: "Pham Thi Mai",
    learnerEmail: "mai.pham@example.com",
    learnerImage: null,
    joinedAt: new Date("2026-08-22T14:30:00Z"),
  },
  {
    id: "mem_3",
    classroomId: "cls_201",
    learnerId: "learner_3",
    learnerName: "Tran Van Duc",
    learnerEmail: "duc.tran@example.com",
    learnerImage: null,
    joinedAt: new Date("2026-08-23T08:15:00Z"),
  },
];

const meta: Meta<typeof ClassroomRosterTable> = {
  title: "Classroom/ClassroomRosterTable",
  component: ClassroomRosterTable,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Bảng danh sách học viên trong lớp học, tích hợp thanh công cụ ghi danh học viên bằng email và tính năng xóa khỏi lớp.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    classroom: mockClassroom,
    members: mockMembers,
    isLoading: false,
    isEnrolling: false,
    isRemoving: null,
    onEnroll: fn().mockImplementation(() => Promise.resolve()),
    onRemove: fn().mockImplementation(() => Promise.resolve()),
  },
};

export default meta;
type Story = StoryObj<typeof ClassroomRosterTable>;

export const Populated: Story = {};

export const EmptyMembers: Story = {
  args: {
    members: [],
  },
};

export const NoClassroomSelected: Story = {
  args: {
    classroom: null,
    members: [],
  },
};

export const EnrollInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const emailInput = canvas.getByTestId("enroll-learner-email-input");
    const submitBtn = canvas.getByTestId("enroll-learner-submit-btn");

    await expect(emailInput).toBeInTheDocument();
    await userEvent.type(emailInput, "newstudent@example.com");
    await userEvent.click(submitBtn);

    await expect(args.onEnroll).toHaveBeenCalledTimes(1);
    await expect(args.onEnroll).toHaveBeenCalledWith("newstudent@example.com");
  },
};

export const RemoveInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const removeBtn = canvas.getByTestId("remove-member-btn-learner_1");
    await expect(removeBtn).toBeInTheDocument();

    // Mock confirm dialog
    const originalConfirm = window.confirm;
    window.confirm = () => true;

    try {
      await userEvent.click(removeBtn);
      await expect(args.onRemove).toHaveBeenCalledTimes(1);
      await expect(args.onRemove).toHaveBeenCalledWith("learner_1");
    } finally {
      window.confirm = originalConfirm;
    }
  },
};
