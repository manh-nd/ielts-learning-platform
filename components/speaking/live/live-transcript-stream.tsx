"use client";

import { User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
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
  return (
    <MessageScrollerProvider autoScroll={autoScroll}>
      <MessageScroller
        data-testid="live-transcript-stream"
        className={cn(
          "h-64 rounded-xl border bg-muted/20 p-1.5 shadow-inner",
          className
        )}
      >
        <MessageScrollerViewport className="p-2">
          {transcripts.length === 0 ? (
            <div className="flex h-full min-h-[12rem] items-center justify-center text-center p-6 text-xs text-muted-foreground italic">
              {emptyPlaceholder}
            </div>
          ) : (
            <MessageScrollerContent className="gap-3.5">
              {transcripts.map((item) => {
                const isExaminer = item.sender === "examiner";
                const timeString = new Date(item.timestamp).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }
                );

                return (
                  <MessageScrollerItem
                    key={item.id}
                    data-testid={`transcript-${item.sender}`}
                    messageId={item.id}
                    scrollAnchor={!isExaminer}
                  >
                    <Message align={isExaminer ? "start" : "end"}>
                      {/* Avatar */}
                      <MessageAvatar
                        className={cn(
                          "size-7 shrink-0 text-white shadow-xs",
                          isExaminer
                            ? "bg-indigo-600 dark:bg-indigo-500"
                            : "bg-primary dark:bg-primary"
                        )}
                      >
                        {isExaminer ? (
                          <Sparkles className="size-3.5" />
                        ) : (
                          <User className="size-3.5" />
                        )}
                      </MessageAvatar>

                      {/* Content */}
                      <MessageContent>
                        <MessageHeader>
                          <span
                            className={cn(
                              "font-semibold",
                              isExaminer
                                ? "text-indigo-800 dark:text-indigo-300"
                                : "text-foreground font-semibold"
                            )}
                          >
                            {isExaminer ? "Giám khảo IELTS" : "Bạn"}
                          </span>
                        </MessageHeader>

                        <Bubble
                          variant={isExaminer ? "outline" : "default"}
                          align={isExaminer ? "start" : "end"}
                          className="shadow-xs max-w-[90%]"
                        >
                          <BubbleContent className="p-2.5">
                            <p className="whitespace-pre-wrap leading-relaxed text-xs">
                              {item.text}
                              {item.isFinal === false && (
                                <span className="inline-block size-1.5 ml-1 rounded-full bg-current animate-pulse align-middle" />
                              )}
                            </p>
                          </BubbleContent>
                        </Bubble>

                        <MessageFooter className="text-xs font-mono">
                          {timeString}
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}
            </MessageScrollerContent>
          )}
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
