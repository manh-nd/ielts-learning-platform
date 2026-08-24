import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { OAuthGoogleButton } from "./oauth-google-button";

const meta: Meta<typeof OAuthGoogleButton> = {
  title: "IELTS/Auth/OAuthGoogleButton",
  component: OAuthGoogleButton,
  parameters: {
    layout: "centered",
  },
  args: {
    label: "Tiếp tục với Google",
    loadingText: "Đang chuyển hướng tới Google...",
    isLoading: false,
    disabled: false,
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof OAuthGoogleButton>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const SignUpVariant: Story = {
  args: {
    label: "Đăng ký với Google",
  },
};

export const InteractiveClickTest: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /Tiếp tục với Google/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};
