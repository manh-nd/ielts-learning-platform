import type { Meta, StoryObj } from "@storybook/react";
import { MicPermissionDeniedDialog } from "./mic-permission-denied-dialog";
import { fn, expect, userEvent, within } from "storybook/test";

const meta = {
  title: "Speaking/Live/MicPermissionDeniedDialog",
  component: MicPermissionDeniedDialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    open: true,
    onRetry: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof MicPermissionDeniedDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultChromeTab: Story = {
  args: {
    open: true,
  },
};

export const InteractiveTabSwitchAndRetry: Story = {
  args: {
    open: true,
  },
  play: async () => {
    const safariTab = await within(document.body).findByRole("tab", {
      name: /Safari/i,
    });
    expect(safariTab).toBeInTheDocument();
    await userEvent.click(safariTab);

    const retryBtn = await within(document.body).findByRole("button", {
      name: /Kiểm tra lại quyền/i,
    });
    expect(retryBtn).toBeInTheDocument();
    await userEvent.click(retryBtn);
  },
};
