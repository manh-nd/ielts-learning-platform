import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { ClassroomManager } from "./classroom-manager";
import type {
  ClassroomWithMemberCount,
  ClassroomRosterItem,
} from "@/modules/classroom/application/classroom-read-models";

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

const mockMembersCls1: ClassroomRosterItem[] = [
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
          "Trang quản lý lớp học và sĩ số của giảng viên, hỗ trợ bố cục Master-Detail gồm danh sách lớp, modal tạo lớp mới, modal chỉnh sửa thông tin lớp học và bảng sĩ số học viên tích hợp shadcn AlertDialog.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    initialClassrooms: mockClassrooms,
    initialMembers: mockMembersCls1,
    onCreateClassroom: fn((data: { name: string; description?: string }) =>
      Promise.resolve({
        id: `cls_new_${Date.now()}`,
        teacherId: "teacher_01",
        name: data?.name || "Lớp học mới",
        description: data?.description || null,
        memberCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
    onFetchRoster: fn(() => Promise.resolve([])),
    onEnrollMember: fn((classroomId: string, email: string) =>
      Promise.resolve({
        id: `mem_new_${Date.now()}`,
        classroomId,
        learnerId: `learner_new_${Date.now()}`,
        learnerName: email ? email.split("@")[0] : "Học Viên Mới",
        learnerEmail: email || "student@example.com",
        learnerImage: null,
        joinedAt: new Date(),
      })
    ),
    onRemoveMember: fn(() => Promise.resolve()),
    onUpdateClassroom: fn((classroomId, data) =>
      Promise.resolve({
        id: classroomId,
        teacherId: "teacher_01",
        name: data.name,
        description: data.description || null,
        memberCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
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
  args: {
    onCreateClassroom: fn((data: { name: string; description?: string }) =>
      Promise.resolve({
        id: "cls_new_evening",
        teacherId: "teacher_01",
        name: data.name,
        description: data.description || null,
        memberCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
  },
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
    await expect(args.onCreateClassroom).toHaveBeenCalledWith({
      name: "IELTS Speaking Advanced Evening",
      description: undefined,
    });
  },
};

export const EnrollLearnerInteraction: Story = {
  args: {
    onEnrollMember: fn((classroomId: string, email: string) =>
      Promise.resolve({
        id: "mem_new_01",
        classroomId,
        learnerId: "learner_new_01",
        learnerName: "Candidate 2026",
        learnerEmail: email,
        learnerImage: null,
        joinedAt: new Date(),
      })
    ),
  },
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

export const EditClassroomInteraction: Story = {
  args: {
    onUpdateClassroom: fn((classroomId, data) =>
      Promise.resolve({
        id: classroomId,
        teacherId: "teacher_01",
        name: data.name,
        description: data.description || null,
        memberCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const editTrigger = canvas.getByTestId("edit-classroom-trigger");
    await expect(editTrigger).toBeInTheDocument();

    await userEvent.click(editTrigger);

    const nameInput = await within(document.body).findByTestId(
      "edit-classroom-name-input"
    );
    const submitBtn = within(document.body).getByTestId(
      "edit-classroom-submit-button"
    );

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "IELTS Speaking Intensive K24 - Renamed");
    await userEvent.click(submitBtn);

    await expect(args.onUpdateClassroom).toHaveBeenCalledTimes(1);
  },
};
