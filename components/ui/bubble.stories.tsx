import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Bubble, BubbleContent, BubbleGroup } from "./bubble";

const meta: Meta<typeof Bubble> = {
  title: "Patterns/Chat/Bubble",
  component: Bubble,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Bubble primitive hiển thị bong bóng tin nhắn với nhiều biến thể (default, outline, tinted, muted, destructive) và hỗ trợ trạng thái streaming.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "muted",
        "tinted",
        "outline",
        "ghost",
        "destructive",
      ],
    },
    align: {
      control: "select",
      options: ["start", "end"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Bubble>;

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-md p-4 bg-background border rounded-xl">
      <Bubble variant="default" align="start">
        <BubbleContent className="p-3">
          <p className="text-xs">Primary Default Bubble (User Outbound)</p>
        </BubbleContent>
      </Bubble>
      <Bubble variant="outline" align="start">
        <BubbleContent className="p-3">
          <p className="text-xs">Outline Bubble (Examiner Inbound)</p>
        </BubbleContent>
      </Bubble>
      <Bubble variant="tinted" align="start">
        <BubbleContent className="p-3">
          <p className="text-xs">Tinted Bubble (System Info / Note)</p>
        </BubbleContent>
      </Bubble>
      <Bubble variant="muted" align="start">
        <BubbleContent className="p-3">
          <p className="text-xs">Muted Secondary Bubble</p>
        </BubbleContent>
      </Bubble>
      <Bubble variant="destructive" align="start">
        <BubbleContent className="p-3">
          <p className="text-xs">Destructive Warning / Error Alert Bubble</p>
        </BubbleContent>
      </Bubble>
    </div>
  ),
};

export const StreamingState: Story = {
  render: () => (
    <div className="max-w-md p-4 bg-background border rounded-xl">
      <Bubble variant="outline" align="start" data-testid="streaming-bubble">
        <BubbleContent className="p-3">
          <p className="text-xs">
            I see your point about urban development. Let us now consider...
            <span
              data-testid="streaming-pulse"
              className="inline-block size-2 ml-1.5 rounded-full bg-primary animate-pulse align-middle"
            />
          </p>
        </BubbleContent>
      </Bubble>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pulse = canvas.getByTestId("streaming-pulse");
    await expect(pulse).toBeInTheDocument();
  },
};

export const GroupedStack: Story = {
  render: () => (
    <div className="max-w-md p-4 bg-background border rounded-xl">
      <BubbleGroup>
        <Bubble variant="outline">
          <BubbleContent className="p-3">
            <p className="text-xs">First paragraph of the examiner response.</p>
          </BubbleContent>
        </Bubble>
        <Bubble variant="outline">
          <BubbleContent className="p-3">
            <p className="text-xs">
              Follow-up clarification and next question.
            </p>
          </BubbleContent>
        </Bubble>
      </BubbleGroup>
    </div>
  ),
};
