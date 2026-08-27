import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { ScrollArea } from "./scroll-area";

const meta: Meta<typeof ScrollArea> = {
  title: "UI/ScrollArea",
  component: ScrollArea,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "ScrollArea primitive cung cấp thanh cuộn tuỳ biến giao diện mượt mà và khả năng tiếp cận tiêu chuẩn.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScrollArea>;

export const Default: Story = {
  render: () => (
    <ScrollArea
      className="h-64 w-80 rounded-xl border p-4"
      data-testid="scroll-area-container"
    >
      <div className="space-y-4">
        <h4 className="text-sm font-semibold leading-none">
          IELTS Speaking Topics
        </h4>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="text-xs text-muted-foreground border-b pb-2">
            Topic {i + 1}: Technology & Artificial Intelligence in Education and
            Work environments.
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByText("IELTS Speaking Topics");
    await expect(heading).toBeInTheDocument();
  },
};
