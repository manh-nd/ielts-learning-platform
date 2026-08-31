"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Bot, Play, Copy, Check, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InteractiveTranscriptItem {
  id?: string;
  sender: "user" | "examiner" | "candidate" | string;
  text: string;
  timestamp?: number;
  isFinal?: boolean;
}

export interface LiveInteractiveTranscriptProps {
  transcripts: InteractiveTranscriptItem[];
  currentTimeSeconds?: number;
  onSeekToTime?: (seconds: number) => void;
  candidateName?: string;
  className?: string;
}

export function formatTranscriptTimestamp(msOrSec: number): string {
  // If timestamp > 3600, it's likely epoch ms or ms offset
  let totalSeconds = msOrSec;
  if (msOrSec > 3600) {
    totalSeconds = Math.round(msOrSec / 1000);
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function LiveInteractiveTranscript({
  transcripts = [],
  currentTimeSeconds = 0,
  onSeekToTime,
  candidateName = "Bạn (Candidate)",
  className,
}: LiveInteractiveTranscriptProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(() => {
    if (transcripts.length === 0) return;
    const text = transcripts
      .map((t) => {
        const role =
          t.sender === "user" || t.sender === "candidate"
            ? "Candidate"
            : "Examiner";
        const time =
          t.timestamp !== undefined
            ? `[${formatTranscriptTimestamp(t.timestamp)}] `
            : "";
        return `${time}${role}: ${t.text}`;
      })
      .join("\n\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [transcripts]);

  return (
    <Card
      data-testid="live-interactive-transcript"
      className={cn("shadow-xs border overflow-hidden py-0 gap-0", className)}
    >
      <CardHeader className="p-4 border-b bg-muted/20 pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-bold text-foreground">
            Gỡ băng Tương tác Buổi thi (Interactive Transcript)
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs ml-1">
            {transcripts.length} lượt thoại
          </Badge>
        </div>

        {transcripts.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCopyAll}
            className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">
                  Đã sao chép
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép tất cả</span>
              </>
            )}
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
        {transcripts.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Chưa có nội dung hội thoại gỡ băng.
          </div>
        ) : (
          transcripts.map((turn, index) => {
            const isUser =
              turn.sender === "user" || turn.sender === "candidate";
            const timeInSeconds =
              turn.timestamp !== undefined
                ? turn.timestamp > 3600
                  ? Math.round(turn.timestamp / 1000)
                  : turn.timestamp
                : 0;

            const isNearCurrentTime =
              currentTimeSeconds > 0 &&
              Math.abs(currentTimeSeconds - timeInSeconds) < 4;

            return (
              <div
                key={turn.id || index}
                data-testid={`transcript-turn-${index}`}
                className={cn(
                  "p-3 rounded-xl border transition-all text-xs space-y-1.5",
                  isUser
                    ? "bg-primary/5 border-primary/20 ml-4 sm:ml-8"
                    : "bg-muted/30 border-muted-foreground/15 mr-4 sm:mr-8",
                  isNearCurrentTime && "ring-2 ring-primary/40 shadow-xs"
                )}
              >
                {/* Speaker Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    {isUser ? (
                      <>
                        <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                          <User className="w-3 h-3" />
                        </div>
                        <span className="text-primary">{candidateName}</span>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                          <Bot className="w-3 h-3" />
                        </div>
                        <span className="text-indigo-700 dark:text-indigo-300">
                          Giám khảo AI (Examiner)
                        </span>
                      </>
                    )}
                  </div>

                  {turn.timestamp !== undefined && onSeekToTime && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSeekToTime(timeInSeconds)}
                      data-testid={`seek-timestamp-btn-${index}`}
                      className="h-6 px-2 text-[11px] font-mono text-foreground/80 hover:text-primary gap-1 cursor-pointer rounded-md font-semibold"
                      title="Nhấn để nghe câu này"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>{formatTranscriptTimestamp(turn.timestamp)}</span>
                    </Button>
                  )}
                </div>

                {/* Message Body */}
                <p className="text-foreground/90 leading-relaxed pl-6.5">
                  {turn.text}
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
