"use client";

import Link from "next/link";
import { GraduationCapIcon, SparklesIcon, ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-sm font-semibold tracking-tight transition-opacity hover:opacity-90"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <GraduationCapIcon className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              Chilly IELTS
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[0.68rem] font-medium text-primary">
            <SparklesIcon className="size-3" />
            AI Powered
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <a
            href="#speaking-live"
            className="text-muted-foreground hover:text-foreground transition-colors font-medium text-xs lg:text-sm"
          >
            Luyện nói ảo
          </a>
          <a
            href="#writing-diagnostic"
            className="text-muted-foreground hover:text-foreground transition-colors font-medium text-xs lg:text-sm"
          >
            Luyện viết AI
          </a>
          <a
            href="#teacher-review"
            className="text-muted-foreground hover:text-foreground transition-colors font-medium text-xs lg:text-sm"
          >
            Giáo viên chấm chữa
          </a>
          <a
            href="#learning-journey"
            className="text-muted-foreground hover:text-foreground transition-colors font-medium text-xs lg:text-sm"
          >
            Quy trình 4 bước
          </a>
        </nav>

        {/* Auth CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
          >
            Đăng nhập
          </Link>
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-9 px-4 text-xs sm:text-sm font-semibold cursor-pointer shadow-sm shadow-primary/20"
            )}
          >
            <span>Bắt đầu ngay</span>
            <ArrowRightIcon className="size-3.5 ml-1.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
