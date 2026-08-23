"use client";

import React, { useState } from "react";
import { WritingPrompt } from "./types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Maximize2,
  Minimize2,
  NotebookPen,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface WritingPromptHeaderProps {
  prompt: WritingPrompt;
  isMockTest?: boolean;
  secondsRemaining?: number;
  isFullscreen?: boolean;
  isScratchpadOpen?: boolean;
  hasScratchpadNotes?: boolean;
  onToggleFullscreen?: () => void;
  onToggleScratchpad?: () => void;
  className?: string;
}

export function WritingPromptHeader({
  prompt,
  isMockTest = false,
  secondsRemaining,
  isFullscreen = false,
  isScratchpadOpen = false,
  hasScratchpadNotes = false,
  onToggleFullscreen,
  onToggleScratchpad,
  className,
}: WritingPromptHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getTaskLabel = () => {
    switch (prompt.taskType) {
      case "TASK_1_ACADEMIC":
        return "IELTS Writing Task 1 (Academic Report)";
      case "TASK_1_GENERAL":
        return "IELTS Writing Task 1 (General Letter)";
      case "TASK_2":
        return "IELTS Writing Task 2 (Essay)";
      default:
        return "IELTS Writing";
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200",
        className
      )}
      data-testid="writing-prompt-header"
    >
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b bg-muted/20">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20 font-semibold px-2.5 py-1"
            data-testid="task-type-badge"
          >
            {getTaskLabel()}
          </Badge>

          {isMockTest && (
            <Badge
              variant="destructive"
              className="gap-1 px-2.5 py-1 font-medium shadow-sm animate-in fade-in"
              data-testid="exam-mode-badge"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Strict Exam Mode
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Countdown Timer */}
          {secondsRemaining !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-sm font-semibold border transition-colors",
                secondsRemaining < 300
                  ? "bg-destructive/10 text-destructive border-destructive/30 animate-pulse"
                  : "bg-muted text-foreground border-border"
              )}
              data-testid="countdown-timer"
            >
              <Clock className="h-4 w-4" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>
          )}

          {/* Scratchpad Toggle Button */}
          {onToggleScratchpad && (
            <Button
              variant={isScratchpadOpen ? "secondary" : "outline"}
              size="sm"
              onClick={onToggleScratchpad}
              className={cn(
                "gap-1.5 h-8 text-xs font-medium relative",
                isScratchpadOpen &&
                  "border-primary/40 bg-primary/10 text-primary"
              )}
              title="Toggle Outline Scratchpad"
              data-testid="toggle-scratchpad-btn"
            >
              <NotebookPen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Outline Notes</span>
              {hasScratchpadNotes && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary" />
              )}
            </Button>
          )}

          {/* Fullscreen Zen Mode Button */}
          {onToggleFullscreen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleFullscreen}
              className="h-8 w-8 p-0"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Focus Mode"}
              data-testid="toggle-fullscreen-btn"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Collapse/Expand Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            data-testid="toggle-prompt-collapse-btn"
          >
            {isExpanded ? (
              <>
                <span className="hidden sm:inline">Thu gọn đề</span>
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Xem đề bài</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Prompt Body Section */}
      {isExpanded ? (
        <div
          className="p-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150"
          data-testid="prompt-body-expanded"
        >
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight mb-2">
              {prompt.title}
            </h2>
            <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {prompt.promptText}
            </div>
          </div>

          {/* Task 1 Chart/Diagram Image */}
          {prompt.imageUrl && (
            <div
              className="rounded-lg border bg-muted/30 p-2 overflow-hidden flex flex-col items-center max-w-2xl mx-auto"
              data-testid="prompt-image-container"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={prompt.imageUrl}
                alt={prompt.imageAlt || prompt.title}
                className="max-h-72 object-contain rounded-md"
              />
              {prompt.imageAlt && (
                <p className="text-xs text-muted-foreground mt-2 italic text-center">
                  {prompt.imageAlt}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors"
          onClick={() => setIsExpanded(true)}
          data-testid="prompt-body-collapsed"
        >
          <p className="text-sm font-medium text-foreground truncate pr-4">
            <span className="text-muted-foreground mr-1.5 font-normal">
              Đề bài:
            </span>
            {prompt.title}
          </p>
          <span className="text-xs text-primary font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Mở rộng
          </span>
        </div>
      )}
    </div>
  );
}
