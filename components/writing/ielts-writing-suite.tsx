"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { WritingPrompt, WritingSubmissionPayload, WritingDraft } from "./types";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { WritingPromptHeader } from "./writing-prompt-header";
import { WritingScratchpad } from "./writing-scratchpad";
import { WritingStatsBar } from "./writing-stats-bar";
import { useWritingDraft } from "./use-writing-draft";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IeltsWritingSuiteProps {
  prompt: WritingPrompt;
  userId?: string;
  submissionId?: string;
  isMockTest?: boolean;
  timeLimitMinutes?: number;
  initialDraft?: WritingDraft;
  isSubmitting?: boolean;
  onSubmit: (submission: WritingSubmissionPayload) => void;
  className?: string;
}

export function IeltsWritingSuite({
  prompt,
  userId = "anonymous_student",
  submissionId = "draft_session",
  isMockTest = false,
  timeLimitMinutes = prompt.timeLimitMinutes ||
    (prompt.taskType === "TASK_2" ? 40 : 20),
  initialDraft,
  isSubmitting = false,
  onSubmit,
  className,
}: IeltsWritingSuiteProps) {
  const minWords =
    prompt.minWords || (prompt.taskType === "TASK_2" ? 250 : 150);
  const targetWordsMax =
    prompt.targetWordsMax || (prompt.taskType === "TASK_2" ? 350 : 220);

  const storageKey = `ielts_writing_draft_${userId}_${submissionId}_${prompt.id}`;
  const { saveStatus, lastSaved, restoredDraft, saveDraft, clearDraft } =
    useWritingDraft({
      storageKey,
      initialDraft,
    });

  // State initialized from restored draft or empty
  const [contentHtml, setContentHtml] = useState(
    () => restoredDraft?.contentHtml || ""
  );
  const [contentText, setContentText] = useState(
    () => restoredDraft?.contentText || ""
  );
  const [scratchpadHtml, setScratchpadHtml] = useState(
    () => restoredDraft?.scratchpadHtml || ""
  );
  const [scratchpadText, setScratchpadText] = useState(
    () => restoredDraft?.scratchpadText || ""
  );

  const [wordCount, setWordCount] = useState(
    () => restoredDraft?.wordCount || 0
  );
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pasteAttemptBlocked, setPasteAttemptBlocked] = useState(false);
  const [showUnderlengthWarningDialog, setShowUnderlengthWarningDialog] =
    useState(false);

  // Timer
  const [secondsRemaining, setSecondsRemaining] = useState(
    restoredDraft?.secondsRemaining !== undefined
      ? restoredDraft.secondsRemaining
      : timeLimitMinutes * 60
  );
  const [isTimerRunning, setIsTimerRunning] = useState(isMockTest);
  const [isTimeUp, setIsTimeUp] = useState(false);

  // Calculate Paragraphs and Sentences Count
  const textAnalytics = useMemo(() => {
    if (!contentText.trim()) {
      return { paragraphCount: 0, sentenceCount: 0 };
    }
    const paragraphs = contentText
      .split(/\n+/)
      .filter((p) => p.trim().length > 0);
    const sentences = contentText
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    return {
      paragraphCount: Math.max(1, paragraphs.length),
      sentenceCount: sentences.length,
    };
  }, [contentText]);

  // Fullscreen helper
  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => setIsFullscreen(false));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // Submit Handler logic
  const executeSubmission = useCallback(() => {
    const duration = timeLimitMinutes * 60 - secondsRemaining;
    const payload: WritingSubmissionPayload = {
      promptId: prompt.id,
      taskType: prompt.taskType,
      plainText: contentText,
      wordCount,
      durationSeconds: Math.max(1, duration),
      scratchpadText: scratchpadText || undefined,
      submittedAt: new Date().toISOString(),
    };
    clearDraft();
    onSubmit(payload);
  }, [
    prompt,
    contentText,
    wordCount,
    timeLimitMinutes,
    secondsRemaining,
    scratchpadText,
    clearDraft,
    onSubmit,
  ]);

  const handleSubmitRequest = () => {
    if (wordCount < minWords) {
      setShowUnderlengthWarningDialog(true);
    } else {
      executeSubmission();
    }
  };

  // Timer Tick
  useEffect(() => {
    if (!isTimerRunning || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimerRunning(false);
          setIsTimeUp(true);
          // Auto submit on time expiry
          executeSubmission();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining, executeSubmission]);

  // Handle Main Editor Content Changes
  const handleEditorChange = (change: {
    html: string;
    text: string;
    wordCount: number;
  }) => {
    setContentHtml(change.html);
    setContentText(change.text);
    setWordCount(change.wordCount);

    saveDraft({
      contentHtml: change.html,
      contentText: change.text,
      wordCount: change.wordCount,
      scratchpadHtml,
      scratchpadText,
      secondsRemaining: isMockTest ? secondsRemaining : undefined,
    });
  };

  // Handle Scratchpad Content Changes
  const handleScratchpadChange = (res: { html: string; text: string }) => {
    setScratchpadHtml(res.html);
    setScratchpadText(res.text);

    saveDraft({
      contentHtml,
      contentText,
      wordCount,
      scratchpadHtml: res.html,
      scratchpadText: res.text,
      secondsRemaining: isMockTest ? secondsRemaining : undefined,
    });
  };

  const handlePasteBlocked = () => {
    setPasteAttemptBlocked(true);
    setTimeout(() => setPasteAttemptBlocked(false), 3500);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 w-full max-w-5xl mx-auto relative",
        isFullscreen &&
          "fixed inset-0 z-50 max-w-none p-6 bg-background overflow-y-auto",
        className
      )}
      data-testid="ielts-writing-suite"
    >
      {/* Collapsible Sticky Header with Prompt and Timer */}
      <WritingPromptHeader
        prompt={prompt}
        isMockTest={isMockTest}
        secondsRemaining={isMockTest ? secondsRemaining : undefined}
        isFullscreen={isFullscreen}
        isScratchpadOpen={isScratchpadOpen}
        hasScratchpadNotes={!!scratchpadText.trim()}
        onToggleFullscreen={toggleFullscreen}
        onToggleScratchpad={() => setIsScratchpadOpen(!isScratchpadOpen)}
      />

      {/* Paste Blocked Warning Banner */}
      {pasteAttemptBlocked && (
        <div
          className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3.5 text-sm text-destructive font-medium shadow-sm animate-in fade-in slide-in-from-top-2"
          data-testid="paste-blocked-banner"
        >
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>
            Tính năng Copy-Paste bị vô hiệu hóa trong chế độ Thi thử (Strict
            Exam Mode) để đảm bảo tính trung thực.
          </span>
        </div>
      )}

      {/* Time Expired Alert Banner */}
      {isTimeUp && (
        <div
          className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-3.5 text-sm text-destructive font-medium shadow-sm animate-in fade-in"
          data-testid="time-up-banner"
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>
            Thời gian làm bài đã kết thúc! Hệ thống đã khóa bài viết và tiến
            hành nộp bài tự động.
          </span>
        </div>
      )}

      {/* Main Tiptap Writing Editor */}
      <div className="relative">
        <TiptapEditor
          content={contentHtml}
          placeholder={
            isMockTest
              ? "Exam Mode: Hãy viết bài luận IELTS của bạn tại đây. Tính năng paste và menu định dạng bị tắt theo chuẩn thi máy..."
              : "Bắt đầu viết bài luận IELTS của bạn tại đây..."
          }
          editable={!isTimeUp}
          enableBubbleMenu={!isMockTest}
          isMockTest={isMockTest}
          minHeight="min-h-[440px]"
          onChange={handleEditorChange}
          onPasteBlocked={handlePasteBlocked}
          data-testid="main-writing-editor"
        />
      </div>

      {/* Bottom Floating/Sticky Stats & Submit Bar */}
      <WritingStatsBar
        taskType={prompt.taskType}
        wordCount={wordCount}
        paragraphCount={textAnalytics.paragraphCount}
        sentenceCount={textAnalytics.sentenceCount}
        minWords={minWords}
        targetWordsMax={targetWordsMax}
        saveStatus={saveStatus}
        lastSaved={lastSaved}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmitRequest}
      />

      {/* Outline Scratchpad Side Drawer */}
      <WritingScratchpad
        isOpen={isScratchpadOpen}
        content={scratchpadHtml}
        onClose={() => setIsScratchpadOpen(false)}
        onChange={handleScratchpadChange}
      />

      {/* Underlength Confirmation Dialog */}
      <Dialog
        open={showUnderlengthWarningDialog}
        onOpenChange={setShowUnderlengthWarningDialog}
      >
        <DialogContent className="sm:max-w-md" data-testid="underlength-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Cảnh Báo Số Từ Chưa Đạt Chuẩn
            </DialogTitle>
            <DialogDescription className="text-sm pt-2">
              Bài viết của bạn hiện có <strong>{wordCount} từ</strong>, chưa đạt
              mốc tối thiểu quy định là <strong>{minWords} từ</strong> cho{" "}
              {prompt.taskType === "TASK_2" ? "Task 2" : "Task 1"}. Trong bài
              thi thực tế, việc viết dưới số từ quy định sẽ bị trừ điểm tiêu chí
              Task Achievement / Task Response.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowUnderlengthWarningDialog(false)}
              data-testid="cancel-underlength-submit-btn"
            >
              Tiếp tục viết thêm
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowUnderlengthWarningDialog(false);
                executeSubmission();
              }}
              data-testid="confirm-underlength-submit-btn"
            >
              Vẫn nộp bài
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
