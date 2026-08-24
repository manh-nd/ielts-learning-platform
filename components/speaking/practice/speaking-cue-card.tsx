"use client";

import { BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpeakingQuestionItem } from "./types";

export interface SpeakingCueCardProps {
  question: SpeakingQuestionItem;
  className?: string;
  isCompact?: boolean;
}

export function SpeakingCueCard({
  question,
  className,
  isCompact = false,
}: SpeakingCueCardProps) {
  const bullets = question.cueCardBullets || [];

  return (
    <Card
      data-testid="speaking-cue-card"
      className={cn(
        "border-2 border-primary/20 bg-card shadow-sm overflow-hidden p-0 py-0 gap-0",
        className
      )}
    >
      <CardHeader
        className={cn(
          "bg-primary/5 px-5 py-3.5 [.border-b]:pb-3.5 border-b border-primary/15 flex flex-row items-center justify-between gap-3",
          isCompact && "px-4 py-2.5 [.border-b]:pb-2.5"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Badge
                variant="outline"
                className="text-[11px] font-semibold tracking-wide uppercase bg-background shadow-xs shrink-0"
              >
                IELTS Part 2 Cue Card
              </Badge>
              {question.topic && (
                <span className="text-xs font-medium text-foreground/80 truncate">
                  Topic: {question.topic}
                </span>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-semibold px-2.5 py-0.5 shrink-0"
          >
            2 Phút Nói
          </Badge>
        </div>
      </CardHeader>

      <CardContent
        className={cn("p-5 space-y-4", isCompact && "p-4 space-y-3")}
      >
        {/* Main Topic Question */}
        <div>
          <h3
            className={cn(
              "font-bold text-foreground leading-snug tracking-tight",
              isCompact ? "text-base" : "text-lg sm:text-xl"
            )}
          >
            {question.questionText}
          </h3>
        </div>

        {/* Prompt Bullets ("You should say:") */}
        {bullets.length > 0 && (
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-2.5">
            <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              You should say:
            </p>
            <ul className="space-y-2 text-sm text-foreground">
              {bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <span className="leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-dashed">
          <span>Chuẩn bị: 1 phút (được ghi chú)</span>
          <span>Thời gian nói: 1 - 2 phút</span>
        </div>
      </CardContent>
    </Card>
  );
}
