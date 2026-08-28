"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  SparklesIcon,
  UserCheckIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  CheckIcon,
  MessageSquareQuoteIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BandScoreBadge } from "@/components/ui/band-score-badge";
import { cn } from "@/lib/utils";

export function InteractiveTeacherPreview() {
  const [activeMode, setActiveMode] = React.useState<"ai" | "teacher">(
    "teacher"
  );

  return (
    <section
      id="teacher-review"
      className="w-full py-16 md:py-24 border-t border-border/40 bg-muted/10"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-xs">
            <ShieldCheckIcon className="size-3.5 text-emerald-500" />
            <span>AI Đề Xuất • Giảng Viên Giữ Quyền Phán Quyết</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Bảo Chứng Điểm Thi bởi{" "}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 bg-clip-text text-transparent">
              Giảng Viên Chuyên Môn
            </span>
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Học viên tự do luyện thi với AI tốc độ cao, nhưng kết quả bài tập về
            nhà luôn được giáo viên kiểm duyệt, đính kèm nhận xét sâu sắc và bảo
            chứng chất lượng học thuật 100%.
          </p>
        </div>

        {/* Feature Grid & Interactive Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Core Value Propositions */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                  <UserCheckIcon className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    Chấm Chữa Chi Tiết Từng Câu & Mốc Giây
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Giáo viên có thể nghe lại audio từng giây, để lại ghi chú
                    ngữ âm hoặc sửa trực tiếp trên từng đoạn bài viết TipTap của
                    học viên.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/20">
                  <SparklesIcon className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    AI Giảm 70% Thời Gian Chấm Bài
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    AI tự động quét ngữ pháp, trích xuất transcript và gợi ý
                    bảng điểm sơ bộ. Giáo viên chỉ cần tinh chỉnh và dành trọn
                    tâm huyết vào lời khuyên cá nhân hóa.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/20">
                  <CheckCircle2Icon className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    Bảng Điểm Công Bố Chính Thức (Published)
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Chỉ khi Giáo viên nhấn nút &ldquo;Duyệt & Công bố&rdquo;,
                    kết quả mới hiển thị đến Học viên kèm báo cáo tiến độ và
                    bảng điểm chuẩn Cambridge.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                href="/teacher/review"
                className={cn(
                  buttonVariants({ size: "default" }),
                  "h-11 px-6 font-semibold text-xs sm:text-sm gap-2"
                )}
              >
                <span>Xem Không Gian Chấm Bài</span>
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive AI vs Teacher Diff Widget */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-xl backdrop-blur-xs space-y-5">
              {/* Widget Mode Switcher Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-foreground">
                    So Sánh Quy Trình Chấm Chữa Hai Tầng
                  </h4>
                  <p className="text-[0.68rem] text-muted-foreground">
                    Chuyển tab để thấy sự khác biệt giữa AI đề xuất và Giáo viên
                    chuẩn hóa
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-1 text-xs">
                  <button
                    onClick={() => setActiveMode("ai")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer",
                      activeMode === "ai"
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <SparklesIcon className="size-3 text-primary" />
                    <span>1. AI Đề Xuất Sơ Bộ</span>
                  </button>

                  <button
                    onClick={() => setActiveMode("teacher")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer",
                      activeMode === "teacher"
                        ? "bg-emerald-600 text-white shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <UserCheckIcon className="size-3" />
                    <span>2. Giáo Viên Duyệt & Sửa</span>
                  </button>
                </div>
              </div>

              {/* Dynamic State View */}
              {activeMode === "ai" ? (
                /* Mode 1: AI Proposal State */
                <div className="space-y-4 animate-in fade-in duration-200 text-left">
                  <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="size-4 text-primary" />
                      <div>
                        <span className="font-bold text-foreground">
                          Đề xuất sơ bộ từ AI (AiAssessmentProposal)
                        </span>
                        <p className="text-[0.68rem] text-muted-foreground">
                          Bản nháp tự động • Chưa có thẩm quyền công bố chính
                          thức
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[0.68rem] bg-background"
                    >
                      Bản nháp AI
                    </Badge>
                  </div>

                  {/* Criteria Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-border/50 bg-background/80 p-2.5">
                      <span className="text-[0.68rem] text-muted-foreground block">
                        Task Response
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        6.5
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/80 p-2.5">
                      <span className="text-[0.68rem] text-muted-foreground block">
                        Coherence (CC)
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        6.5
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/80 p-2.5">
                      <span className="text-[0.68rem] text-muted-foreground block">
                        Lexical (LR)
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        7.0
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background/80 p-2.5">
                      <span className="text-[0.68rem] text-muted-foreground block">
                        Grammar (GRA)
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        6.5
                      </span>
                    </div>
                  </div>

                  {/* AI Note */}
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-3.5 space-y-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <MessageSquareQuoteIcon className="size-3.5 text-primary" />
                      Phân tích tổng hợp tự động:
                    </span>
                    <p className="text-[0.75rem] leading-relaxed">
                      Bài viết trả lời đúng trọng tâm đề bài. Có sử dụng cấu
                      trúc phức tạp nhưng một số câu thân bài 1 còn ngắt quãng
                      và chưa phát triển sâu hết tiềm năng.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="text-muted-foreground">
                      Điểm đề xuất tạm tính:
                    </span>
                    <BandScoreBadge score={6.5} size="md" />
                  </div>
                </div>
              ) : (
                /* Mode 2: Teacher Verified & Published State */
                <div className="space-y-4 animate-in fade-in duration-200 text-left">
                  <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <span className="font-bold text-foreground">
                          Bảng điểm chính thức đã duyệt (PublishedAssessment)
                        </span>
                        <p className="text-[0.68rem] text-muted-foreground">
                          Được thẩm định bởi Thạc sĩ Giảng viên IELTS • Bảo
                          chứng 100%
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-600 text-white text-[0.68rem] hover:bg-emerald-600">
                      Đã Xuất Bản
                    </Badge>
                  </div>

                  {/* Criteria Grid with Score Deltas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5 space-y-0.5">
                      <span className="text-[0.68rem] text-muted-foreground block">
                        Task Response
                      </span>
                      <div className="flex items-center justify-center gap-1">
                        <span className="line-through text-muted-foreground text-[0.7rem]">
                          6.5
                        </span>
                        <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          7.0
                        </span>
                      </div>
                      <span className="text-[0.62rem] text-emerald-600 font-semibold">
                        +0.5 (Nâng điểm)
                      </span>
                    </div>

                    <div className="rounded-lg border border-border/50 bg-background/80 p-2.5 space-y-0.5">
                      <span className="text-[0.68rem] text-muted-foreground block">
                        Coherence (CC)
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        6.5
                      </span>
                      <span className="text-[0.62rem] text-muted-foreground">
                        Giữ nguyên
                      </span>
                    </div>

                    <div className="rounded-lg border border-border/50 bg-background/80 p-2.5 space-y-0.5">
                      <span className="text-[0.68rem] text-muted-foreground block">
                        Lexical (LR)
                      </span>
                      <span className="font-bold text-sm text-foreground">
                        7.0
                      </span>
                      <span className="text-[0.62rem] text-muted-foreground">
                        Giữ nguyên
                      </span>
                    </div>

                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5 space-y-0.5">
                      <span className="text-[0.68rem] text-muted-foreground block">
                        Grammar (GRA)
                      </span>
                      <div className="flex items-center justify-center gap-1">
                        <span className="line-through text-muted-foreground text-[0.7rem]">
                          6.5
                        </span>
                        <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          7.0
                        </span>
                      </div>
                      <span className="text-[0.62rem] text-emerald-600 font-semibold">
                        +0.5 (Nâng điểm)
                      </span>
                    </div>
                  </div>

                  {/* Teacher Feedback Note with Direct Highlight */}
                  <div className="rounded-xl border border-emerald-500/30 bg-background p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-foreground font-semibold">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                        <CheckIcon className="size-3.5" />
                        Nhận xét & Lộ trình của Giảng viên:
                      </span>
                      <span className="text-[0.68rem] text-muted-foreground">
                        Teacher: Ms. Chilly (IELTS 8.5)
                      </span>
                    </div>
                    <p className="text-[0.75rem] text-foreground leading-relaxed">
                      &ldquo;Thầy đã đọc kỹ bài làm của em. Luận điểm phản biện
                      ở đoạn 2 thực chất rất sắc bén và thể hiện góc nhìn học
                      thuật vượt trội so với đánh giá ban đầu của AI (đã điều
                      chỉnh TR lên 7.0). Em chỉ cần chú ý thay thế 2 lỗi
                      collocation nhỏ đã note trực tiếp trong bài là hoàn toàn
                      tự tin đạt 7.5+ Writing.&rdquo;
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Bảng điểm chính thức sau thẩm định:
                    </span>
                    <BandScoreBadge score={7.0} size="md" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
