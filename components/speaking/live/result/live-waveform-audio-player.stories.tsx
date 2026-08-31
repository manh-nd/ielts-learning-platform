import type { Meta, StoryObj } from "@storybook/react";
import { LiveWaveformAudioPlayer } from "./live-waveform-audio-player";
import { expect, userEvent, within, fn } from "storybook/test";

const mockAmplitudes = [
  0.15, 0.22, 0.45, 0.65, 0.85, 0.92, 0.78, 0.45, 0.25, 0.15, 0.18, 0.55, 0.72,
  0.88, 0.62, 0.35, 0.2, 0.15, 0.4, 0.75, 0.89, 0.95, 0.8, 0.5, 0.3, 0.18, 0.35,
  0.65, 0.82, 0.7, 0.45, 0.22, 0.15, 0.3, 0.58, 0.75, 0.65, 0.4, 0.2, 0.15,
  0.18, 0.35, 0.5, 0.65, 0.45, 0.25, 0.15, 0.12,
];

const meta: Meta<typeof LiveWaveformAudioPlayer> = {
  title: "Speaking/Live/Result/WaveformAudioPlayer",
  component: LiveWaveformAudioPlayer,
  parameters: {
    layout: "centered",
  },
  args: {
    durationSeconds: 45,
    title: "Bản ghi âm bài nói Part 1",
    subtitle: "Sóng âm thực tế & nghe lại câu trả lời",
    staticAmplitudes: mockAmplitudes,
    onSeek: fn(),
    onTimeUpdate: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[620px] max-w-full p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LiveWaveformAudioPlayer>;

export const Default: Story = {};

export const FastPlayback: Story = {
  args: {
    durationSeconds: 120,
    title: "Ghi âm toàn bộ buổi thi (Full Test)",
  },
};

export const InteractiveControls: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // 1. Verify header & initial duration display
    expect(canvas.getByText("Bản ghi âm bài nói Part 1")).toBeInTheDocument();
    expect(canvas.getByTestId("player-current-time")).toHaveTextContent(
      "00:00"
    );
    expect(canvas.getByTestId("player-total-duration")).toHaveTextContent(
      "00:45"
    );

    // 2. Click Play toggle button
    const playBtn = canvas.getByTestId("player-toggle-play-btn");
    await userEvent.click(playBtn);

    // 3. Click Skip Forward (+5s)
    const forwardBtn = canvas.getByTestId("player-skip-forward-btn");
    await userEvent.click(forwardBtn);
    expect(args.onSeek).toHaveBeenCalledWith(5);
    expect(canvas.getByTestId("player-current-time")).toHaveTextContent(
      "00:05"
    );

    // 4. Click Skip Back (-5s)
    const backBtn = canvas.getByTestId("player-skip-back-btn");
    await userEvent.click(backBtn);
    expect(args.onSeek).toHaveBeenCalledWith(0);
    expect(canvas.getByTestId("player-current-time")).toHaveTextContent(
      "00:00"
    );

    // 5. Click Playback Speed 1.5x
    const speedBtn15 = canvas.getByTestId("player-speed-1.5x");
    await userEvent.click(speedBtn15);
    expect(speedBtn15).toHaveClass("font-bold");

    // 6. Click Toggle Mute
    const muteBtn = canvas.getByTestId("player-toggle-mute-btn");
    await userEvent.click(muteBtn);
  },
};
