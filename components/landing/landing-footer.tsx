"use client";

import Link from "next/link";
import { GraduationCapIcon, SparklesIcon } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/95 text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        {/* Top Multi-column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Col 1: Brand & Slogan */}
          <div className="md:col-span-6 space-y-4 text-left">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-sm font-semibold tracking-tight transition-opacity hover:opacity-90"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <GraduationCapIcon className="size-5" />
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
                Chilly IELTS
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[0.68rem] font-medium text-primary">
                <SparklesIcon className="size-3" />
                AI Powered
              </span>
            </Link>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md">
              Nền tảng luyện thi IELTS thông minh tiên phong kết hợp đàm thoại
              âm thanh hai chiều thời gian thực cùng Giám khảo AI và không gian
              chấm chữa đa tầng, bảo chứng học thuật từ Giảng viên.
            </p>
          </div>

          {/* Col 2: Feature Navigation */}
          <div className="md:col-span-3 space-y-3 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Tính Năng Cốt Lõi
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <a
                  href="#speaking-live"
                  className="hover:text-foreground transition-colors"
                >
                  Phòng Luyện Nói Ảo Live AI
                </a>
              </li>
              <li>
                <a
                  href="#writing-diagnostic"
                  className="hover:text-foreground transition-colors"
                >
                  Luyện Viết & Chẩn Đoán 4 Tiêu Chí
                </a>
              </li>
              <li>
                <a
                  href="#teacher-review"
                  className="hover:text-foreground transition-colors"
                >
                  Không Gian Giáo Viên Chữa Bài
                </a>
              </li>
              <li>
                <a
                  href="#learning-journey"
                  className="hover:text-foreground transition-colors"
                >
                  Quy Trình Học Tập 4 Bước
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Portal Links */}
          <div className="md:col-span-3 space-y-3 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Tài Khoản & Truy Cập
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link
                  href="/signup"
                  className="hover:text-foreground transition-colors"
                >
                  Đăng ký Tài khoản Học viên
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-foreground transition-colors"
                >
                  Đăng nhập Hệ thống
                </Link>
              </li>
              <li>
                <Link
                  href="/teacher/review"
                  className="hover:text-foreground transition-colors text-primary font-medium"
                >
                  Dành cho Giảng viên & Trung tâm
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Disclaimer and Copyright Bar */}
        <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground text-center sm:text-left">
          <p>
            © {new Date().getFullYear()} Chilly IELTS. All rights reserved. •
            Nền tảng Luyện thi IELTS Thông minh cùng AI & Giảng viên.
          </p>
          <p className="text-[0.7rem] text-muted-foreground/80">
            IELTS® là thương hiệu đã đăng ký thuộc về Cambridge University Press
            & Assessment, IDP Education và British Council.
          </p>
        </div>
      </div>
    </footer>
  );
}
