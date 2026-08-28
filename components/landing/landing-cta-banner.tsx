"use client";

import Link from "next/link";
import { SparklesIcon, ArrowRightIcon, ShieldCheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingCtaBanner() {
  return (
    <section className="w-full py-16 md:py-24 border-t border-border/40 bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/90 p-8 sm:p-12 md:p-16 text-center shadow-2xl backdrop-blur-md space-y-6">
          {/* Background Ambient Glow */}
          <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-violet-500/20 blur-3xl" />

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <SparklesIcon className="size-3.5" />
            <span>Đồng Hành Chinh Phục Mục Tiêu Band 7.5+</span>
          </div>

          {/* Title */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground max-w-2xl mx-auto leading-tight">
            Sẵn sàng Bứt phá Điểm IELTS cùng{" "}
            <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
              Chilly IELTS
            </span>
            ?
          </h2>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Tham gia ngay để trải nghiệm phòng đàm thoại Speaking tương tác trực
            tiếp với Giám khảo AI và nhận sự hỗ trợ sửa bài chi tiết từ Giảng
            viên chuyên gia.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4 max-w-md mx-auto">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full sm:w-auto h-12 px-8 font-bold text-sm sm:text-base justify-center gap-2 cursor-pointer shadow-lg shadow-primary/25 hover:shadow-primary/35 transition-all"
              )}
            >
              <span>Tạo tài khoản Học viên</span>
              <ArrowRightIcon className="size-4" />
            </Link>

            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto h-12 px-6 font-semibold text-sm sm:text-base justify-center gap-2 cursor-pointer border-border/80 bg-background/80 hover:bg-muted/80"
              )}
            >
              <ShieldCheckIcon className="size-4 text-primary" />
              <span>Đăng nhập hệ thống</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
