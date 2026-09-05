import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Marker, MarkerContent, MarkerIcon } from "./marker";
import { Clock, Info, CheckCircle2 } from "lucide-react";

const meta: Meta<typeof Marker> = {
  title: "Product/Speaking/Marker",
  component: Marker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Marker primitive hiển thị các mốc thời gian, sự kiện hoặc đường phân cách trạng thái giữa các phần trong luồng hội thoại Speaking.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Marker>;

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-md p-4 bg-background border rounded-xl space-y-4">
      <Marker variant="default" data-testid="marker-default">
        <MarkerIcon>
          <Clock className="size-3.5" />
        </MarkerIcon>
        <MarkerContent>Bắt đầu IELTS Speaking Part 1 • 10:00 AM</MarkerContent>
      </Marker>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByText(/Bắt đầu IELTS Speaking Part 1/i);
    await expect(text).toBeInTheDocument();
  },
};

export const SeparatorVariant: Story = {
  render: () => (
    <div className="w-full max-w-md p-4 bg-background border rounded-xl space-y-4">
      <Marker variant="separator" data-testid="marker-separator">
        <MarkerIcon>
          <Info className="size-3.5 text-primary" />
        </MarkerIcon>
        <MarkerContent>
          Chuyển sang Part 2: Cue Card (1 phút chuẩn bị)
        </MarkerContent>
      </Marker>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByText(/Chuyển sang Part 2/i);
    await expect(text).toBeInTheDocument();
  },
};

export const BorderVariant: Story = {
  render: () => (
    <div className="w-full max-w-md p-4 bg-background border rounded-xl space-y-4">
      <Marker variant="border" data-testid="marker-border">
        <MarkerIcon>
          <CheckCircle2 className="size-3.5 text-emerald-600" />
        </MarkerIcon>
        <MarkerContent>
          Hoàn thành phiên thi nói • Bắt đầu chấm điểm AI
        </MarkerContent>
      </Marker>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByText(/Hoàn thành phiên thi nói/i);
    await expect(text).toBeInTheDocument();
  },
};
