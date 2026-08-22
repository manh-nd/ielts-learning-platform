import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thành phần Button chuẩn dựa trên `@base-ui/react/button` và `class-variance-authority`. Hỗ trợ đầy đủ các biến thể màu sắc, kích thước và trạng thái tương tác cho nền tảng IELTS.",
      },
    },
  },
  args: {
    onClick: fn(),
    children: "Button",
  },
  argTypes: {
    variant: {
      description: "Biến thể giao diện thị giác của nút bấm",
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "ghost",
        "destructive",
        "link",
      ],
    },
    size: {
      description: "Kích thước nút bấm theo tỷ lệ giao diện",
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Nút hành động chính (Primary Action) với màu nền thương hiệu.",
      },
    },
  },
  args: {
    variant: "default",
    children: "Primary Button",
  },
};

export const Outline: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Nút viền ngoài (Outline) dùng cho các hành động phụ hoặc nút hủy.",
      },
    },
  },
  args: {
    variant: "outline",
    children: "Outline Button",
  },
};

export const Secondary: Story = {
  parameters: {
    docs: {
      description: {
        story: "Nút phụ (Secondary Action) với độ tương phản vừa phải.",
      },
    },
  },
  args: {
    variant: "secondary",
    children: "Secondary Button",
  },
};

export const Destructive: Story = {
  parameters: {
    docs: {
      description: {
        story: "Nút cảnh báo nguy hiểm (Xóa bài, hủy bỏ chấm).",
      },
    },
  },
  args: {
    variant: "destructive",
    children: "Destructive Button",
  },
};

export const Ghost: Story = {
  parameters: {
    docs: {
      description: {
        story: "Nút trong suốt (Ghost) chỉ hiện nền khi hover.",
      },
    },
  },
  args: {
    variant: "ghost",
    children: "Ghost Button",
  },
};

export const Link: Story = {
  parameters: {
    docs: {
      description: {
        story: "Nút dạng văn bản liên kết có gạch chân.",
      },
    },
  },
  args: {
    variant: "link",
    children: "Link Button",
  },
};

export const ClickInteractionTest: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Kiểm thử tương tác người dùng: Tự động click và xác nhận hàm `onClick` được gọi.",
      },
    },
  },
  args: {
    variant: "default",
    children: "Click Me",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /click me/i });
    await expect(button).toBeInTheDocument();
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
