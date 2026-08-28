"use client";

import { useMemo } from "react";
import { Clock, FileText, Sparkles, CheckCircle } from "lucide-react";
import { CueCardData, Part2Phase } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TiptapEditor } from "@/components/ui/tiptap-editor";
import { cn } from "@/lib/utils";

export function formatNotesToTiptapContent(rawText: string): string {
  if (!rawText || !rawText.trim()) return "";
  if (
    rawText.includes("<p>") ||
    rawText.includes("<ul>") ||
    rawText.includes("<ol>")
  ) {
    return rawText;
  }

  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const isList = lines.some(
    (l) => l.startsWith("- ") || l.startsWith("• ") || l.startsWith("* ")
  );

  if (isList) {
    const items = lines.map((l) => {
      const cleaned = l.replace(/^[-•*]\s*/, "");
      return `<li>${cleaned}</li>`;
    });
    return `<ul>${items.join("")}</ul>`;
  }

  return lines.map((l) => `<p>${l}</p>`).join("");
}

export interface LiveSpeakingCueCardModalProps {
  cueCard: CueCardData | null;
  phase: Part2Phase;
  prepTimeRemaining: number;
  notes: string;
  onNotesChange: (notes: string) => void;
  onFinishPrepEarly?: () => void;
  className?: string;
}

export function LiveSpeakingCueCardModal({
  cueCard,
  phase,
  prepTimeRemaining,
  notes,
  onNotesChange,
  onFinishPrepEarly,
  className,
}: LiveSpeakingCueCardModalProps) {
  const isPrep = phase === "prep_countdown";
  const progressPercent = Math.max(
    0,
    Math.min(100, ((60 - prepTimeRemaining) / 60) * 100)
  );

  const formattedInitialContent = useMemo(() => {
    return formatNotesToTiptapContent(notes);
  }, [notes]);

  if (!cueCard) return null;

  return (
    <Card
      data-testid="live-cue-card-container"
      className={cn(
        "w-full border-2 shadow-xs transition-all duration-300 overflow-hidden py-0 gap-0",
        isPrep
          ? "border-amber-500/50 bg-gradient-to-b from-amber-500/5 to-transparent ring-1 ring-amber-500/20"
          : "border-primary/40 bg-card",
        className
      )}
    >
      {/* Header: Symmetrical 16px (p-4) on all sides */}
      <CardHeader className="p-4 border-b bg-muted/20 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[10px] font-bold uppercase py-0 px-1.5",
                isPrep
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-primary/10 text-primary border-primary/30"
              )}
            >
              Part 2 Cue Card
            </Badge>
            <CardTitle className="text-sm font-bold text-foreground truncate max-w-[320px] sm:max-w-md">
              {cueCard.topicTitle}
            </CardTitle>
          </div>

          {/* Prep Timer Badge / Speaking State */}
          <div className="flex items-center gap-2">
            {isPrep ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-mono text-[11px] font-bold animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                <span>Chuẩn bị: {prepTimeRemaining}s</span>
              </div>
            ) : (
              <Badge className="bg-emerald-700 hover:bg-emerald-700 dark:bg-emerald-800 text-white font-medium gap-1 text-[11px] py-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Giai đoạn Trình bày (1-2 phút)</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Progress Bar during Prep */}
        {isPrep && (
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </CardHeader>

      {/* Content Body: Symmetrical 16px (p-4) matching Header exactly */}
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Cue Card Prompt & Bullets */}
          <div className="md:col-span-7 space-y-3">
            <div className="p-4 rounded-xl bg-card border shadow-xs space-y-2">
              <p className="text-xs font-semibold text-foreground leading-snug">
                {cueCard.cueCardPrompt}
              </p>
              <div className="text-[11px] text-muted-foreground font-medium">
                You should say:
              </div>
              <ul className="space-y-1 pl-4 list-disc text-xs text-foreground/90 leading-relaxed">
                {cueCard.bulletPoints.map((point, index) => (
                  <li key={index} className="pl-0.5">
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {cueCard.followUpQuestion && (
              <p className="text-[11px] text-muted-foreground italic px-0.5">
                💡 Giám khảo có thể hỏi thêm: &ldquo;{cueCard.followUpQuestion}
                &rdquo;
              </p>
            )}

            {isPrep && onFinishPrepEarly && (
              <Button
                size="sm"
                variant="outline"
                onClick={onFinishPrepEarly}
                className="w-full h-8 text-xs font-medium border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Tôi đã sẵn sàng nói ngay (Bỏ qua đếm ngược)</span>
              </Button>
            )}
          </div>

          {/* Scratchpad Note-taking */}
          <div className="md:col-span-5 space-y-1.5 flex flex-col">
            <div className="flex items-center justify-between text-[11px] px-0.5">
              <span className="font-medium text-foreground flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Bảng nháp ghi chú:</span>
              </span>
              <span className="text-[10px] text-muted-foreground">
                Ghi chú nhanh ý tưởng
              </span>
            </div>
            <TiptapEditor
              content={formattedInitialContent}
              placeholder="Ghi chú nhanh dàn ý (gõ '-' để tạo bullet list, Ctrl+B in đậm)..."
              minHeight="min-h-[135px]"
              editorClassName="p-4 text-xs text-foreground/90 leading-relaxed font-sans [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-1 [&_ul]:my-1 [&_li]:pl-0.5 [&_li]:text-foreground/90 [&_li::marker]:text-foreground/90 [&_p]:my-1 [&_p]:text-foreground/90"
              enableBubbleMenu={false}
              editable={isPrep || phase === "speaking"}
              onChange={({ text }) => onNotesChange(text)}
              className="bg-card border shadow-xs focus-within:ring-2 focus-within:ring-amber-500/30 rounded-lg"
              data-testid="speaking-scratchpad-tiptap"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
