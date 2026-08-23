import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent, fn } from "@storybook/test";
import { SpeakingPracticeSuite } from "./speaking-practice-suite";
import { SpeakingTestConfig } from "./types";

const mockTestConfig: SpeakingTestConfig = {
  id: "ielts-speaking-mock-cambridge-19",
  title: "Cambridge IELTS 19 - Speaking Test 1",
  subtitle: "Bài thi thử Speaking hoàn chỉnh 3 phần chuẩn IELTS",
  targetMode: "full",
  part1Questions: [
    {
      id: "part1-q1",
      part: "part1",
      order: 1,
      topic: "Work & Study",
      questionText: "Do you currently work, or are you a student?",
      maxDurationSeconds: 45,
    },
    {
      id: "part1-q2",
      part: "part1",
      order: 2,
      topic: "Hometown",
      questionText:
        "What do you like most about the town or city where you grew up?",
      maxDurationSeconds: 45,
    },
    {
      id: "part1-q3",
      part: "part1",
      order: 3,
      topic: "Technology & Daily Life",
      questionText:
        "How has technology made your daily routine easier or more convenient?",
      maxDurationSeconds: 45,
    },
  ],
  part2Question: {
    id: "part2-cue-card",
    part: "part2",
    order: 1,
    topic: "Travel & Memories",
    questionText:
      "Describe a memorable journey or holiday you took with friends or family.",
    cueCardBullets: [
      "Where you went and how you traveled there",
      "Who you went with",
      "What activities you did during this trip",
      "And explain why this journey was so memorable and special to you",
    ],
    prepTimeSeconds: 60,
    maxDurationSeconds: 120,
  },
  part3Questions: [
    {
      id: "part3-q1",
      part: "part3",
      order: 1,
      topic: "Tourism & Psychology",
      questionText:
        "Why do you think many people prefer traveling abroad rather than exploring domestic destinations?",
      maxDurationSeconds: 60,
    },
    {
      id: "part3-q2",
      part: "part3",
      order: 2,
      topic: "Environmental Impact",
      questionText:
        "What measures can governments and travel companies take to reduce the environmental footprint of mass tourism?",
      maxDurationSeconds: 60,
    },
  ],
};

const meta = {
  title: "Speaking/Practice/SpeakingPracticeSuite",
  component: SpeakingPracticeSuite,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    config: mockTestConfig,
    initialStep: "part1",
    mockMode: true,
    fastPrepTimer: true,
    onSubmit: fn(),
  },
} satisfies Meta<typeof SpeakingPracticeSuite>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultMockFlow: Story = {
  args: {
    mockMode: true,
    fastPrepTimer: true,
  },
};

export const Part2CueCardDirect: Story = {
  args: {
    initialStep: "part2",
    mockMode: true,
    fastPrepTimer: true,
  },
};

export const SummaryReviewDirect: Story = {
  args: {
    initialStep: "summary",
    mockMode: true,
  },
};

export const InteractiveFullTestPlay: Story = {
  args: {
    mockMode: true,
    fastPrepTimer: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 1. Verify Part 1 Question 1 is visible
    await expect(
      canvas.getByText(/Do you currently work/i)
    ).toBeInTheDocument();
    const startPart1RecordBtn = canvas.getByTestId("start-question-record-btn");
    await expect(startPart1RecordBtn).toBeInTheDocument();

    // 2. Click record question 1
    await userEvent.click(startPart1RecordBtn);
    const stopPart1RecordBtn = canvas.getByTestId("stop-question-record-btn");
    await expect(stopPart1RecordBtn).toBeInTheDocument();

    // 3. Stop recording question 1
    await userEvent.click(stopPart1RecordBtn);
    await expect(
      canvas.getByTestId("play-question-preview-btn")
    ).toBeInTheDocument();

    // 4. Advance to Part 1 Question 2
    const nextBtn = canvas.getByTestId("next-speaking-question-btn");
    await userEvent.click(nextBtn);
    await expect(
      canvas.getByText(/What do you like most about the town/i)
    ).toBeInTheDocument();

    // 5. Navigate to Part 2 via navigator
    const part2TabBtn = canvas.getByRole("button", { name: /Part 2/i });
    await userEvent.click(part2TabBtn);

    // 6. Verify Part 2 Cue Card & Scratchpad are present
    await expect(canvas.getByTestId("speaking-cue-card")).toBeInTheDocument();
    await expect(canvas.getByTestId("speaking-scratchpad")).toBeInTheDocument();
    await expect(
      canvas.getByTestId("start-part2-prep-btn")
    ).toBeInTheDocument();

    // 7. Start Part 2 Preparation
    await userEvent.click(canvas.getByTestId("start-part2-prep-btn"));

    // 8. Type some notes into Scratchpad
    const scratchpad = canvas.getByTestId("scratchpad-textarea");
    await userEvent.type(
      scratchpad,
      "Trip to Da Nang: Beach, seafood, night market"
    );
    await expect(scratchpad).toHaveValue(
      "Trip to Da Nang: Beach, seafood, night market"
    );

    // 9. Skip / Start Speaking now
    const startSpeakingBtn = canvas.getByTestId("start-part2-speaking-now-btn");
    await userEvent.click(startSpeakingBtn);

    // 10. Verify Part 2 recording active and stop recording
    const stopPart2Btn = canvas.getByTestId("stop-part2-speaking-btn");
    await expect(stopPart2Btn).toBeInTheDocument();
    await userEvent.click(stopPart2Btn);

    // 11. Verify Part 2 review & advance to Part 3
    await expect(
      canvas.getByTestId("play-part2-preview-btn")
    ).toBeInTheDocument();
    const advanceToPart3Btn = canvas.getByTestId("advance-to-part3-btn");
    await userEvent.click(advanceToPart3Btn);

    // 12. In Part 3, navigate to Summary step
    const summaryTabBtn = canvas.getByRole("button", { name: /Tổng kết/i });
    await userEvent.click(summaryTabBtn);

    // 13. Verify Summary View is rendered
    await expect(
      canvas.getByTestId("speaking-summary-view")
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/Tổng Kết Bài Thi Speaking/i)
    ).toBeInTheDocument();

    // 14. Click Submit button & check confirm dialog
    const submitBtn = canvas.getByTestId("submit-speaking-test-btn");
    await userEvent.click(submitBtn);

    // 15. Confirm submit
    const confirmFinalSubmitBtn = canvas.getByTestId(
      "confirm-final-submit-btn"
    );
    await userEvent.click(confirmFinalSubmitBtn);
  },
};
