import type { Meta, StoryObj } from "@storybook/react";
import { FreeTierConsentNoticeModal } from "./free-tier-consent-notice-modal";
import { fn, expect, userEvent, within, waitFor } from "storybook/test";

const meta = {
  title: "Speaking/Live/FreeTierConsentNoticeModal",
  component: FreeTierConsentNoticeModal,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    open: true,
    onConsent: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof FreeTierConsentNoticeModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
  },
};

export const InteractiveConsent: Story = {
  args: {
    open: true,
  },
  play: async ({ args }) => {
    const originalFetch = window.fetch;
    window.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [input] = args;
      if (typeof input === "string" && input.includes("/api/learner/consent")) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(...args);
    }) as unknown as typeof fetch;

    try {
      const agreeBtn = await within(document.body).findByRole("button", {
        name: /Tôi đủ 18 tuổi & Đồng ý/i,
      });
      expect(agreeBtn).toBeInTheDocument();
      await userEvent.click(agreeBtn);
      await waitFor(() => {
        expect(args.onConsent).toHaveBeenCalled();
      });
    } finally {
      window.fetch = originalFetch;
    }
  },
};

export const ConsentApiError: Story = {
  args: {
    open: true,
  },
  play: async ({ args }) => {
    const originalFetch = window.fetch;
    window.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [input] = args;
      if (typeof input === "string" && input.includes("/api/learner/consent")) {
        return new Response(JSON.stringify({ error: "Lỗi kết nối máy chủ" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(...args);
    }) as unknown as typeof fetch;

    try {
      const agreeBtn = await within(document.body).findByRole("button", {
        name: /Tôi đủ 18 tuổi & Đồng ý/i,
      });
      expect(agreeBtn).toBeInTheDocument();
      await userEvent.click(agreeBtn);
      await waitFor(async () => {
        const alert = await within(document.body).findByRole("alert");
        expect(alert).toBeInTheDocument();
      });
      expect(args.onConsent).not.toHaveBeenCalled();
    } finally {
      window.fetch = originalFetch;
    }
  },
};

export const InteractiveCancel: Story = {
  args: {
    open: true,
  },
  play: async ({ args }) => {
    const cancelBtn = await within(document.body).findByRole("button", {
      name: /Hủy bỏ/i,
    });
    expect(cancelBtn).toBeInTheDocument();
    await userEvent.click(cancelBtn);
    expect(args.onCancel).toHaveBeenCalled();
  },
};
