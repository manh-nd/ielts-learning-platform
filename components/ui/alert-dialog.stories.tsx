import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, fn } from "storybook/test";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "./alert-dialog";
import { Button } from "./button";

const meta: Meta<typeof AlertDialog> = {
  title: "Design System/Primitives/AlertDialog",
  component: AlertDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thành phần AlertDialog chuẩn của shadcn/ui tích hợp `@base-ui/react/alert-dialog`. Dùng cho các tác vụ quan trọng mang tính phá hủy hoặc hủy tư cách thành viên cần người dùng xác nhận.",
      },
    },
    a11y: { test: "error" },
  },
};

export default meta;
type Story = StoryObj<typeof AlertDialog>;

export const Default: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        Hiển thị cảnh báo
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bạn có chắc chắn không?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này không thể hoàn tác. Dữ liệu sẽ được cập nhật ngay lập
            tức trên hệ thống.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction>Tiếp tục</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const DestructiveAction: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Xóa học viên
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa học viên khỏi lớp học</AlertDialogTitle>
          <AlertDialogDescription>
            Bạn có chắc chắn muốn xóa học viên <strong>Nguyễn Văn A</strong>{" "}
            (student@example.com) khỏi lớp học này? Hành động này sẽ hủy tư cách
            thành viên nhưng vẫn giữ nguyên tài khoản và lịch sử bài nộp của học
            viên.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction variant="destructive">
            Xác nhận xóa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const ConfirmInteraction: Story = {
  render: () => {
    const onConfirm = fn();
    return (
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="destructive"
              data-testid="alert-dialog-open-trigger"
            />
          }
        >
          Xóa thành viên
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="alert-dialog-popup">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="alert-dialog-title">
              Xác nhận xóa
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="alert-dialog-description">
              Học viên sẽ bị xóa khỏi danh sách lớp học.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="alert-dialog-cancel-btn">
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="alert-dialog-confirm-btn"
              onClick={onConfirm}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByTestId("alert-dialog-open-trigger");
    await expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    const title = await within(document.body).findByTestId(
      "alert-dialog-title"
    );
    await expect(title).toBeInTheDocument();

    const cancelBtn = within(document.body).getByTestId(
      "alert-dialog-cancel-btn"
    );
    await expect(cancelBtn).toBeInTheDocument();

    const confirmBtn = within(document.body).getByTestId(
      "alert-dialog-confirm-btn"
    );
    await userEvent.click(confirmBtn);
  },
};
