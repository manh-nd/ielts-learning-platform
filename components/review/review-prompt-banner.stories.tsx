import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import { ReviewPromptBanner } from "./review-prompt-banner";

const meta: Meta<typeof ReviewPromptBanner> = {
  title: "Patterns/Review/ReviewPromptBanner",
  component: ReviewPromptBanner,
  parameters: {
    layout: "padded",
  },
  args: {
    title: "Writing Task 2 — Tuần 5: Crime & Punishment",
    taskType: "TASK_2",
    targetBand: 7.5,
    promptText:
      "Some people think that the best way to reduce crime is to give longer prison sentences. Others, however, believe there are better alternative ways of reducing crime. Discuss both views and give your opinion.",
    keyInstructions: [
      "Thảo luận đầy đủ cả 2 quan điểm (Both Views) một cách cân bằng.",
      "Đưa ra quan điểm cá nhân rõ ràng (Clear Position).",
      "Sử dụng ví dụ thực tế.",
    ],
    onOpenDetailsModal: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReviewPromptBanner>;

export const DefaultCollapsed: Story = {};

export const ExpandedByDefault: Story = {
  args: {
    defaultExpanded: true,
  },
};

export const Task1Report: Story = {
  args: {
    title: "Writing Task 1 — Renewable Energy Consumption",
    taskType: "TASK_1",
    targetBand: 6.5,
    promptText:
      "The bar chart below illustrates the percentage of renewable energy in total energy consumption across four European countries in 2010, 2018, and 2025. Summarise the information by selecting and reporting the main features.",
    keyInstructions: [
      "Viết Overview rõ ràng bao gồm xu hướng chung.",
      "Lựa chọn và báo cáo số liệu chính xác.",
    ],
  },
};

export const MobileViewport: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const ToggleAccordionTest: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Click toggle expand button
    const toggleBtn = canvas.getByRole("button", { name: /Mở rộng đề bài/i });
    await userEvent.click(toggleBtn);

    // Verify key instructions appear
    expect(
      canvas.getByText(/Thảo luận đầy đủ cả 2 quan điểm/i)
    ).toBeInTheDocument();

    // Click details modal button
    const detailsBtn = canvas.getByRole("button", {
      name: /Xem Rubric & Chi tiết/i,
    });
    await userEvent.click(detailsBtn);
    expect(args.onOpenDetailsModal).toHaveBeenCalled();
  },
};
