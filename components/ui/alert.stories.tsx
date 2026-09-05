import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Alert, AlertTitle, AlertDescription } from "./alert";
import {
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const meta: Meta<typeof Alert> = {
  title: "Design System/Primitives/Alert",
  component: Alert,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thành phần Alert hiển thị các thông báo, lưu ý, cảnh báo và lỗi hệ thống dựa trên semantic color tokens.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "warning", "info", "success"],
      description: "Biến thể giao diện thị giác của Alert",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-lg space-y-4">
      <Alert variant="default" data-testid="alert-default">
        <Info className="size-4" />
        <AlertTitle>Thông báo chung</AlertTitle>
        <AlertDescription>
          Hệ thống sẽ tự động sao lưu bản nháp bài viết mỗi 30 giây.
        </AlertDescription>
      </Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("Thông báo chung");
    await expect(title).toBeInTheDocument();
  },
};

export const Destructive: Story = {
  render: () => (
    <div className="w-full max-w-lg space-y-4">
      <Alert variant="destructive" data-testid="alert-destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Lỗi kết nối âm thanh</AlertTitle>
        <AlertDescription>
          Không tìm thấy micro khả dụng. Vui lòng cấp quyền truy cập trình
          duyệt.
        </AlertDescription>
      </Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("Lỗi kết nối âm thanh");
    await expect(title).toBeInTheDocument();
  },
};

export const Warning: Story = {
  render: () => (
    <div className="w-full max-w-lg space-y-4">
      <Alert variant="warning" data-testid="alert-warning">
        <AlertTriangle className="size-4" />
        <AlertTitle>Cảnh báo thời gian làm bài</AlertTitle>
        <AlertDescription>
          Bạn còn 5 phút để hoàn thành bài thi IELTS Writing Task 2.
        </AlertDescription>
      </Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("Cảnh báo thời gian làm bài");
    await expect(title).toBeInTheDocument();
  },
};

export const InfoVariant: Story = {
  render: () => (
    <div className="w-full max-w-lg space-y-4">
      <Alert variant="info" data-testid="alert-info">
        <Sparkles className="size-4" />
        <AlertTitle>Gợi ý từ AI Examiner</AlertTitle>
        <AlertDescription>
          Nên sử dụng thêm các từ nối học thuật (Furthermore, In contrast) để
          tăng điểm Coherence & Cohesion.
        </AlertDescription>
      </Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("Gợi ý từ AI Examiner");
    await expect(title).toBeInTheDocument();
  },
};

export const Success: Story = {
  render: () => (
    <div className="w-full max-w-lg space-y-4">
      <Alert variant="success" data-testid="alert-success">
        <CheckCircle2 className="size-4" />
        <AlertTitle>Đã nộp bài thành công</AlertTitle>
        <AlertDescription>
          Bài làm của bạn đã được gửi cho giáo viên và AI để chấm điểm chi tiết.
        </AlertDescription>
      </Alert>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("Đã nộp bài thành công");
    await expect(title).toBeInTheDocument();
  },
};
