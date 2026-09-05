import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";
import { Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

const meta: Meta<typeof Badge> = {
  title: "Design System/Primitives/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thành phần Badge hiển thị nhãn trạng thái (AI Evaluated, Approved, Underlength), điểm số Band và các cảnh báo tiêu chí lỗi trong bài thi IELTS.",
      },
    },
  },
  args: {
    children: "Badge",
  },
  argTypes: {
    variant: {
      description: "Màu sắc & phong cách hiển thị của badge",
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "outline",
        "ghost",
        "link",
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    variant: "default",
    children: "Task 2 Essay",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Band 7.5",
  },
};

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Grammar Error",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Underlength Warning",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Draft",
  },
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">
        <Sparkles className="size-2.5" />
        AI Evaluated
      </Badge>
      <Badge variant="secondary">
        <CheckCircle2 className="size-2.5 text-emerald-500" />
        Approved by Teacher
      </Badge>
      <Badge variant="destructive">
        <AlertTriangle className="size-2.5" />
        Lexical Issue
      </Badge>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="link">Link</Badge>
    </div>
  ),
};
