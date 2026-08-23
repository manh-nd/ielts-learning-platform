"use client";

import React, { useRef, useEffect } from "react";
import { User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TranscriptItem } from "./types";

export interface LiveTranscriptStreamProps {
  transcripts: TranscriptItem[];
  className?: string;
  autoScroll?: boolean;
  emptyPlaceholder?: string;
}

export function LiveTranscriptStream({
  transcripts,
  className,
  autoScroll = true,
  emptyPlaceholder = "Bản gỡ băng hội thoại thời gian thực sẽ hiển thị tại đây khi buổi thi bắt đầu...",
}: LiveTranscriptStreamProps) {
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts, autoScroll]);

  return (
    <div
      data-testid="live-transcript-stream"
      className={cn(
        "flex flex-col h-64 overflow-y-auto p-4 space-y-3 rounded-xl border bg-muted/20 scroll-smooth",
        className
      )}
    >
      {transcripts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center p-6 text-xs text-muted-foreground italic">
          {emptyPlaceholder}
        </div>
      ) : (
        transcripts.map((item) => {
          const isExaminer = item.sender === "examiner";
          return (
            <div
              key={item.id}
              data-testid={`transcript-${item.sender}`}
              className={cn(
                "flex items-start gap-2.5 max-w-[88%] text-xs animate-in fade-in-50 duration-200",
                isExaminer ? "self-start" : "self-end flex-row-reverse"
              )}
            >
              {/* Avatar Icon */}
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white shadow-xs",
                  isExaminer
                    ? "bg-indigo-600 dark:bg-indigo-500"
                    : "bg-primary dark:bg-primary"
                )}
              >
                {isExaminer ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : (
                  <User className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2 leading-relaxed shadow-xs",
                  isExaminer
                    ? "bg-background border text-foreground rounded-tl-xs"
                    : "bg-primary text-primary-foreground rounded-tr-xs"
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className={cn(
                      "font-semibold text-[11px]",
                      isExaminer
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-primary-foreground/90"
                    )}
                  >
                    {isExaminer ? "Giám khảo IELTS" : "Bạn"}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] opacity-60 font-mono",
                      isExaminer
                        ? "text-muted-foreground"
                        : "text-primary-foreground"
                    )}
                  >
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs whitespace-pre-wrap">{item.text}</p>
              </div>
            </div>
          );
        })
      )}
      <div ref={scrollEndRef} />
    </div>
  );
}
