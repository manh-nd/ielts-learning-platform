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

export const StreamingInProgress: Story = {
  args: {
    transcripts: [
      {
        id: "1",
        sender: "examiner",
        text: "Good morning. My name is Dr. Harrison. Could you please tell me your full name?",
        timestamp: Date.now() - 10000,
        isFinal: true,
      },
      {
        id: "2",
        sender: "user",
        text: "My name is Nguyen Van Manh and I'm currently",
        timestamp: Date.now() - 1000,
        isFinal: false,
      },
    ],
  },
};

export const LongConversationWithScroll: Story = {
  args: {
    transcripts: [
      {
        id: "1",
        sender: "examiner",
        text: "Good morning. My name is Dr. Harrison. Could you please state your full name?",
        timestamp: Date.now() - 60000,
        isFinal: true,
      },
      {
        id: "2",
        sender: "user",
        text: "Good morning. My name is Nguyen Van Manh.",
        timestamp: Date.now() - 50000,
        isFinal: true,
      },
      {
        id: "3",
        sender: "examiner",
        text: "Thank you. Let's begin with Part 1. What kind of technology do you use most frequently?",
        timestamp: Date.now() - 40000,
        isFinal: true,
      },
      {
        id: "4",
        sender: "user",
        text: "I primarily use my laptop and smartphone every day for both professional software development and communication.",
        timestamp: Date.now() - 30000,
        isFinal: true,
      },
      {
        id: "5",
        sender: "examiner",
        text: "Do you think children nowadays spend too much time on electronic devices?",
        timestamp: Date.now() - 20000,
        isFinal: true,
      },
      {
        id: "6",
        sender: "user",
        text: "Yes, definitely. While digital tools provide great learning opportunities, excessive screen time can reduce physical activity and face-to-face interaction.",
        timestamp: Date.now() - 10000,
        isFinal: true,
      },
    ],
  },
};
