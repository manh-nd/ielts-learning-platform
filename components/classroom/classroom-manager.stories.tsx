import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { ClassroomManager } from "./classroom-manager";
import type {
  ClassroomWithMemberCount,
  ClassroomMemberDetail,
} from "@/modules/classroom/domain/classroom-types";

const mockClassrooms: ClassroomWithMemberCount[] = [
  {
    id: "cls_m1",
    teacherId: "teacher_01",
    name: "IELTS Speaking Intensive K24",
    description:
      "Lớp luyện đề chuyên sâu Speaking Part 2 & 3 cam kết đầu ra 7.0+",
    memberCount: 2,
    createdAt: new Date("2026-08-20T09:00:00Z"),
    updatedAt: new Date("2026-08-20T09:00:00Z"),
  },
  {
    id: "cls_m2",
    teacherId: "teacher_01",
    name: "IELTS Foundation Morning",
    description: "Luyện ngữ âm và từ vựng IELTS cơ bản cho người mới bắt đầu",
    memberCount: 5,
    createdAt: new Date("2026-08-15T08:00:00Z"),
    updatedAt: new Date("2026-08-15T08:00:00Z"),
  },
];

const mockMembersCls1: ClassroomMemberDetail[] = [
  {
    id: "mem_m1",
    classroomId: "cls_m1",
    learnerId: "learner_m1",
    learnerName: "Nguyen Hoang Long",
    learnerEmail: "long.nguyen@example.com",
    learnerImage: null,
    joinedAt: new Date("2026-08-21T10:00:00Z"),
  },
  {
    id: "mem_m2",
    classroomId: "cls_m1",
    learnerId: "learner_m2",
    learnerName: "Pham Thi Mai",
    learnerEmail: "mai.pham@example.com",
    learnerImage: null,
    joinedAt: new Date("2026-08-22T14:30:00Z"),
  },
];

const meta: Meta<typeof ClassroomManager> = {
  title: "Classroom/ClassroomManager",
  component: ClassroomManager,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Trang quản lý lớp học và sĩ số của giảng viên, hỗ trợ bố cục Master-Detail gồm danh sách lớp, modal tạo lớp mới và bảng sĩ số học viên.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    initialClassrooms: mockClassrooms,
    initialMembers: mockMembersCls1,
    onCreateClassroom: fn().mockImplementation((data) =>
      Promise.resolve({
        id: `cls_new_${Date.now()}`,
        teacherId: "teacher_01",
        name: data.name,
        description: data.description || null,
        memberCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
    onFetchRoster: fn().mockImplementation(() => Promise.resolve([])),
    onEnrollMember: fn().mockImplementation((classroomId, email) =>
      Promise.resolve({
        id: `mem_new_${Date.now()}`,
        classroomId,
        learnerId: `learner_new_${Date.now()}`,
        learnerName: "Học Viên Mới",
        learnerEmail: email,
        learnerImage: null,
        joinedAt: new Date(),
      })
    ),
    onRemoveMember: fn().mockImplementation(() => Promise.resolve()),
  },
};

export default meta;
type Story = StoryObj<typeof ClassroomManager>;

export const DefaultWithClassrooms: Story = {};

export const EmptyClassrooms: Story = {
  args: {
    initialClassrooms: [],
    initialMembers: [],
  },
};

export const CreateClassroomInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const createTrigger = canvas.getByTestId("create-classroom-trigger");
    await expect(createTrigger).toBeInTheDocument();

    await userEvent.click(createTrigger);

    const nameInput = await within(document.body).findByTestId(
      "create-classroom-name-input"
    );
    const submitBtn = within(document.body).getByTestId(
      "create-classroom-submit-button"
    );

    await userEvent.type(nameInput, "IELTS Speaking Advanced Evening");
    await userEvent.click(submitBtn);

    await expect(args.onCreateClassroom).toHaveBeenCalledTimes(1);
  },
};

export const EnrollLearnerInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const emailInput = canvas.getByTestId("enroll-learner-email-input");
    const submitBtn = canvas.getByTestId("enroll-learner-submit-btn");

    await userEvent.type(emailInput, "candidate2026@gmail.com");
    await userEvent.click(submitBtn);

    await expect(args.onEnrollMember).toHaveBeenCalledTimes(1);
    await expect(args.onEnrollMember).toHaveBeenCalledWith(
      "cls_m1",
      "candidate2026@gmail.com"
    );
  },
};
