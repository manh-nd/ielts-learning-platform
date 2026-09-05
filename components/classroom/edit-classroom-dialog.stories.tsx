import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { EditClassroomDialog } from "./edit-classroom-dialog";

const meta: Meta<typeof EditClassroomDialog> = {
  title: "Product/Classroom/EditClassroomDialog",
  component: EditClassroomDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Modal dialog hỗ trợ giảng viên chỉnh sửa thông tin lớp học (tên lớp và mô tả).",
      },
    },
    a11y: { test: "error" },
  },
  args: {
    classroom: {
      id: "cls_edit_01",
      name: "IELTS Speaking Intensive K24",
      description: "Lớp luyện đề chuyên sâu Speaking Part 2 & 3",
    },
    onSubmit: fn(() => Promise.resolve()),
    isSubmitting: false,
  },
};

export default meta;
type Story = StoryObj<typeof EditClassroomDialog>;

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

export const EditInteraction: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("edit-classroom-trigger");
    await expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    const title = await within(document.body).findByTestId(
      "edit-classroom-title"
    );
    await expect(title).toBeInTheDocument();

    const nameInput = within(document.body).getByTestId(
      "edit-classroom-name-input"
    );
    const descInput = within(document.body).getByTestId(
      "edit-classroom-desc-input"
    );
    const submitBtn = within(document.body).getByTestId(
      "edit-classroom-submit-button"
    );

    // Verify initial values prefilled
    await expect(nameInput).toHaveValue("IELTS Speaking Intensive K24");

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "IELTS Speaking Masterclass 2026");
    await userEvent.clear(descInput);
    await userEvent.type(descInput, "Cập nhật lộ trình cam kết 8.0");
    await userEvent.click(submitBtn);

    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: "IELTS Speaking Masterclass 2026",
      description: "Cập nhật lộ trình cam kết 8.0",
    });
  },
};
