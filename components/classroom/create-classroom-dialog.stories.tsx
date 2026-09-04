import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { CreateClassroomDialog } from "./create-classroom-dialog";

const meta: Meta<typeof CreateClassroomDialog> = {
  title: "Classroom/CreateClassroomDialog",
  component: CreateClassroomDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Modal dialog hỗ trợ giảng viên tạo lớp học mới, bao gồm trường Tên lớp học bắt buộc và Mô tả tùy chọn.",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    onSubmit: fn().mockImplementation(() => Promise.resolve()),
    isSubmitting: false,
  },
};

export default meta;
type Story = StoryObj<typeof CreateClassroomDialog>;

export const Default: Story = {};

export const Open: Story = {
  args: {
    open: true,
  },
};

export const Submitting: Story = {
  args: {
    open: true,
    isSubmitting: true,
  },
};

export const SubmitInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("create-classroom-trigger");
    await expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    // Modal renders in document.body
    const title = await within(document.body).findByTestId(
      "create-classroom-title"
    );
    await expect(title).toBeInTheDocument();

    const nameInput = within(document.body).getByTestId(
      "create-classroom-name-input"
    );
    const descInput = within(document.body).getByTestId(
      "create-classroom-desc-input"
    );
    const submitBtn = within(document.body).getByTestId(
      "create-classroom-submit-button"
    );

    await userEvent.type(nameInput, "IELTS Speaking Intensive K25");
    await userEvent.type(descInput, "Luyện đề cấp tốc trong 4 tuần");
    await userEvent.click(submitBtn);

    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: "IELTS Speaking Intensive K25",
      description: "Luyện đề cấp tốc trong 4 tuần",
    });
  },
};
