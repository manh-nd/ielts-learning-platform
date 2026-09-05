import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";
import { LiveSpeakingExaminerRoom } from "./live-speaking-examiner-room";
import { SPEAKING_PRACTICE_TOPICS } from "@/lib/data/speaking-practice-topics";

const meta = {
  title: "Speaking/Live/LiveSpeakingExaminerRoom",
  component: LiveSpeakingExaminerRoom,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    title: "Phòng Luyện Tập IELTS Speaking Trực Tiếp",
    subtitle: "Đối thoại thời gian thực 1-on-1 với Giám khảo AI (Examiner)",
    candidateName: "Nguyễn Văn Mạnh",
    topic: SPEAKING_PRACTICE_TOPICS[0],
    mockMode: true,
    hasConsent: true,
  },
} satisfies Meta<typeof LiveSpeakingExaminerRoom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultPracticeSimulation: Story = {
  args: {
    mockMode: true,
    topic: SPEAKING_PRACTICE_TOPICS[0],
    hasConsent: true,
  },
};

export const DefaultMockSimulation: Story = DefaultPracticeSimulation;

export const ConsentGateRequired: Story = {
  args: {
    mockMode: true,
    topic: SPEAKING_PRACTICE_TOPICS[0],
    hasConsent: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const connectButton = canvas.getByTestId("connect-live-btn");
    await expect(connectButton).toBeInTheDocument();
    await userEvent.click(connectButton);

    // Verify modal appeared in document
    const modalTitle = await within(document.body).findByText(
      /Xác nhận Điều khoản Thử nghiệm AI/i
    );
    await expect(modalTitle).toBeInTheDocument();

    const originalFetch = window.fetch;
    window.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [input] = args;
      if (typeof input === "string" && input.includes("/api/learner/consent")) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(...args);
    }) as unknown as typeof fetch;

    try {
      const agreeButton = await within(document.body).findByRole("button", {
        name: /Tôi đủ 18 tuổi & Đồng ý/i,
      });
      await userEvent.click(agreeButton);

      // Verify session started after consent
      await expect(canvas.getByTestId("live-status-badge")).toBeInTheDocument();
    } finally {
      window.fetch = originalFetch;
    }
  },
};

export const LiveSessionInteractiveTest: Story = {
  args: {
    mockMode: true,
    topic: SPEAKING_PRACTICE_TOPICS[0],
    hasConsent: true,
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
