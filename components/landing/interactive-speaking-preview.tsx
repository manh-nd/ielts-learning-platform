"use client";

import * as React from "react";
import Link from "next/link";
import {
  MicIcon,
  Volume2Icon,
  SparklesIcon,
  ShieldCheckIcon,
  LayersIcon,
  RadioIcon,
  ArrowRightIcon,
  RotateCcwIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BandScoreBadge } from "@/components/ui/band-score-badge";
import { cn } from "@/lib/utils";

interface ConversationTurn {
  speaker: "examiner" | "candidate";
  text: string;
  timestamp: string;
  criterionNote?: string;
}

const SAMPLE_TURNS: ConversationTurn[] = [
  {
    speaker: "examiner",
    text: "Good afternoon. Today we will start with Speaking Part 2. Here is your topic: Describe an ambitious project you worked on recently.",
    timestamp: "00:04",
  },
  {
    speaker: "candidate",
    text: "Well, one project that immediately springs to mind is developing an interactive educational tool for language learners. I collaborated with a cross-functional team to streamline our workflow.",
    timestamp: "00:18",
    criterionNote:
      "Lexical: 'springs to mind', 'cross-functional team' (Band 7.5+)",
  },
  {
    speaker: "examiner",
    text: "What challenges did you face while managing the timeline and workload?",
    timestamp: "00:32",
  },
  {
    speaker: "candidate",
    text: "The primary hurdle was balancing technical precision with user experience, but we mitigated risks through iterative sprints.",
    timestamp: "00:46",
    criterionNote:
      "Fluency & Coherence: Seamless discourse management (Band 8.0)",
  },
];

