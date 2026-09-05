import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { HomeworkAssignmentDetailDialog } from "./homework-assignment-detail-dialog";
import type { HomeworkAssignment } from "@/modules/homework/domain/homework-types";
import type { HomeworkAssignmentStudentRosterItem } from "@/modules/homework/application/homework-read-models";

const mockAssignment: HomeworkAssignment = {
  id: "hw_detail_story_01",
  classroomId: "cls_story_01",
  teacherId: "teacher_01",
  title: "IELTS Speaking Part 2 - Describe a Journey",
  instructions:
    "Chuẩn bị trong 1 phút và ghi âm bài nói từ 1.5 đến 2 phút. Tập trung phát âm rõ ràng và ngữ điệu tự nhiên.",
  prompts: [
    {
      promptId: "p_1",
      partNumber: 2,
      text: "Describe a memorable journey you have taken recently.",
      subPrompts: [
        "Where you went",
        "Who you went with",
        "What you did there",
        "Explain why this journey was memorable to you",
      ],
    },
    {
      promptId: "p_2",
      partNumber: 3,
      text: "How has international travel changed over the past few decades?",
    },
  ],
  submissionDeadline: new Date(Date.now() + 86400000 * 3),
  status: "published",
  createdAt: new Date(Date.now() - 86400000),
  updatedAt: new Date(Date.now() - 86400000),
};

const mockStudents: HomeworkAssignmentStudentRosterItem[] = [
  {
    learnerId: "user_learner_1",
    learnerName: "Trần Minh Anh",
    learnerEmail: "minh.anh@example.com",
    learnerImage: null,
    submissionStatus: "submitted",
    submissionId: "sub_1",
    submittedAt: new Date(Date.now() - 3600000),
  },
  {
    learnerId: "user_learner_2",
    learnerName: "Nguyễn Hải Đăng",
    learnerEmail: "hai.dang@example.com",
    learnerImage: null,
    submissionStatus: "published",
    submissionId: "sub_2",
    submittedAt: new Date(Date.now() - 7200000),
  },
  {
    learnerId: "user_learner_3",
    learnerName: "Lê Hoàng Nam",
    learnerEmail: "hoang.nam@example.com",
    learnerImage: null,
    submissionStatus: "not_submitted",
    submissionId: null,
    submittedAt: null,
  },
];

const meta: Meta<typeof HomeworkAssignmentDetailDialog> = {
  title: "Homework/HomeworkAssignmentDetailDialog",
  component: HomeworkAssignmentDetailDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Modal dialog hiển thị chi tiết bài tập Speaking discrete, nội dung danh sách câu hỏi kèm theo bảng sĩ số nộp bài của học viên trong lớp.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    assignment: mockAssignment,
    classroomName: "IELTS T8/2026 Intensive",
    students: mockStudents,
    open: true,
    isLoading: false,
  },
};

export default meta;
type Story = StoryObj<typeof HomeworkAssignmentDetailDialog>;

export const PublishedOpen: Story = {
  play: async () => {
    const title = await within(document.body).findByText(
      "IELTS Speaking Part 2 - Describe a Journey"
    );
    await expect(title).toBeInTheDocument();
  },
};

export const DraftOpen: Story = {
  args: {
    assignment: {
      ...mockAssignment,
      id: "hw_draft_01",
      status: "draft",
      title: "Bản nháp Speaking Part 1 - Hometown",
    },
  },
};

export const ArchivedOpen: Story = {
  args: {
    assignment: {
      ...mockAssignment,
      id: "hw_archived_01",
      status: "archived",
      title: "Bài tập lưu trữ Speaking Part 3 - Technology",
    },
  },
};

export const EmptyRoster: Story = {
  args: {
    students: [],
  },
};
