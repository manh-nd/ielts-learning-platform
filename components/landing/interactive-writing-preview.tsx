"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpenIcon,
  SparklesIcon,
  SlidersIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  PenToolIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BandScoreBadge } from "@/components/ui/band-score-badge";
import { cn } from "@/lib/utils";

// Official Cambridge IELTS rounding logic
function calculateOverallBand(
  ta: number,
  cc: number,
  lr: number,
  gra: number
): number {
  const avg = (ta + cc + lr + gra) / 4;
  const floor = Math.floor(avg);
  const frac = avg - floor;

  if (frac < 0.25) return floor;
  if (frac < 0.75) return floor + 0.5;
  return floor + 1.0;
}

export function InteractiveWritingPreview() {
  const [taScore, setTaScore] = React.useState(7.5);
  const [ccScore, setCcScore] = React.useState(7.0);
  const [lrScore, setLrScore] = React.useState(8.0);
  const [graScore, setGraScore] = React.useState(7.0);
  const [selectedError, setSelectedError] = React.useState<string | null>(null);

  const overallBand = calculateOverallBand(taScore, ccScore, lrScore, graScore);

  return (
    <section
      id="writing-diagnostic"
      className="w-full py-16 md:py-24 border-t border-border/40 bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 shadow-xs">
            <PenToolIcon className="size-3.5 text-amber-500" />
            <span>Trình Soạn Thảo & Chẩn Đoán Lỗi AI</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Luyện Viết Chuyên Sâu với{" "}
            <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Chẩn Đoán 4 Tiêu Chí
            </span>
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Trình soạn thảo Tiptap hiện đại chuẩn thi thật, tự động đếm từ và
            chẩn đoán tức thì mọi lỗi ngữ pháp, từ vựng và cấu trúc luận điểm
            theo đúng Rubric IELTS quốc tế.
          </p>
        </div>

        {/* 2-Column Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Interactive Essay Preview with Error Annotations */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-xl backdrop-blur-xs space-y-5">
              {/* Top Editor Bar */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                    <BookOpenIcon className="size-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">
                      IELTS Writing Task 2 • Academic Essay
                    </h4>
                    <span className="text-[0.68rem] text-muted-foreground">
                      Thời gian làm bài: 40 phút • Tối thiểu 250 từ
                    </span>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[0.7rem] font-mono"
                >
                  286 từ (Đạt yêu cầu)
                </Badge>
              </div>

              {/* Essay Text Display with Interactive Error Highlights */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5 space-y-3 text-left">
                <div className="text-xs text-muted-foreground font-semibold flex items-center justify-between">
                  <span>
                    Trích đoạn bài viết (Nhấp vào các lỗi để xem AI phân tích):
                  </span>
                  <span className="text-[0.68rem] text-primary font-normal">
                    3 tầng mã màu lỗi
                  </span>
                </div>

                <div className="text-xs sm:text-sm text-foreground leading-relaxed space-y-3 font-serif">
                  <p>
                    Technological advancements have radically transformed modern
                    education. While some educators contend that remote learning{" "}
                    <button
                      onClick={() =>
                        setSelectedError(
                          selectedError === "grammar" ? null : "grammar"
                        )
                      }
                      className={cn(
                        "font-sans transition-all text-left px-1 py-0.5 rounded-xs cursor-pointer inline-block",
                        "border-b-2 border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold"
                      )}
                      title="Nhấp để xem chẩn đoán lỗi ngữ pháp"
                    >
                      reduces student engagement
                    </button>{" "}
                    due to physical isolation, I firmly believe that digital
                    tools{" "}
                    <button
                      onClick={() =>
                        setSelectedError(
                          selectedError === "lexical" ? null : "lexical"
                        )
                      }
                      className={cn(
                        "font-sans transition-all text-left px-1 py-0.5 rounded-xs cursor-pointer inline-block",
                        "border-b-2 border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
                      )}
                      title="Nhấp để xem nâng cấp từ vựng C1/C2"
                    >
                      foster unprecedented accessibility
                    </button>
                    .
                  </p>
                  <p>
                    Furthermore, AI-driven diagnostic systems{" "}
                    <button
                      onClick={() =>
                        setSelectedError(
                          selectedError === "coherence" ? null : "coherence"
                        )
                      }
                      className={cn(
                        "font-sans transition-all text-left px-1 py-0.5 rounded-xs cursor-pointer inline-block",
                        "border-b-2 border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                      )}
                      title="Nhấp để xem mạch lạc liên kết CC"
                    >
                      provide instantaneous feedback
                    </button>
                    , enabling learners to rectify recurring misconceptions
                    without relying solely on traditional classroom constraints.
                  </p>
                </div>

                {/* Popover / Diagnosis Callout Box */}
                {selectedError && (
                  <div className="rounded-lg border border-border bg-background p-3 shadow-md space-y-1 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                    {selectedError === "grammar" && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                          <AlertCircleIcon className="size-3.5" />
                          <span>Grammatical Range & Accuracy (GRA)</span>
                        </div>
                        <p className="text-muted-foreground text-[0.75rem]">
                          <strong>Chẩn đoán:</strong> Cấu trúc &quot;reduces
                          student engagement&quot; là chính xác nhưng có thể
                          nâng cao tính học thuật bằng dạng bị động hoặc mệnh đề
                          phân từ:{" "}
                          <em>
                            &quot;compromises interpersonal engagement&quot;
                          </em>
                          .
                        </p>
                      </div>
                    )}
                    {selectedError === "lexical" && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                          <SparklesIcon className="size-3.5" />
                          <span>Lexical Resource (LR) — Band 8.0+</span>
                        </div>
                        <p className="text-muted-foreground text-[0.75rem]">
                          <strong>Khen ngợi:</strong> Cụm kết hợp từ học thuật
                          chuẩn xác (Collocation:{" "}
                          <em>foster unprecedented accessibility</em>). Thể hiện
                          vốn từ vựng phong phú và tự nhiên.
                        </p>
                      </div>
                    )}
                    {selectedError === "coherence" && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                          <CheckCircle2Icon className="size-3.5" />
                          <span>Coherence & Cohesion (CC)</span>
                        </div>
                        <p className="text-muted-foreground text-[0.75rem]">
                          <strong>Chẩn đoán:</strong> Sử dụng liên từ chuyển
                          đoạn <em>Furthermore</em> kết hợp mệnh đề quan hệ rành
                          mạch, tăng tính kết nối logic giữa 2 đoạn thân bài.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Error Severity Legend */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[0.7rem] text-muted-foreground pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" />
                  <span>Từ vựng & Diễn đạt (LR)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>Mạch lạc & Liên kết (CC)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500" />
                  <span>Ngữ pháp & Cấu trúc (GRA)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive IELTS 4-Criteria Slider Calculator */}
          <div className="lg:col-span-5 space-y-6 order-1 lg:order-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <SlidersIcon className="size-3.5" />
                <span>Trình Tính Điểm Band Score Tương Tác</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                Tự Điều Chỉnh & Dự Đoán Điểm Bài Viết
              </h3>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Kéo thanh trượt 4 tiêu chí bên dưới để trải nghiệm thuật toán
                làm tròn điểm thi IELTS chính thức của Cambridge.
              </p>
            </div>

            {/* Slider Controls Box */}
            <div className="rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5 space-y-4 shadow-sm">
              {/* Task Achievement Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Task Response (TR/TA)
                  </span>
                  <span className="font-bold font-mono text-foreground">
                    Band {taScore.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="9.0"
                  step="0.5"
                  value={taScore}
                  onChange={(e) => setTaScore(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-muted rounded-lg"
                />
              </div>

              {/* Coherence & Cohesion Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    Coherence & Cohesion (CC)
                  </span>
                  <span className="font-bold font-mono text-foreground">
                    Band {ccScore.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="9.0"
                  step="0.5"
                  value={ccScore}
                  onChange={(e) => setCcScore(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-muted rounded-lg"
                />
              </div>

              {/* Lexical Resource Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    Lexical Resource (LR)
                  </span>
                  <span className="font-bold font-mono text-foreground">
                    Band {lrScore.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="9.0"
                  step="0.5"
                  value={lrScore}
                  onChange={(e) => setLrScore(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer h-2 bg-muted rounded-lg"
                />
              </div>

              {/* Grammatical Range Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    Grammar Range & Accuracy (GRA)
                  </span>
                  <span className="font-bold font-mono text-foreground">
                    Band {graScore.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="9.0"
                  step="0.5"
                  value={graScore}
                  onChange={(e) => setGraScore(parseFloat(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer h-2 bg-muted rounded-lg"
                />
              </div>

              {/* Live Calculated Overall Band */}
              <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    IELTS Overall Band (Tính toán thời gian thực):
                  </span>
                  <span className="text-[0.68rem] text-primary font-medium">
                    TB cộng:{" "}
                    {((taScore + ccScore + lrScore + graScore) / 4).toFixed(2)}
                  </span>
                </div>
                <BandScoreBadge score={overallBand} size="lg" />
              </div>
            </div>

            <div className="pt-1">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "default" }),
                  "h-11 px-6 font-semibold text-xs sm:text-sm gap-2"
                )}
              >
                <span>Bắt đầu Luyện Viết với AI</span>
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