export function InteractiveSpeakingPreview() {
  const [activeTurnIndex, setActiveTurnIndex] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);

  const currentTurn = SAMPLE_TURNS[activeTurnIndex];

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setActiveTurnIndex((prev) => (prev + 1) % SAMPLE_TURNS.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <section
      id="speaking-live"
      className="w-full py-16 md:py-24 border-t border-border/40 bg-muted/10"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 shadow-xs">
            <RadioIcon className="size-3.5 animate-pulse text-blue-500" />
            <span>Phòng Luyện Nói Ảo Live AI 24/7</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Luyện Đàm Thoại Thời Gian Thực với{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              Giám Khảo AI
            </span>
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Môi trường thi thử Speaking mô phỏng 100% phòng thi thực tế. Công
            nghệ đàm thoại âm thanh hai chiều không có độ trễ, lọc khử ồn chủ
            động và chấm điểm 4 tiêu chí chuẩn Cambridge.
          </p>
        </div>

        {/* Feature Grid & Interactive Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Feature Highlights */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
                  <MicIcon className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    Tương Tác Âm Thanh 2 Chiều Trực Tiếp
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Giám khảo AI lắng nghe và phản hồi tự nhiên bằng giọng bản
                    xứ chuẩn, linh hoạt đổi hướng câu hỏi như phòng thi IDP / BC
                    thực thụ.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20">
                  <LayersIcon className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    Đầy Đủ 3 Phần Thi IELTS Speaking
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Từ phần mở đầu Part 1, Cue Card Part 2 với đồng hồ chuẩn bị
                    1 phút, đến phần thảo luận chuyên sâu Part 3 với kho đề theo
                    quý mới nhất.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                  <ShieldCheckIcon className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    Khử Tiếng Ồn & Ghi Âm Từng Mốc Giây
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Bộ xử lý Spectral Gate Noise Suppressor loại bỏ tiếng quạt
                    và tạp âm, lưu file âm thanh chất lượng cao để Giáo viên
                    nghe và nhận xét từng giây.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "default" }),
                  "h-11 px-6 font-semibold text-xs sm:text-sm gap-2"
                )}
              >
                <span>Trải nghiệm Phòng Luyện Nói Ảo</span>
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive Speaking Mini-Widget */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-xl backdrop-blur-xs space-y-5">
              {/* Widget Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <Volume2Icon className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                      Mô phỏng Đàm thoại Speaking Live
                    </h4>
                    <p className="text-[0.68rem] text-muted-foreground">
                      Chạm để chuyển lượt hoặc bật chế độ tự động chạy
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
                      isPlaying
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                        : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                    )}
                  >
                    {isPlaying ? "Tạm dừng" : "Tự động chạy"}
                  </button>
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveTurnIndex(
                        (prev) => (prev + 1) % SAMPLE_TURNS.length
                      );
                    }}
                    className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                    title="Chuyển lượt hội thoại tiếp theo"
                  >
                    <RotateCcwIcon className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Speaker State Indicator & Simulated Waveform */}
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2.5 rounded-full animate-pulse",
                        currentTurn.speaker === "examiner"
                          ? "bg-violet-500"
                          : "bg-emerald-500"
                      )}
                    />
                    <span className="font-bold text-foreground">
                      {currentTurn.speaker === "examiner"
                        ? "Giám khảo AI đang nói (Examiner)"
                        : "Thí sinh đang trả lời (Candidate)"}
                    </span>
                  </div>
                  <span className="font-mono text-muted-foreground text-[0.7rem]">
                    {currentTurn.timestamp}
                  </span>
                </div>

                {/* Animated Waveform Display */}
                <div className="h-16 rounded-lg bg-background/80 border border-border/50 flex items-center justify-center gap-1 sm:gap-1.5 px-4 overflow-hidden">
                  {Array.from({ length: 28 }).map((_, i) => {
                    const isExaminer = currentTurn.speaker === "examiner";
                    const heightPercent = isExaminer
                      ? [
                          30, 60, 90, 45, 80, 100, 70, 50, 85, 30, 65, 95, 40,
                          75,
                        ][i % 14]
                      : [
                          40, 80, 50, 95, 70, 30, 85, 100, 60, 90, 45, 75, 85,
                          55,
                        ][i % 14];

                    return (
                      <div
                        key={i}
                        className={cn(
                          "w-1 sm:w-1.5 rounded-full transition-all duration-300",
                          isExaminer ? "bg-violet-500/80" : "bg-emerald-500/80"
                        )}
                        style={{
                          height: `${Math.max(15, heightPercent)}%`,
                          animation: "pulse 1.2s ease-in-out infinite",
                          animationDelay: `${(i * 50) % 600}ms`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Live Transcript Stream Bubble */}
              <div className="rounded-xl border border-border/50 bg-background/90 p-4 space-y-2 text-left">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <SparklesIcon className="size-3 text-primary" />
                    Transcript Nguyên Văn Trích Xuất Tức Thì
                  </span>
                  <Badge variant="outline" className="text-[0.65rem]">
                    Part 2 Cue Card
                  </Badge>
                </div>

                <p className="text-xs sm:text-sm text-foreground font-medium leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/40">
                  &ldquo;{currentTurn.text}&rdquo;
                </p>

                {currentTurn.criterionNote && (
                  <div className="flex items-center gap-2 text-[0.72rem] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-md border border-emerald-500/20">
                    <CheckCircle2Icon className="size-3.5 shrink-0" />
                    <span>
                      <strong>AI Chẩn đoán:</strong> {currentTurn.criterionNote}
                    </span>
                  </div>
                )}
              </div>

              {/* IELTS Speaking Rubric Previews */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2 space-y-0.5">
                  <span className="text-[0.65rem] text-muted-foreground block">
                    Fluency & Coherence
                  </span>
                  <span className="font-bold text-xs text-amber-600 dark:text-amber-400">
                    Band 7.5
                  </span>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2 space-y-0.5">
                  <span className="text-[0.65rem] text-muted-foreground block">
                    Lexical Resource
                  </span>
                  <span className="font-bold text-xs text-blue-600 dark:text-blue-400">
                    Band 8.0
                  </span>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2 space-y-0.5">
                  <span className="text-[0.65rem] text-muted-foreground block">
                    Grammar Range
                  </span>
                  <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                    Band 7.5
                  </span>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2 space-y-0.5">
                  <span className="text-[0.65rem] text-muted-foreground block">
                    Pronunciation
                  </span>
                  <span className="font-bold text-xs text-violet-600 dark:text-violet-400">
                    Band 7.5
                  </span>
                </div>
              </div>

              {/* Overall Band pill footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                <span className="text-muted-foreground">
                  Điểm tổng kết Speaking ước tính:
                </span>
                <BandScoreBadge score={7.5} size="md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
