import type { Meta, StoryObj } from "@storybook/react";
import { AuthCard } from "./auth-card";
import { LoginForm } from "./login-form";
import { SignUpForm } from "./sign-up-form";

const meta: Meta<typeof AuthCard> = {
  title: "Product/Auth/AuthCard",
  component: AuthCard,
  parameters: {
    layout: "centered",
  },
  args: {
    title: "Chào mừng trở lại",
    description: "Đăng nhập để tiếp tục lộ trình luyện thi IELTS 7.5+",
    brandName: "IELTS Prep Studio",
  },
};

export default meta;
type Story = StoryObj<typeof AuthCard>;

export const LoginWrapper: Story = {
  render: (args) => (
    <AuthCard {...args}>
      <LoginForm />
    </AuthCard>
  ),
};

export const SignUpWrapper: Story = {
  args: {
    title: "Tạo tài khoản mới",
    description: "Bắt đầu hành trình chinh phục điểm IELTS mục tiêu cùng AI",
  },
  render: (args) => (
    <AuthCard {...args}>
      <SignUpForm />
    </AuthCard>
  ),
};

export const CustomFooter: Story = {
  args: {
    title: "Xác thực an toàn",
    description: "Nền tảng chấm thi IELTS chuẩn Cambridge",
    footer: (
      <p className="text-[0.7rem] text-muted-foreground">
        Bảo mật bởi Better Auth & Chuẩn mã hóa OAuth 2.0
      </p>
    ),
  },
  render: (args) => (
    <AuthCard {...args}>
      <div className="py-6 text-center text-xs text-muted-foreground">
        Nội dung mẫu bên trong AuthCard
      </div>
    </AuthCard>
  ),
};
