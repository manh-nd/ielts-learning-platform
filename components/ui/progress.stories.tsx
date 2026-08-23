import type { Meta, StoryObj } from "@storybook/react";
import { Progress, ProgressLabel, ProgressValue } from "./progress";

const meta: Meta<typeof Progress> = {
  title: "UI/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: {
    value: 65,
  },
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  render: (args) => (
    <div className="w-80">
      <Progress {...args} />
    </div>
  ),
};

export const WithLabelAndValue: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Progress value={75}>
        <ProgressLabel>Word Count Goal (Task 2)</ProgressLabel>
        <ProgressValue>
          {(_str, num) =>
            `${num}% (${Math.round(((num || 0) / 100) * 250)}/250 words)`
          }
        </ProgressValue>
      </Progress>

      <Progress value={100}>
        <ProgressLabel>Audio Upload Progress</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Progress value={20}>
        <ProgressLabel>Speaking Part 1</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={50}>
        <ProgressLabel>Speaking Part 2</ProgressLabel>
        <ProgressValue />
      </Progress>
      <Progress value={85}>
        <ProgressLabel>Speaking Part 3</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  ),
};
