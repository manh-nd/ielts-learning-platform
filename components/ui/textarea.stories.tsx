import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "UI/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    placeholder: "Type your IELTS feedback or essay response here...",
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  render: (args) => (
    <div className="w-96">
      <Textarea {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-96">
      <Textarea
        disabled
        value="This essay submission is locked and cannot be edited while under review."
      />
    </div>
  ),
};

export const TypingInteractionTest: Story = {
  render: () => (
    <div className="w-96">
      <Textarea data-testid="test-textarea" placeholder="Type here..." />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByTestId("test-textarea");
    await expect(textarea).toBeInTheDocument();
    await userEvent.type(
      textarea,
      "In conclusion, renewable energy is essential."
    );
    await expect(textarea).toHaveValue(
      "In conclusion, renewable energy is essential."
    );
  },
};
