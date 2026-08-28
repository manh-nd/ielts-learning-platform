import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";
import { LiveSpeakingExaminerRoom } from "./live-speaking-examiner-room";
import { SPEAKING_MOCK_TOPICS } from "@/lib/data/speaking-mock-topics";

const meta = {
  title: "Speaking/Live/LiveSpeakingExaminerRoom",
  component: LiveSpeakingExaminerRoom,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    title: "Phòng Thi Thử IELTS Speaking Trực Tiếp",
    subtitle: "Đối thoại thời gian thực 1-on-1 với Giám khảo AI (Examiner)",
    candidateName: "Nguyễn Văn Mạnh",
    topic: SPEAKING_MOCK_TOPICS[0],
    targetPart: "full",
    mockMode: true,
  },
} satisfies Meta<typeof LiveSpeakingExaminerRoom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultMockSimulation: Story = {
  args: {
    mockMode: true,
    topic: SPEAKING_MOCK_TOPICS[0],
  },
};

export const LiveSessionInteractiveTest: Story = {
  args: {
    mockMode: true,
    topic: SPEAKING_MOCK_TOPICS[0],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify idle initial state
    const connectButton = canvas.getByTestId("connect-live-btn");
    await expect(connectButton).toBeInTheDocument();
    await expect(canvas.getByText("Sẵn sàng kết nối")).toBeInTheDocument();

    // 2. Click start examination
    await userEvent.click(connectButton);

    // 3. Verify connected state
    await expect(canvas.getByTestId("live-status-badge")).toBeInTheDocument();
    await expect(canvas.getByTestId("disconnect-live-btn")).toBeInTheDocument();
    await expect(canvas.getByTestId("mute-live-btn")).toBeInTheDocument();

    // 4. Test Mute toggle
    const muteButton = canvas.getByTestId("mute-live-btn");
    await userEvent.click(muteButton);
    await expect(
      canvas.getByText(/Microphone đang tắt tiếng/i)
    ).toBeInTheDocument();

    // 5. Test Unmute
    await userEvent.click(muteButton);
  },
};
