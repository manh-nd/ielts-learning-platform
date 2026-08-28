import * as React from "react";
import Link from "next/link";
import { GraduationCapIcon, SparklesIcon } from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/20 to-background text-foreground antialiased selection:bg-primary/20">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight transition-opacity hover:opacity-90"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <GraduationCapIcon className="size-5" />
            </div>
            <span className="font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Chilly IELTS
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-medium text-primary">
              <SparklesIcon className="size-3" />
              AI Powered
            </span>
          </Link>

          <nav className="flex items-center gap-3 text-xs">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Trang chủ
            </Link>
            <span className="text-border">|</span>
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Đăng nhập
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              Đăng ký
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4">
          <p>
            © {new Date().getFullYear()} Chilly IELTS • Nền tảng Luyện thi IELTS
            Thông minh kết hợp AI & Giảng viên.
          </p>
        </div>
      </footer>
    </div>
  );
}
