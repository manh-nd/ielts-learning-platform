import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Design System/Primitives/Input",
  component: Input,
  parameters: {
    layout: "centered",
  },
  args: {
    placeholder: "Nhập văn bản...",
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "example@ielts-prep.vn",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: "Giá trị không thể sửa đổi",
  },
};

export const InvalidError: Story = {
  args: {
    "aria-invalid": true,
    value: "invalid-email-format",
  },
};

export const PasswordType: Story = {
  args: {
    type: "password",
    value: "SecretPassword123!",
  },
};

export const InteractiveTypingTest: Story = {
  args: {
    placeholder: "Nhập địa chỉ email...",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText("Nhập địa chỉ email...");
    expect(input).toBeInTheDocument();

    await userEvent.type(input, "student@ielts.vn");
    expect(input).toHaveValue("student@ielts.vn");
  },
};
