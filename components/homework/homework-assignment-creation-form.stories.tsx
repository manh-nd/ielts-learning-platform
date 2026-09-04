import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { HomeworkAssignmentCreationForm } from "./homework-assignment-creation-form";

const meta: Meta<typeof HomeworkAssignmentCreationForm> = {
  title: "Homework/HomeworkAssignmentCreationForm",
  component: HomeworkAssignmentCreationForm,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Form tạo và cấu hình bài tập Speaking discrete (1–3 prompts), lựa chọn đề bài mẫu hoặc soạn tùy chỉnh, cài đặt hạn nộp bài và lưu nháp hoặc giao ngay.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    onSubmit: fn(),
    onCancel: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HomeworkAssignmentCreationForm>;

export const Default: Story = {};

export const WithOnePrompt: Story = {
  args: {
    initialTitle: "Speaking Part 1 Daily Routine",
    initialInstructions: "Nói rõ ràng, tự nhiên, chú ý phát âm đuôi -s/-es.",
    initialPrompts: [
      {
        promptId: "p_init_1",
        text: "What is your typical daily morning routine?",
        partNumber: 1,
      },
    ],
  },
};

export const WithThreePromptsMax: Story = {
  args: {
    initialTitle: "Comprehensive Speaking HW (Part 1, 2, 3)",
    initialInstructions: "Hoàn thành đủ 3 câu hỏi trước thời hạn.",
    initialPrompts: [
      {
        promptId: "p_max_1",
        text: "Do you prefer working alone or in a team?",
        partNumber: 1,
      },
      {
        promptId: "p_max_2",
        text: "Describe a memorable journey you have taken.",
        partNumber: 2,
        subPrompts: [
          "Where you went",
          "Who you traveled with",
          "What made it special",
        ],
      },
      {
        promptId: "p_max_3",
        text: "How has transportation technology changed tourism in your country?",
        partNumber: 3,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addBtn = canvas.getByTestId("add-prompt-button");
    // When 3 prompts are present, Add Prompt must be disabled
    await expect(addBtn).toBeDisabled();
  },
};

export const EmptyTitleValidation: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const publishBtn = canvas.getByTestId("publish-assignment-button");

    // Click submit without entering a title
    await userEvent.click(publishBtn);

    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent(/Vui lòng nhập tiêu đề bài tập/);
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const SaveDraftInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const titleInput = canvas.getByTestId("assignment-title-input");
    const draftBtn = canvas.getByTestId("save-draft-button");

    await userEvent.type(titleInput, "Bản nháp Speaking Part 1");
    await userEvent.click(draftBtn);

    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    const callArgs = (args.onSubmit as ReturnType<typeof fn>).mock.calls[0][0];
    await expect(callArgs.title).toBe("Bản nháp Speaking Part 1");
    await expect(callArgs.status).toBe("draft");
  },
};
