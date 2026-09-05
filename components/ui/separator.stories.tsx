import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
  title: "Design System/Primitives/Separator",
  component: Separator,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-80 space-y-3">
      <div>
        <h4 className="text-sm font-medium">IELTS Writing Task 2</h4>
        <p className="text-xs text-muted-foreground">
          Academic Essay Evaluation Rubric
        </p>
      </div>
      <Separator />
      <div className="flex h-5 items-center space-x-4 text-xs">
        <div>TA: 7.0</div>
        <Separator orientation="vertical" />
        <div>CC: 7.5</div>
        <Separator orientation="vertical" />
        <div>LR: 6.5</div>
        <Separator orientation="vertical" />
        <div>GRA: 7.0</div>
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center space-x-4 text-sm">
      <span>AI Proposal</span>
      <Separator orientation="vertical" />
      <span>Teacher Review</span>
      <Separator orientation="vertical" />
      <span className="font-semibold text-primary">Published</span>
    </div>
  ),
};
