import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "./popover";
import { Button } from "./button";
import { Badge } from "./badge";
import { AlertCircle, Check } from "lucide-react";

const meta: Meta<typeof Popover> = {
  title: "Design System/Primitives/Popover",
  component: Popover,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        Inspect Error
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <div className="flex items-center gap-2">
            <Badge variant="destructive">GRA</Badge>
            <PopoverTitle>Grammar Error</PopoverTitle>
          </div>
          <PopoverDescription>
            Subject-verb agreement mismatch in dependent clause.
          </PopoverDescription>
        </PopoverHeader>
        <div className="p-2 bg-muted rounded-md text-xs">
          <p className="line-through text-destructive">
            &quot;The people was going...&quot;
          </p>
          <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            &quot;The people were going...&quot;
          </p>
        </div>
        <Button size="sm" className="w-full gap-1">
          <Check className="size-3" /> Apply gợi ý
        </Button>
      </PopoverContent>
    </Popover>
  ),
};

export const OpenPopoverInteractionTest: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            data-testid="popover-trigger-btn"
            variant="outline"
            size="sm"
          />
        }
      >
        <AlertCircle className="size-3 text-destructive" />
        Highlight Diagnostic
      </PopoverTrigger>
      <PopoverContent data-testid="popover-box">
        <PopoverHeader>
          <PopoverTitle data-testid="popover-title">
            Lexical Resource Issue
          </PopoverTitle>
          <PopoverDescription>
            Overuse of informal vocabulary in Academic Task 2.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("popover-trigger-btn");
    await expect(trigger).toBeInTheDocument();
    await userEvent.click(trigger);

    const title = await within(document.body).findByTestId("popover-title");
    await expect(title).toBeInTheDocument();
    await expect(title).toHaveTextContent("Lexical Resource Issue");
  },
};
