"use client";

import * as React from "react";
import { PlusIcon, Loader2Icon, SchoolIcon } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface CreateClassroomDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  isSubmitting?: boolean;
  trigger?: React.ReactNode;
}

export function CreateClassroomDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  trigger,
}: CreateClassroomDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form on close
      setName("");
      setDescription("");
      setErrorMessage(null);
    }
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Vui lòng nhập tên lớp học.");
      return;
    }

    if (trimmedName.length > 255) {
      setErrorMessage("Tên lớp học không được vượt quá 255 ký tự.");
      return;
    }

    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      handleOpenChange(false);
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message || "Không thể tạo lớp học. Vui lòng thử lại."
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger
          render={
            React.isValidElement(trigger) ? (
              trigger
            ) : (
              <button type="button">{trigger}</button>
            )
          }
        />
      ) : (
        <DialogTrigger
          render={
            <Button
              data-testid="create-classroom-trigger"
              variant="default"
              size="sm"
              className="gap-1.5 shadow-sm"
            >
              <PlusIcon className="size-4" />
              <span>Tạo lớp học mới</span>
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary">
              <SchoolIcon className="size-5" />
              <DialogTitle data-testid="create-classroom-title">
                Tạo Lớp học Mới
              </DialogTitle>
            </div>
            <DialogDescription>
              Tạo không gian lớp học để quản lý danh sách học viên và phân phối
              bài tập Speaking & Writing.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertDescription data-testid="create-classroom-error">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="classroom-name" className="text-xs font-semibold">
                Tên lớp học <span className="text-destructive">*</span>
              </Label>
              <Input
                id="classroom-name"
                data-testid="create-classroom-name-input"
                placeholder="Ví dụ: IELTS Speaking Intensive K24"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                maxLength={255}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="classroom-description"
                className="text-xs font-semibold"
              >
                Mô tả / Ghi chú{" "}
                <span className="text-muted-foreground font-normal">
                  (tùy chọn)
                </span>
              </Label>
              <Textarea
                id="classroom-description"
                data-testid="create-classroom-desc-input"
                placeholder="Mô tả mục tiêu band điểm, lịch học hoặc yêu cầu lớp học..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                >
                  Hủy
                </Button>
              }
            />
            <Button
              type="submit"
              data-testid="create-classroom-submit-button"
              variant="default"
              size="sm"
              disabled={isSubmitting || !name.trim()}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  <span>Đang tạo...</span>
                </>
              ) : (
                <span>Tạo lớp học</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
