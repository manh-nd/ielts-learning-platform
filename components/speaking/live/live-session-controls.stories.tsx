import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { LiveSessionControls } from "./live-session-controls";

const meta = {
  title: "Speaking/Live/LiveSessionControls",
  component: LiveSessionControls,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onConnect: fn(),
    onDisconnect: fn(),
    onToggleMute: fn(),
  },
} satisfies Meta<typeof LiveSessionControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    status: "idle",
    isMuted: false,
    inputVolume: 0,
  },
};

export const Connecting: Story = {
  args: {
    status: "connecting",
    isMuted: false,
    inputVolume: 0,
  },
};

export const ConnectedActive: Story = {
  args: {
    status: "connected",
    isMuted: false,
    inputVolume: 0.6,
  },
};

export const Muted: Story = {
  args: {
    status: "connected",
    isMuted: true,
    inputVolume: 0,
  },
};
