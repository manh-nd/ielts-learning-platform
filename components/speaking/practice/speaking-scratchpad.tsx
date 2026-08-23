"use client";

import React from "react";
import { PenLine, ListPlus, Trash2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export interface SpeakingScratchpadProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  isPrepPhase?: boolean;
}

export function SpeakingScratchpad({
  value,
  onChange,
  disabled = false,
  className,
  isPrepPhase = false,
}: SpeakingScratchpadProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  const handleAddBullet = () => {
    if (disabled) return;
    const bullet = "• ";
    const newValue =
      value.length > 0 && !value.endsWith("\n")
        ? `${value}\n${bullet}`
        : `${value}${bullet}`;
    onChange(newValue);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleClear = () => {
    if (disabled) return;
    onChange("");
    textareaRef.current?.focus();
  };

  return (
    <Card
      data-testid="speaking-scratchpad"
      className={cn(
        "border shadow-sm bg-card transition-all flex flex-col p-0 py-0 gap-0 overflow-hidden",
        isPrepPhase && "ring-2 ring-primary/40 border-primary/40",
        className
      )}
    >
      <CardHeader className="px-5 py-3.5 [.border-b]:pb-3.5 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <PenLine className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-xs font-bold text-foreground">
              Scratchpad (Giấy nháp điện tử)
            </CardTitle>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="text-[10px] h-5 font-mono px-1.5 bg-background"
          >
            {wordCount} {wordCount === 1 ? "từ" : "từ"}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddBullet}
            disabled={disabled}
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Thêm gạch đầu dòng"
            data-testid="scratchpad-bullet-btn"
          >
            <ListPlus className="w-3.5 h-3.5 mr-1" />
            Bullet
          </Button>
          {value.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled}
              className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
              title="Xóa nháp"
              data-testid="scratchpad-clear-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 flex-1 flex flex-col min-h-[160px]">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={
            isPrepPhase
              ? "Ghi chú nhanh các ý chính cho 4 câu hỏi gợi ý...\nVí dụ:\n• Where: Da Nang beach (summer 2024)\n• Why: Family reunion & relaxation\n• What: Surfing, local seafood, night market\n• Feeling: Unforgettable, peaceful vibe"
              : "Ghi chú của bạn sẽ hiển thị tại đây trong lúc nói..."
          }
          className="flex-1 w-full resize-none font-mono text-xs leading-relaxed border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none"
          data-testid="scratchpad-textarea"
        />
        <div className="pt-3 border-t mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Ghi chú tự động lưu và gửi kèm bài chấm của bạn
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
