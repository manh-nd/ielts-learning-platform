import type { Meta, StoryObj } from "@storybook/react";
import { LiveConnectionBadge } from "./live-connection-badge";

const meta = {
  title: "Product/Speaking/LiveConnectionBadge",
  component: LiveConnectionBadge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: [
        "idle",
        "requesting_token",
        "connecting",
        "connected",
        "disconnecting",
        "error",
      ],
    },
    voiceActivity: {
      control: "select",
      options: ["idle", "user_speaking", "ai_speaking"],
    },
  },
} satisfies Meta<typeof LiveConnectionBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    status: "idle",
  },
};

export const RequestingToken: Story = {
  args: {
    status: "requesting_token",
  },
};

export const Connecting: Story = {
  args: {
    status: "connecting",
  },
};

export const ConnectedListening: Story = {
  args: {
    status: "connected",
    voiceActivity: "idle",
  },
};

export const ExaminerSpeaking: Story = {
  args: {
    status: "connected",
    voiceActivity: "ai_speaking",
  },
};

export const CandidateSpeaking: Story = {
  args: {
    status: "connected",
    voiceActivity: "user_speaking",
  },
};

export const ErrorState: Story = {
  args: {
    status: "error",
  },
};
