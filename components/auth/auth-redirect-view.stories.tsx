import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { AuthRedirectView } from "./auth-redirect-view";

const meta: Meta<typeof AuthRedirectView> = {
  title: "Product/Auth/AuthRedirectView",
  component: AuthRedirectView,
  parameters: {
    layout: "centered",
  },
  args: {
    role: "teacher",
    status: "redirecting",
    onRetry: fn(),
    onManualRedirect: fn(),
    onBackToLogin: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AuthRedirectView>;

export const RedirectingToTeacher: Story = {
  args: {
    role: "teacher",
    status: "redirecting",
  },
};

export const RedirectingToLearner: Story = {
  args: {
    role: "learner",
    status: "redirecting",
  },
};

export const UnknownRoleLoading: Story = {
  args: {
    role: null,
    status: "loading",
  },
};

export const SessionErrorState: Story = {
  args: {
    status: "error",
    errorMessage:
      "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
  },
};

export const InteractiveRetryActionTest: Story = {
  args: {
    status: "error",
    errorMessage: "Không thể kết nối tới máy chủ xác thực.",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    const retryBtn = canvas.getByRole("button", { name: /Thử lại/i });
    expect(retryBtn).toBeInTheDocument();

    await userEvent.click(retryBtn);
    expect(args.onRetry).toHaveBeenCalledTimes(1);

    const backBtn = canvas.getByRole("button", {
      name: /Quay lại trang Đăng nhập/i,
    });
    expect(backBtn).toBeInTheDocument();

    await userEvent.click(backBtn);
    expect(args.onBackToLogin).toHaveBeenCalledTimes(1);
  },
};
