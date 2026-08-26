import type { Meta, StoryObj } from "@storybook/react";
import { LiveSpeakingCueCardModal } from "./live-speaking-cue-card-modal";
import { fn } from "storybook/test";

const meta = {
  title: "Speaking/Live/LiveSpeakingCueCardModal",
  component: LiveSpeakingCueCardModal,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    cueCard: {
      topicTitle: "A memorable cultural journey or trip",
      cueCardPrompt:
        "Describe a memorable visit to a historical place or cultural heritage site.",
      bulletPoints: [
        "Where and when you visited this place",
        "Who accompanied you on this journey",
        "What historical relics, architecture, or traditions you witnessed",
        "And explain what made this cultural experience unforgettable for you",
      ],
      followUpQuestion:
        "Would you recommend this destination to foreign tourists?",
    },
    phase: "prep_countdown",
    prepTimeRemaining: 45,
    notes:
      "- Visited Hue Imperial Citadel in 2023 with family\n- Ancient royal architecture, Nguyen dynasty artifacts\n- Emotional & deeply inspiring cultural experience",
    onNotesChange: fn(),
    onFinishPrepEarly: fn(),
  },
} satisfies Meta<typeof LiveSpeakingCueCardModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrepCountdownState: Story = {
  args: {
    phase: "prep_countdown",
    prepTimeRemaining: 42,
  },
};

export const CandidateSpeakingState: Story = {
  args: {
    phase: "speaking",
    prepTimeRemaining: 0,
  },
};
