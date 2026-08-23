import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "@storybook/test";
import { LoginForm } from "./login-form";

const meta: Meta<typeof LoginForm> = {
  title: "IELTS/Auth/LoginForm",
  component: LoginForm,
  parameters: {
    layout: "centered",
  },
  args: {
    onSubmit: fn(),
    onGoogleSignIn: fn(),
    onForgotPasswordClick: fn(),
    onSignUpClick: fn(),
    isLoading: false,
    isGoogleLoading: false,
    errorMessage: null,
  },
  decorators: [
    (Story) => (
      <div className="w-[480px] p-6 sm:p-8 bg-card rounded-2xl border border-border/70 shadow-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LoginForm>;

export const Default: Story = {};

export const WithInitialEmail: Story = {
  args: {
    initialEmail: "teacher@ielts-prep.vn",
  },
};

export const SubmittingLoading: Story = {
  args: {
    isLoading: true,
    initialEmail: "student@ielts-prep.vn",
  },
};

export const GoogleAuthLoading: Story = {
  args: {
    isGoogleLoading: true,
  },
};

export const WithAuthError: Story = {
  args: {
    initialEmail: "wrong-user@ielts.vn",
    errorMessage: "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.",
  },
};

export const InteractiveValidationTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const submitBtn = canvas.getByRole("button", { name: /Đăng nhập/i });
    await userEvent.click(submitBtn);

    // Should display validation errors
    expect(
      canvas.getByText("Vui lòng nhập địa chỉ email.")
    ).toBeInTheDocument();
    expect(canvas.getByText("Vui lòng nhập mật khẩu.")).toBeInTheDocument();

    // Type invalid email format
    const emailInput = canvas.getByLabelText("Địa chỉ Email");
    await userEvent.type(emailInput, "not-an-email");
    await userEvent.click(submitBtn);

    expect(
      canvas.getByText("Địa chỉ email không đúng định dạng.")
    ).toBeInTheDocument();
  },
};

export const InteractivePasswordToggleTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const passwordInput = canvas.getByLabelText("Mật khẩu");

    expect(passwordInput).toHaveAttribute("type", "password");
    await userEvent.type(passwordInput, "MySecretPass123");

    // Click Show Password toggle
    const toggleBtn = canvas.getByRole("button", { name: "Hiện mật khẩu" });
    await userEvent.click(toggleBtn);

    expect(passwordInput).toHaveAttribute("type", "text");

    // Click Hide Password toggle
    const hideBtn = canvas.getByRole("button", { name: "Ẩn mật khẩu" });
    await userEvent.click(hideBtn);

    expect(passwordInput).toHaveAttribute("type", "password");
  },
};

export const InteractiveSuccessfulSubmitTest: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const emailInput = canvas.getByLabelText("Địa chỉ Email");
    const passwordInput = canvas.getByLabelText("Mật khẩu");
    const submitBtn = canvas.getByRole("button", { name: /Đăng nhập/i });

    await userEvent.type(emailInput, "learner@ielts-prep.vn");
    await userEvent.type(passwordInput, "ValidPassword123!");
    await userEvent.click(submitBtn);

    expect(args.onSubmit).toHaveBeenCalledWith({
      email: "learner@ielts-prep.vn",
      password: "ValidPassword123!",
    });
  },
};
