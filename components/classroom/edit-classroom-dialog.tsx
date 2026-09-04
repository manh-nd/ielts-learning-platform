"use client";

import * as React from "react";
import { PencilIcon, Loader2Icon, SchoolIcon } from "lucide-react";
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

export interface EditClassroomDialogProps {
  classroom: {
    id: string;
    name: string;
    description?: string | null;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description?: string | null;
  }) => Promise<void>;
  isSubmitting?: boolean;
  trigger?: React.ReactNode;
}

export function EditClassroomDialog({
  classroom,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  trigger,
}: EditClassroomDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [name, setName] = React.useState(classroom.name);
  const [description, setDescription] = React.useState(
    classroom.description || ""
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [prevClassroom, setPrevClassroom] = React.useState(classroom);
  if (
    prevClassroom.name !== classroom.name ||
    prevClassroom.description !== classroom.description
  ) {
    setPrevClassroom(classroom);
    setName(classroom.name);
    setDescription(classroom.description || "");
  }

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form to current classroom data on close
      setName(classroom.name);
      setDescription(classroom.description || "");
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
        description: description.trim() || null,
      });
      handleOpenChange(false);
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message ||
          "Không thể cập nhật lớp học. Vui lòng thử lại."
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
              data-testid="edit-classroom-trigger"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
            >
              <PencilIcon className="size-3.5" />
              <span>Sửa thông tin</span>
            </Button>
          }
        />
      )}

      <DialogContent
        data-testid="edit-classroom-dialog"
        className="sm:max-w-md"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SchoolIcon className="size-4" />
            </div>
            <DialogTitle
              data-testid="edit-classroom-title"
              className="text-base font-semibold"
            >
              Chỉnh sửa thông tin lớp học
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Cập nhật tên lớp học và ghi chú mô tả hiển thị cho học viên.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-2 text-xs">
            <AlertDescription data-testid="edit-classroom-error">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        <form
          id="edit-classroom-form"
          onSubmit={handleSubmit}
          className="space-y-4 py-2"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="edit-classroom-name"
              className="text-xs font-medium text-foreground"
            >
              Tên lớp học <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-classroom-name"
              data-testid="edit-classroom-name-input"
              placeholder="VD: IELTS Speaking Intensive K24"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              maxLength={255}
              disabled={isSubmitting}
              required
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="edit-classroom-description"
              className="text-xs font-medium text-foreground"
            >
              Mô tả / Ghi chú khóa học
            </Label>
            <Textarea
              id="edit-classroom-description"
              data-testid="edit-classroom-desc-input"
              placeholder="VD: Lớp luyện đề buổi tối 2-4-6 từ 19:30 - 21:00..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              disabled={isSubmitting}
              rows={3}
              className="text-xs resize-none"
            />
          </div>
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                className="text-xs"
              >
                Hủy
              </Button>
            }
          />
          <Button
            type="submit"
            form="edit-classroom-form"
            data-testid="edit-classroom-submit-button"
            variant="default"
            size="sm"
            disabled={isSubmitting || !name.trim()}
            className="gap-1.5 text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>Lưu thay đổi</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
