"use client";

import {
  MicIcon,
  SparklesIcon,
  UserCheckIcon,
  TrophyIcon,
  ArrowRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    step: "01",
    title: "Tự Luyện 24/7 với AI",
    description:
      "Vào phòng Speaking đàm thoại trực tiếp thời gian thực hoặc mở trình soạn thảo Writing làm bài thi thử mọi lúc mọi nơi.",
    icon: MicIcon,
    accent: "blue",
    badge: "Chủ Động & Không Giới Hạn",
  },
  {
    step: "02",
    title: "AI Chẩn Đoán & Chấm Nháp",
    description:
      "Hệ thống tự động trích xuất transcript, phân tích 4 tiêu chí chuẩn IELTS và phát hiện các lỗi sai trong vài giây.",
    icon: SparklesIcon,
    accent: "amber",
    badge: "Phản Hồi Siêu Tốc",
  },
  {
    step: "03",
    title: "Giáo Viên Chữa Bài Tỉ Mỉ",
    description:
      "Giảng viên chuyên gia thẩm định bài làm, nghe lại audio theo timestamp, sửa từng câu chữ và cá nhân hóa lời khuyên.",
    icon: UserCheckIcon,
    accent: "emerald",
    badge: "Bảo Chứng Chuyên Môn",
  },
  {
    step: "04",
    title: "Bảng Điểm & Bứt Phá Band",
    description:
      "Nhận kết quả chính thức (Published), xem lại lịch sử tiến độ chi tiết và tự tin chinh phục mục tiêu IELTS của bạn.",
    icon: TrophyIcon,
    accent: "violet",
    badge: "Chuẩn Cambridge",
  },
];

export function LearningJourneyWorkflow() {
  return (
    <section
      id="learning-journey"
      className="w-full py-16 md:py-24 border-t border-border/40 bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary shadow-xs">
            <SparklesIcon className="size-3.5" />
            <span>Mô Hình Độc Quyền</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Quy Trình Học Tập{" "}
            <span className="bg-gradient-to-r from-primary via-violet-600 to-indigo-500 bg-clip-text text-transparent">
              Khép Kín 4 Bước
            </span>
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Sự kết hợp hoàn hảo giữa công nghệ AI tốc độ cao và tâm huyết của
            đội ngũ giáo viên chuyên môn giúp bạn tiến bộ bền vững qua từng bài
            luyện.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {STEPS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative rounded-2xl border border-border/70 bg-card/60 p-6 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-all hover:border-primary/40 group"
              >
                {/* Step number badge & icon */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-extrabold text-muted-foreground/40 group-hover:text-primary transition-colors">
                    {item.step}
                  </span>
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl transition-all",
                      item.accent === "blue" &&
                        "bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20",
                      item.accent === "amber" &&
                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20",
                      item.accent === "emerald" &&
                        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20",
                      item.accent === "violet" &&
                        "bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500/20"
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-2 text-left">
                  <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[0.68rem] font-semibold text-muted-foreground">
                    {item.badge}
                  </span>
                  <h3 className="text-base font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Connecting arrow indicator on desktop */}
                {idx < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute -right-3.5 top-1/2 -translate-y-1/2 z-10">
                    <div className="size-7 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground shadow-xs">
                      <ArrowRightIcon className="size-3.5" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
