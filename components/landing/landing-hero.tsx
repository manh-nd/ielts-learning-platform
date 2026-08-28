"use client";

import Link from "next/link";
import {
  SparklesIcon,
  ArrowRightIcon,
  MicIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  CheckCircle2Icon,
  PlayIcon,
  UserCheckIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BandScoreBadge } from "@/components/ui/band-score-badge";
import { cn } from "@/lib/utils";

export function LandingHero() {
  return (
    <section className="relative w-full overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24">
      {/* Background Glow effects */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10 overflow-hidden">
        <div className="size-[500px] sm:size-[650px] rounded-full bg-primary/10 blur-[100px] dark:bg-primary/15" />
        <div className="absolute top-1/4 -right-20 size-[300px] rounded-full bg-violet-500/10 blur-[80px]" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center sm:px-6 lg:px-8 space-y-8">
        {/* Top Feature Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs text-primary shadow-xs backdrop-blur-xs transition-all hover:bg-primary/15">
          <SparklesIcon className="size-3.5 animate-pulse text-primary" />
          <span className="font-bold">Đột Phá Luyện Thi:</span>
          <span className="text-foreground/90">
            Tự luyện cùng AI 24/7 & Giảng viên Chữa bài Tỉ mỉ
          </span>
        </div>

        {/* Main H1 Headline */}
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl max-w-4xl leading-[1.15] sm:leading-[1.1]">
          Luyện thi IELTS Thông minh cùng{" "}
          <span className="bg-gradient-to-r from-primary via-violet-600 to-indigo-500 bg-clip-text text-transparent">
            AI & Giảng viên
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
          Tự do luyện tập không giới hạn cùng Giám khảo AI thông minh (Speaking
          đàm thoại 2 chiều, Writing chẩn đoán lỗi tức thì), đồng thời nhận phản
          hồi, sửa lỗi chuyên sâu và bảng điểm chính thức từ Giảng viên.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-md">
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full sm:w-auto h-12 px-7 font-bold text-sm sm:text-base justify-center gap-2 cursor-pointer shadow-lg shadow-primary/25 hover:shadow-primary/35 transition-all"
            )}
          >
            <span>Bắt đầu Luyện tập Miễn phí</span>
            <ArrowRightIcon className="size-4" />
          </Link>

          <a
            href="#speaking-live"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full sm:w-auto h-12 px-6 font-semibold text-sm sm:text-base justify-center gap-2 cursor-pointer border-border/80 bg-background/60 backdrop-blur-xs hover:bg-muted/80 transition-all"
            )}
          >
            <PlayIcon className="size-3.5 fill-current text-primary" />
            <span>Khám phá Tính năng</span>
          </a>
        </div>

        {/* Teacher portal quick link */}
        <div className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 pt-1">
          <UserCheckIcon className="size-3.5 text-emerald-500" />
          <span>Bạn là Giáo viên hoặc Trung tâm đào tạo?</span>
          <Link
            href="/teacher/review"
            className="text-primary font-semibold hover:underline"
          >
            Khám phá Không gian Chấm bài →
          </Link>
        </div>

        {/* Hero Composite Preview Card */}
        <div className="w-full max-w-4xl mt-6 rounded-2xl border border-border/70 bg-card/85 p-3 sm:p-5 shadow-2xl backdrop-blur-md">
          {/* Mockup Header Bar */}
          <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-rose-500/80" />
                <div className="size-3 rounded-full bg-amber-500/80" />
                <div className="size-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="hidden sm:inline-block font-mono text-[0.7rem] text-muted-foreground pl-2">
                chilly-ielts.vn/workspace
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AI Live + Teacher Active
              </span>
              <BandScoreBadge score={7.5} size="sm" />
            </div>
          </div>

          {/* Grid Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-left">
            {/* Left Box: Speaking Live Simulator snippet */}
            <div className="rounded-xl border border-border/60 bg-background/80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                    <MicIcon className="size-3.5" />
                  </div>
                  <span className="font-bold text-xs text-foreground">
                    Phòng Luyện Nói Ảo AI
                  </span>
                </div>
                <Badge variant="outline" className="text-[0.65rem] bg-muted/40">
                  Gemini Live 2-Way
                </Badge>
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 space-y-1.5 border border-border/40">
                <div className="flex items-center justify-between text-[0.68rem] text-muted-foreground">
                  <span className="font-semibold text-primary">
                    AI Examiner (British Accent)
                  </span>
                  <span>Đang hội thoại...</span>
                </div>
                <p className="text-xs text-foreground font-medium italic">
                  &quot;Could you tell me about a place you visited that left a
                  strong impression on you?&quot;
                </p>
                {/* Visualizer bars simulation */}
                <div className="flex items-center justify-center gap-1 h-5 pt-1">
                  {[40, 75, 100, 60, 90, 45, 80, 100, 70, 50, 85, 30].map(
                    (height, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-primary/70 animate-pulse"
                        style={{
                          height: `${height}%`,
                          animationDelay: `${i * 80}ms`,
                        }}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[0.7rem] text-muted-foreground pt-0.5">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-3" />
                  Khử ồn & Trích xuất transcript tức thì
                </span>
                <span className="font-mono text-foreground font-bold">
                  Part 2: 7.5
                </span>
              </div>
            </div>

            {/* Right Box: Teacher Review & Writing snippet */}
            <div className="rounded-xl border border-border/60 bg-background/80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <ShieldCheckIcon className="size-3.5" />
                  </div>
                  <span className="font-bold text-xs text-foreground">
                    Giảng Viên Chấm Chữa Đa Tầng
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[0.65rem] text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                >
                  Đã Duyệt (Published)
                </Badge>
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 space-y-1.5 border border-border/40">
                <div className="flex items-center justify-between text-[0.68rem]">
                  <span className="font-semibold text-foreground">
                    IELTS Writing Task 2: Opinion Essay
                  </span>
                  <span className="text-muted-foreground font-mono">
                    284 từ
                  </span>
                </div>
                <div className="text-[0.72rem] text-muted-foreground leading-relaxed">
                  &quot;While some argue automation leads to job losses,{" "}
                  <span className="border-b-2 border-emerald-500 text-foreground font-medium bg-emerald-500/10 px-0.5 rounded-xs">
                    it undeniably fosters high-skilled industries
                  </span>
                  ...&quot;
                </div>
                <div className="rounded-md bg-background/90 p-1.5 border border-border/50 text-[0.68rem] text-foreground flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Nhận xét của Giảng viên:
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Luận điểm chặt chẽ, từ vựng C1 chuẩn xác
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[0.7rem]">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>TR: 7.5</span>
                  <span>CC: 7.5</span>
                  <span>LR: 8.0</span>
                  <span>GRA: 7.0</span>
                </div>
                <span className="font-bold text-primary">Band 7.5</span>
              </div>
            </div>
          </div>

          {/* Quick Pillar Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-border/40 mt-3 text-center text-xs text-muted-foreground">
            <div className="flex items-center justify-center gap-1.5 py-1">
              <MicIcon className="size-3.5 text-blue-500" />
              <span className="font-medium text-foreground">
                Phòng Luyện Nói Ảo AI
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-1">
              <BookOpenIcon className="size-3.5 text-amber-500" />
              <span className="font-medium text-foreground">
                Luyện Viết & Chẩn Đoán Lỗi
              </span>
            </div>
            <div className="flex items-center justify-center gap-1.5 py-1">
              <ShieldCheckIcon className="size-3.5 text-emerald-500" />
              <span className="font-medium text-foreground">
                Giáo Viên Chữa Bài Tỉ Mỉ
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
