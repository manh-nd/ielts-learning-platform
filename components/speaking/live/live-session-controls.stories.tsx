import type { Meta, StoryObj } from "@storybook/react";
import { fn, expect, userEvent, within } from "storybook/test";
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

export const PermissionDenied: Story = {
  args: {
    status: "permission_denied",
    isMuted: false,
    onRequestPermissionDialog: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const disabledBtn = canvas.getByTestId("connect-live-btn");
    await expect(disabledBtn).toBeDisabled();
    await expect(disabledBtn).toHaveTextContent(/Microphone bị từ chối/i);

    const guideBtn = canvas.getByTestId("open-mic-guide-btn");
    await expect(guideBtn).toBeInTheDocument();
    await userEvent.click(guideBtn);
    await expect(args.onRequestPermissionDialog).toHaveBeenCalled();
  },
};
