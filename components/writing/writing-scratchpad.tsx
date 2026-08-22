"use client";

import React, { useState } from "react";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Info, NotebookPen, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WritingScratchpadProps {
  isOpen: boolean;
  content?: string;
  onClose: () => void;
  onChange?: (content: {
    html: string;
    text: string;
    wordCount: number;
  }) => void;
  className?: string;
}

export function WritingScratchpad({
  isOpen,
  content = "",
  onClose,
  onChange,
  className,
}: WritingScratchpadProps) {
  const [copied, setCopied] = useState(false);
  const [currentText, setCurrentText] = useState("");

  if (!isOpen) return null;

  const handleCopyOutline = async () => {
    if (!currentText && !content) return;
    try {
      await navigator.clipboard.writeText(currentText || content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy outline to clipboard:", err);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-200",
        className
      )}
      data-testid="writing-scratchpad-drawer"
    >
      {/* Scratchpad Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base text-foreground">
            Outline Scratchpad
          </h3>
          <Badge variant="secondary" className="text-xs px-2 py-0.5">
            Nháp riêng
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyOutline}
            className="h-8 gap-1.5 text-xs"
            title="Copy outline to clipboard"
            data-testid="copy-scratchpad-btn"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Đã sao chép</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Sao chép</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            data-testid="close-scratchpad-btn"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info Tip Banner */}
      <div className="p-4 bg-muted/30 border-b flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p>
          Phác thảo dàn bài, luận điểm hoặc từ vựng cần dùng tại đây. Nội dung
          này được tự động lưu nháp và <strong>không bị tính</strong> vào số từ
          chính thức của bài nộp.
        </p>
      </div>

      {/* Independent Tiptap Editor for Scratchpad */}
      <div className="flex-1 p-4 overflow-y-auto">
        <TiptapEditor
          content={content}
          placeholder="Ví dụ dàn ý:&#10;• Introduction: Paraphrase question & thesis statement&#10;• Body 1: Main trend / Argument 1 with details&#10;• Body 2: Secondary trend / Argument 2 with examples&#10;• Conclusion: Summary of key findings..."
          isMockTest={false}
          minHeight="min-h-[420px]"
          editorClassName="p-4 text-sm"
          onChange={(res) => {
            setCurrentText(res.text);
            onChange?.(res);
          }}
          data-testid="scratchpad-tiptap-editor"
        />
      </div>
    </div>
  );
}
