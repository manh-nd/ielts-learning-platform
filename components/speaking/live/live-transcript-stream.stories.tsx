import type { Meta, StoryObj } from "@storybook/react";
import { LiveTranscriptStream } from "./live-transcript-stream";

const meta = {
  title: "Speaking/Live/LiveTranscriptStream",
  component: LiveTranscriptStream,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof LiveTranscriptStream>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    transcripts: [],
  },
};

export const ActiveConversation: Story = {
  args: {
    transcripts: [
      {
        id: "1",
        sender: "examiner",
        text: "Good morning. My name is Dr. Harrison. Could you please tell me your full name?",
        timestamp: Date.now() - 30000,
        isFinal: true,
      },
      {
        id: "2",
        sender: "user",
        text: "Good morning, Dr. Harrison. My name is Nguyen Van Manh. You can call me Manh.",
        timestamp: Date.now() - 22000,
        isFinal: true,
      },
      {
        id: "3",
        sender: "examiner",
        text: "Thank you, Manh. Let's start with Part 1. Do you work or are you a student?",
        timestamp: Date.now() - 15000,
        isFinal: true,
      },
      {
        id: "4",
        sender: "user",
        text: "Currently, I am working as a software engineer at a technology firm in Hanoi.",
        timestamp: Date.now() - 5000,
        isFinal: true,
      },
    ],
  },
};
