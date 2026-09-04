"use client";

import * as React from "react";
import {
  PlusIcon,
  Trash2Icon,
  SparklesIcon,
  CalendarIcon,
  AlertCircleIcon,
  MicIcon,
  SendIcon,
  SaveIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PRESET_SPEAKING_PROMPTS } from "./homework-prompt-presets";
import type {
  CreateHomeworkAssignmentInput,
  HomeworkPromptItem,
} from "@/modules/homework/domain/homework-types";

export type FormPromptItem = HomeworkPromptItem;

export interface HomeworkAssignmentCreationFormProps {
  initialTitle?: string;
  initialInstructions?: string;
  initialPrompts?: FormPromptItem[];
  initialDeadline?: string; // ISO or YYYY-MM-DDTHH:mm
  className?: string;
  isSubmitting?: boolean;
  onCancel?: () => void;
  onSubmit: (data: CreateHomeworkAssignmentInput) => Promise<void> | void;
}

/**
 * Returns datetime string suitable for input type="datetime-local" (YYYY-MM-DDTHH:mm)
 */
function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function HomeworkAssignmentCreationForm({
  initialTitle = "",
  initialInstructions = "",
  initialPrompts,
  initialDeadline,
  className,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: HomeworkAssignmentCreationFormProps) {
  // Default deadline: 3 days from now at 23:59
  const defaultDeadline = React.useMemo(() => {
    if (initialDeadline) {
      return toLocalDatetimeString(new Date(initialDeadline));
    }
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 0, 0);
    return toLocalDatetimeString(d);
  }, [initialDeadline]);

  const [title, setTitle] = React.useState(initialTitle);
  const [instructions, setInstructions] = React.useState(initialInstructions);
  const [deadline, setDeadline] = React.useState(defaultDeadline);
  const [prompts, setPrompts] = React.useState<FormPromptItem[]>(
    initialPrompts && initialPrompts.length > 0
      ? initialPrompts
      : [
          {
            promptId: crypto.randomUUID(),
            text: PRESET_SPEAKING_PROMPTS[0].text,
            partNumber: 1,
          },
        ]
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Minimum selectable date string is right now
  const minDatetime = React.useMemo(() => {
    return toLocalDatetimeString(new Date());
  }, []);

  const handleAddPrompt = () => {
    if (prompts.length >= 3) return;
    const nextPart = prompts.length === 1 ? 2 : 3;
    const preset =
      PRESET_SPEAKING_PROMPTS.find((p) => p.partNumber === nextPart) ||
      PRESET_SPEAKING_PROMPTS[0];

    setPrompts((prev) => [
      ...prev,
      {
        promptId: crypto.randomUUID(),
        text: preset.text,
        partNumber: nextPart as 1 | 2 | 3,
        subPrompts: preset.subPrompts,
      },
    ]);
  };

  const handleRemovePrompt = (index: number) => {
    if (prompts.length <= 1) return;
    setPrompts((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePromptChange = (
    index: number,
    field: "text" | "partNumber",
    value: string | number
  ) => {
    setPrompts((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "partNumber") {
          return { ...p, partNumber: Number(value) as 1 | 2 | 3 };
        }
        return { ...p, text: String(value) };
      })
    );
  };

  const handleSelectPreset = (index: number, presetId: string) => {
    const preset = PRESET_SPEAKING_PROMPTS.find((p) => p.id === presetId);
    if (!preset) return;

    setPrompts((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              text: preset.text,
              partNumber: preset.partNumber,
              subPrompts: preset.subPrompts,
            }
          : p
      )
    );
  };

  const handleQuickDeadlineOffset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 0, 0);
    setDeadline(toLocalDatetimeString(d));
  };

  const validateAndSubmit = async (status: "draft" | "published") => {
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage("Vui lòng nhập tiêu đề bài tập.");
      return;
    }

    if (prompts.length < 1 || prompts.length > 3) {
      setErrorMessage(
        "Một bài tập Speaking phải có từ 1 đến 3 câu hỏi (prompts)."
      );
      return;
    }

    for (let i = 0; i < prompts.length; i++) {
      if (!prompts[i].text.trim()) {
        setErrorMessage(`Nội dung câu hỏi ${i + 1} không được để trống.`);
        return;
      }
    }

    const parsedDeadline = new Date(deadline);
    if (isNaN(parsedDeadline.getTime())) {
      setErrorMessage("Vui lòng chọn hạn nộp bài hợp lệ.");
      return;
    }

    if (parsedDeadline.getTime() <= Date.now()) {
      setErrorMessage("Hạn nộp bài phải là một mốc thời gian trong tương lai.");
      return;
    }

    try {
      await onSubmit({
        title: trimmedTitle,
        instructions: instructions.trim() || null,
        prompts: prompts.map((p) => ({
          promptId: p.promptId,
          text: p.text.trim(),
          partNumber: p.partNumber,
          subPrompts: p.subPrompts,
        })),
        submissionDeadline: parsedDeadline,
        status,
      });
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message || "Đã xảy ra lỗi khi tạo bài tập."
      );
    }
  };

  return (
    <form
      data-testid="homework-assignment-creation-form"
      onSubmit={(e) => {
        e.preventDefault();
        void validateAndSubmit("published");
      }}
      className={cn("flex flex-col gap-4", className)}
    >
      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircleIcon className="size-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Assignment Title */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="assignment-title"
          className="text-xs font-semibold text-foreground flex items-center justify-between"
        >
          <span>Tiêu đề bài tập Speaking *</span>
          <span className="text-[10px] text-muted-foreground font-normal">
            {title.length}/255
          </span>
        </label>
        <Input
          id="assignment-title"
          data-testid="assignment-title-input"
          placeholder="Ví dụ: Luyện tập Speaking Part 1 & 2 - Chủ đề Hometown & Journey"
          value={title}
          maxLength={255}
          disabled={isSubmitting}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Instructions */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="assignment-instructions"
          className="text-xs font-semibold text-foreground"
        >
          Hướng dẫn làm bài (tùy chọn)
        </label>
        <Textarea
          id="assignment-instructions"
          data-testid="assignment-instructions-input"
          placeholder="Lưu ý về phát âm, thời lượng trả lời tối thiểu, ngữ điệu tự nhiên..."
          rows={2}
          value={instructions}
          disabled={isSubmitting}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      {/* Prompts Builder (1 to 3 prompts) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <MicIcon className="size-4 text-primary" />
            <h3 className="text-xs font-semibold text-foreground">
              Câu hỏi Speaking (1–3 câu)
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono py-0">
              {prompts.length}/3
            </Badge>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="add-prompt-button"
            disabled={prompts.length >= 3 || isSubmitting}
            onClick={handleAddPrompt}
            className="h-7 text-xs gap-1"
          >
            <PlusIcon className="size-3" />
            <span>Thêm câu hỏi</span>
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {prompts.map((prompt, index) => (
            <div
              key={prompt.promptId}
              data-testid={`prompt-item-${index}`}
              className="rounded-lg border border-border/70 bg-card/60 p-3 flex flex-col gap-3 shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                    {index + 1}
                  </span>

                  {/* Part Selector */}
                  <Select
                    value={String(prompt.partNumber)}
                    onValueChange={(val) => {
                      if (val) handlePromptChange(index, "partNumber", val);
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      data-testid={`prompt-part-select-${index}`}
                      className="h-7 w-28 text-xs font-medium"
                    >
                      <SelectValue placeholder="Chọn Part" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Part 1 (Short)</SelectItem>
                      <SelectItem value="2">Part 2 (Cue Card)</SelectItem>
                      <SelectItem value="3">Part 3 (Discussion)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Preset prompt picker */}
                  <Select
                    onValueChange={(val) => {
                      if (val) handleSelectPreset(index, String(val));
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      data-testid={`prompt-preset-select-${index}`}
                      className="h-7 max-w-[200px] text-[11px] text-muted-foreground"
                    >
                      <SparklesIcon className="size-3 text-amber-500 mr-1" />
                      <span>Đề thi mẫu gợi ý</span>
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_SPEAKING_PROMPTS.filter(
                        (p) => p.partNumber === prompt.partNumber
                      ).map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.category}: {preset.text.slice(0, 38)}...
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Remove Prompt Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-testid={`remove-prompt-button-${index}`}
                  disabled={prompts.length <= 1 || isSubmitting}
                  onClick={() => handleRemovePrompt(index)}
                  className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title={
                    prompts.length <= 1
                      ? "Bài tập phải có ít nhất 1 câu hỏi"
                      : "Xóa câu hỏi"
                  }
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>

              {/* Prompt Text Input */}
              <div className="flex flex-col gap-1">
                <Textarea
                  data-testid={`prompt-text-input-${index}`}
                  placeholder="Nhập nội dung đề bài Speaking..."
                  rows={2}
                  value={prompt.text}
                  disabled={isSubmitting}
                  onChange={(e) =>
                    handlePromptChange(index, "text", e.target.value)
                  }
                  className="text-xs"
                />

                {prompt.partNumber === 2 && prompt.subPrompts && (
                  <div className="mt-1 rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                    <p className="font-semibold text-foreground/80 mb-1">
                      Gợi ý Cue Card (You should say):
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {prompt.subPrompts.map((sub, sIdx) => (
                        <li key={sIdx}>{sub}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submission Deadline */}
      <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
        <label
          htmlFor="assignment-deadline"
          className="text-xs font-semibold text-foreground flex items-center gap-1.5"
        >
          <CalendarIcon className="size-3.5 text-primary" />
          <span>Hạn nộp bài (Submission Deadline) *</span>
        </label>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Input
            id="assignment-deadline"
            data-testid="assignment-deadline-input"
            type="datetime-local"
            min={minDatetime}
            value={deadline}
            disabled={isSubmitting}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full sm:w-60 text-xs"
          />

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleQuickDeadlineOffset(3)}
              className="h-8 text-[11px] px-2"
            >
              +3 ngày
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleQuickDeadlineOffset(7)}
              className="h-8 text-[11px] px-2"
            >
              +1 tuần
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleQuickDeadlineOffset(14)}
              className="h-8 text-[11px] px-2"
            >
              +2 tuần
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Thời hạn nộp bài chính thức: Sau mốc thời gian này, học viên không thể
          nộp hoặc làm lại bài tập (trừ khi giáo viên chủ động gia hạn hạn nộp).
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            onClick={onCancel}
            className="text-xs"
          >
            Hủy bỏ
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="save-draft-button"
          disabled={isSubmitting}
          onClick={() => void validateAndSubmit("draft")}
          className="text-xs gap-1.5"
        >
          <SaveIcon className="size-3.5" />
          <span>Lưu bản nháp</span>
        </Button>

        <Button
          type="submit"
          size="sm"
          data-testid="publish-assignment-button"
          disabled={isSubmitting}
          className="text-xs gap-1.5 bg-primary text-primary-foreground"
        >
          <SendIcon className="size-3.5" />
          <span>{isSubmitting ? "Đang xử lý..." : "Giao bài ngay"}</span>
        </Button>
      </div>
    </form>
  );
}
