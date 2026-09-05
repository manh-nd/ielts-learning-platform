"use client";

import * as React from "react";
import { PlusIcon, BookOpenIcon } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HomeworkAssignmentCreationForm } from "./homework-assignment-creation-form";
import type { CreateHomeworkAssignmentInput } from "@/modules/homework/application/homework-inputs";

export interface HomeworkAssignmentCreationDialogProps {
  classroomName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (data: CreateHomeworkAssignmentInput) => Promise<void>;
  isSubmitting?: boolean;
  trigger?: React.ReactElement;
}

export function HomeworkAssignmentCreationDialog({
  classroomName,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  trigger,
}: HomeworkAssignmentCreationDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  const handleSubmit = async (data: CreateHomeworkAssignmentInput) => {
    await onSubmit(data);
    handleOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button
              size="sm"
              data-testid="create-assignment-trigger-button"
              className="text-xs gap-1.5 bg-primary text-primary-foreground"
            >
              <PlusIcon className="size-3.5" />
              <span>Giao bài tập mới</span>
            </Button>
          }
        />
      )}

      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <BookOpenIcon className="size-5 text-primary" />
            <span>Tạo & Giao Bài tập Speaking Discrete</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {classroomName
              ? `Tạo bài tập gồm 1–3 câu hỏi Speaking và giao cho lớp "${classroomName}".`
              : "Tạo bài tập gồm 1–3 câu hỏi Speaking và đặt thời hạn nộp bài."}
          </DialogDescription>
        </DialogHeader>

        <HomeworkAssignmentCreationForm
          isSubmitting={isSubmitting}
          onCancel={() => handleOpenChange(false)}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
