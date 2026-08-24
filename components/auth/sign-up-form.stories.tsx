import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { SignUpForm } from "./sign-up-form";

const meta: Meta<typeof SignUpForm> = {
  title: "IELTS/Auth/SignUpForm",
  component: SignUpForm,
  parameters: {
    layout: "centered",
  },
  args: {
    onSubmit: fn(),
    onGoogleSignIn: fn(),
    onLoginClick: fn(),
    isLoading: false,
    isGoogleLoading: false,
    errorMessage: null,
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] p-5 bg-card rounded-xl border border-border/60 shadow-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SignUpForm>;

export const Default: Story = {};

export const SubmittingLoading: Story = {
  args: {
    isLoading: true,
  },
};

export const WithServerError: Story = {
  args: {
    errorMessage:
      "Email này đã được đăng ký trong hệ thống. Vui lòng đăng nhập hoặc sử dụng email khác.",
  },
};

export const InteractivePasswordStrengthTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const passwordInput = canvas.getByLabelText("Mật khẩu");

    // Type weak password
    await userEvent.type(passwordInput, "abc");
    expect(canvas.getByText("Yếu")).toBeInTheDocument();

    // Type medium password
    await userEvent.type(passwordInput, "defgh");
    expect(canvas.getByText("Trung bình")).toBeInTheDocument();
    expect(canvas.getByText("Tối thiểu 8 ký tự")).toBeInTheDocument();

    // Type very strong password with 12+ chars, uppercase, number and symbol
    await userEvent.type(passwordInput, "A1!xyz");
    expect(canvas.getByText("Rất mạnh")).toBeInTheDocument();
  },
};

export const InteractiveMismatchValidationTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const nameInput = canvas.getByLabelText("Họ và tên");
    const emailInput = canvas.getByLabelText("Địa chỉ Email");
    const passwordInput = canvas.getByLabelText("Mật khẩu");
    const confirmInput = canvas.getByLabelText("Xác nhận mật khẩu");
    const submitBtn = canvas.getByRole("button", { name: /Tạo tài khoản/i });

    await userEvent.type(nameInput, "Nguyễn Minh Anh");
    await userEvent.type(emailInput, "student@ielts.vn");
    await userEvent.type(passwordInput, "StrongPass123!");
    await userEvent.type(confirmInput, "DifferentPass123!");
    await userEvent.click(submitBtn);

    expect(
      canvas.getByText("Mật khẩu xác nhận không trùng khớp.")
    ).toBeInTheDocument();
  },
};

export const InteractiveSuccessfulSignUpTest: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const nameInput = canvas.getByLabelText("Họ và tên");
    const emailInput = canvas.getByLabelText("Địa chỉ Email");
    const passwordInput = canvas.getByLabelText("Mật khẩu");
    const confirmInput = canvas.getByLabelText("Xác nhận mật khẩu");
    const submitBtn = canvas.getByRole("button", { name: /Tạo tài khoản/i });

    await userEvent.type(nameInput, "Nguyễn Minh Anh");
    await userEvent.type(emailInput, "student@ielts.vn");
    await userEvent.type(passwordInput, "StrongPass123!");
    await userEvent.type(confirmInput, "StrongPass123!");
    await userEvent.click(submitBtn);

    expect(args.onSubmit).toHaveBeenCalledWith({
      name: "Nguyễn Minh Anh",
      email: "student@ielts.vn",
      password: "StrongPass123!",
      confirmPassword: "StrongPass123!",
    });
  },
};
