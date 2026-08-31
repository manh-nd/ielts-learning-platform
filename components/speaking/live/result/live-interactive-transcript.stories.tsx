import type { Meta, StoryObj } from "@storybook/react";
import { LiveInteractiveTranscript } from "./live-interactive-transcript";
import { expect, userEvent, within, fn } from "storybook/test";

const mockTranscripts = [
  {
    id: "t-1",
    sender: "examiner" as const,
    text: "Good afternoon! My name is Examiner Alex. Could you please state your full name?",
    timestamp: 0,
  },
  {
    id: "t-2",
    sender: "candidate" as const,
    text: "Good afternoon, Examiner. My full name is Nguyen Van An, but you can call me An.",
    timestamp: 5000,
  },
  {
    id: "t-3",
    sender: "examiner" as const,
    text: "Thank you, An. Let's talk about where you live. Do you live in a house or an apartment?",
    timestamp: 12000,
  },
  {
    id: "t-4",
    sender: "candidate" as const,
    text: "Currently, I live in a modern high-rise apartment located in the downtown district of Ho Chi Minh City.",
    timestamp: 18000,
  },
];

const meta: Meta<typeof LiveInteractiveTranscript> = {
  title: "Speaking/Live/Result/InteractiveTranscript",
  component: LiveInteractiveTranscript,
  parameters: {
    layout: "centered",
  },
  args: {
    transcripts: mockTranscripts,
    candidateName: "Nguyễn Văn An",
    currentTimeSeconds: 0,
    onSeekToTime: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[680px] max-w-full p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LiveInteractiveTranscript>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Verify transcript turns exist
    expect(canvas.getByText(/Gỡ băng Tương tác Buổi thi/i)).toBeInTheDocument();
    expect(canvas.getAllByText(/Nguyễn Văn An/i).length).toBeGreaterThan(0);
    expect(canvas.getByText(/Examiner Alex/i)).toBeInTheDocument();

    // Click on timestamp button to seek audio
    const seekBtn = canvas.getByTestId("seek-timestamp-btn-3");
    await userEvent.click(seekBtn);
    expect(args.onSeekToTime).toHaveBeenCalledWith(18);
  },
};

export const ActiveAudioHighlight: Story = {
  args: {
    currentTimeSeconds: 18,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const turn3 = canvas.getByTestId("transcript-turn-3");
    expect(turn3).toHaveClass("ring-2");
  },
};
