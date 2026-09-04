import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { HomeworkAssignmentList } from "./homework-assignment-list";
import type { HomeworkAssignment } from "@/modules/homework/domain/homework-types";

const mockAssignments: HomeworkAssignment[] = [
  {
    id: "asgn_list_01",
    classroomId: "cls_101",
    teacherId: "teacher_01",
    title: "Speaking HW 1: Hometown & Daily Routine",
    instructions: "Record clearly and avoid long pauses.",
    prompts: [
      { promptId: "p_01", text: "Describe your hometown.", partNumber: 1 },
      {
        promptId: "p_02",
        text: "What is your morning routine?",
        partNumber: 1,
      },
    ],
    submissionDeadline: new Date(Date.now() + 86400000 * 3),
    status: "published",
    createdAt: new Date("2026-08-20T10:00:00Z"),
    updatedAt: new Date("2026-08-20T10:00:00Z"),
  },
  {
    id: "asgn_list_02",
    classroomId: "cls_101",
    teacherId: "teacher_01",
    title: "Speaking HW 2: Part 2 Cue Card Journey (Draft)",
    instructions: "Bản nháp đang soạn.",
    prompts: [
      {
        promptId: "p_03",
        text: "Describe a memorable journey you took.",
        partNumber: 2,
      },
    ],
    submissionDeadline: new Date(Date.now() + 86400000 * 5),
    status: "draft",
    createdAt: new Date("2026-08-21T11:00:00Z"),
    updatedAt: new Date("2026-08-21T11:00:00Z"),
  },
  {
    id: "asgn_list_03",
    classroomId: "cls_101",
    teacherId: "teacher_01",
    title: "Speaking HW 3: Archived Education Task",
    instructions: "Bài tập hoàn thành tuần trước.",
    prompts: [
      {
        promptId: "p_04",
        text: "How will AI impact language education?",
        partNumber: 3,
      },
    ],
    submissionDeadline: new Date(Date.now() - 86400000 * 7),
    status: "archived",
    createdAt: new Date("2026-08-10T09:00:00Z"),
    updatedAt: new Date("2026-08-10T09:00:00Z"),
  },
];

const meta: Meta<typeof HomeworkAssignmentList> = {
  title: "Homework/HomeworkAssignmentList",
  component: HomeworkAssignmentList,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Danh sách bài tập Speaking của lớp học, hỗ trợ lọc theo trạng thái (Tất cả, Đã giao, Nháp, Lưu trữ), tạo bài tập mới và xem chi tiết danh sách nộp bài.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    classroomId: "cls_101",
    classroomName: "IELTS Intensive Speaking K24",
    assignments: mockAssignments,
    isLoading: false,
    onCreateAssignment: fn(),
    onPublishAssignment: fn(),
    onArchiveAssignment: fn(),
    onDeleteDraftAssignment: fn(),
    onFetchAssignmentDetails: fn((id) =>
      Promise.resolve({
        assignment:
          mockAssignments.find((a) => a.id === id) || mockAssignments[0],
        classroom: { id: "cls_101", name: "IELTS Intensive Speaking K24" },
        students: [
          {
            learnerId: "lrn_01",
            learnerName: "Nguyen Van A",
            learnerEmail: "a@test.com",
            learnerImage: null,
            submissionStatus: "submitted" as const,
            submittedAt: new Date("2026-08-21T12:00:00Z"),
            submissionId: "sub_01",
          },
        ],
      })
    ),
  },
};

export default meta;
type Story = StoryObj<typeof HomeworkAssignmentList>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    assignments: [],
  },
};

export const FilterTabsInteraction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Initial state shows all 3
    expect(
      canvas.getByTestId("assignment-card-asgn_list_01")
    ).toBeInTheDocument();
    expect(
      canvas.getByTestId("assignment-card-asgn_list_02")
    ).toBeInTheDocument();
    expect(
      canvas.getByTestId("assignment-card-asgn_list_03")
    ).toBeInTheDocument();

    // Click on "Nháp" tab
    const draftTab = canvas.getByRole("tab", { name: /Nháp/ });
    await userEvent.click(draftTab);

    // Only draft assignment should remain
    expect(
      canvas.queryByTestId("assignment-card-asgn_list_01")
    ).not.toBeInTheDocument();
    expect(
      canvas.getByTestId("assignment-card-asgn_list_02")
    ).toBeInTheDocument();
    expect(
      canvas.queryByTestId("assignment-card-asgn_list_03")
    ).not.toBeInTheDocument();
  },
};
