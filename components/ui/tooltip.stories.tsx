import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./tooltip";
import { Button } from "./button";
import { Info } from "lucide-react";

const meta: Meta<typeof Tooltip> = {
  title: "UI/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <TooltipProvider delay={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Thông tin tiêu chí IELTS"
          />
        }
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>
        <p>IELTS Band 7 requires frequent error-free sentences.</p>
      </TooltipContent>
    </Tooltip>
  ),
};

export const TooltipHoverInteractionTest: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button data-testid="tooltip-trigger-btn" variant="outline" size="sm">
            Band Info
          </Button>
        }
      />
      <TooltipContent data-testid="tooltip-bubble">
        <span data-testid="tooltip-text">
          Assessment adheres to official IELTS band descriptors.
        </span>
      </TooltipContent>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("tooltip-trigger-btn");
    await expect(trigger).toBeInTheDocument();
    await userEvent.hover(trigger);

    const tooltip = await within(document.body).findByTestId("tooltip-text");
    await expect(tooltip).toBeInTheDocument();
    await expect(tooltip).toHaveTextContent(
      "Assessment adheres to official IELTS"
    );
  },
};
