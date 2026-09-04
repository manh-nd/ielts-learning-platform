import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { HomeworkAssignmentCreationDialog } from "./homework-assignment-creation-dialog";

const meta: Meta<typeof HomeworkAssignmentCreationDialog> = {
  title: "Homework/HomeworkAssignmentCreationDialog",
  component: HomeworkAssignmentCreationDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Modal dialog chứa form tạo và giao bài tập Speaking discrete (1–3 prompts) cho lớp học, hỗ trợ lựa chọn đề bài mẫu và đặt hạn nộp bài.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    classroomName: "IELTS T8/2026 Intensive",
    onSubmit: fn(() => Promise.resolve()),
    isSubmitting: false,
  },
};

export default meta;
type Story = StoryObj<typeof HomeworkAssignmentCreationDialog>;

export const Default: Story = {};

export const OpenDialog: Story = {
  args: {
    open: true,
  },
};

export const SubmittingState: Story = {
  args: {
    open: true,
    isSubmitting: true,
  },
};

export const MobileViewport: Story = {
  args: {
    open: true,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const InteractiveOpenAndSubmit: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const triggerBtn = canvas.getByTestId("create-assignment-trigger-button");
    await expect(triggerBtn).toBeInTheDocument();

    // Open modal
    await userEvent.click(triggerBtn);

    // Modal mounts into document.body
    const dialogTitle = await within(document.body).findByText(
      "Tạo & Giao Bài tập Speaking Discrete"
    );
    await expect(dialogTitle).toBeInTheDocument();

    const titleInput = within(document.body).getByTestId(
      "assignment-title-input"
    );
    await userEvent.type(titleInput, "IELTS Speaking Part 1 - Work & Studies");

    const publishBtn = within(document.body).getByTestId(
      "publish-assignment-button"
    );
    await userEvent.click(publishBtn);

    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    const callArgs = (args.onSubmit as ReturnType<typeof fn>).mock.calls[0][0];
    await expect(callArgs.title).toBe("IELTS Speaking Part 1 - Work & Studies");
    await expect(callArgs.status).toBe("published");
  },
};
