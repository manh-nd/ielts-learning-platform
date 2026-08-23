import Link from "next/link";
import {
  GraduationCapIcon,
  SparklesIcon,
  MicIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  KeyRoundIcon,
  UserCheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-muted/20 to-background text-foreground antialiased selection:bg-primary/20">
      {/* Top Navbar */}
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
              IELTS Master
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-medium text-primary">
              <SparklesIcon className="size-3" />
              AI Powered
            </span>
          </Link>

          <nav className="flex items-center gap-3 text-xs">
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Đăng nhập
            </Link>
            <Button
              size="sm"
              className="h-8 px-3.5 text-xs font-medium cursor-pointer"
              render={
                <Link href="/signup">
                  <span>Bắt đầu ngay</span>
                  <ArrowRightIcon className="size-3 ml-1" />
                </Link>
              }
            />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24 max-w-5xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary shadow-xs">
          <SparklesIcon className="size-3.5" />
          <span className="font-semibold">Công nghệ AI Mới nhất:</span>
          <span>Gemini Live Audio & Tiptap Rich-Text</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground max-w-3xl leading-tight">
          Luyện thi IELTS Thông minh cùng{" "}
          <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            AI & Giảng viên
          </span>
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
          Nền tảng tích hợp toàn diện: Đàm thoại trực tiếp thời gian thực với
          Giám khảo AI (IELTS Speaking), Soạn thảo & phân tích chuyên sâu (IELTS
          Writing), cùng Không gian Chấm chữa phản hồi đa tầng từ Giảng viên.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-xs sm:max-w-md">
          <Button
            size="lg"
            className="w-full sm:w-auto h-11 px-6 font-semibold text-sm justify-center gap-2 cursor-pointer shadow-md"
            render={
              <Link href="/signup">
                <span>Tạo tài khoản Học viên</span>
                <ArrowRightIcon className="size-4" />
              </Link>
            }
          />
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto h-11 px-6 font-medium text-sm justify-center gap-2 cursor-pointer"
            render={
              <Link href="/login">
                <ShieldCheckIcon className="size-4 text-primary" />
                <span>Đăng nhập hệ thống</span>
              </Link>
            }
          />
        </div>

        {/* Dev Credentials Quick Access Helper */}
        <div className="w-full max-w-2xl mt-8 rounded-xl border border-border/70 bg-card/70 p-4 text-left shadow-xs backdrop-blur-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <KeyRoundIcon className="size-4 text-primary" />
              <span>
                Tài khoản Dev mẫu kiểm thử (Mật khẩu:{" "}
                <code className="text-primary font-mono">Password123!</code>)
              </span>
            </div>
            <Badge variant="outline" className="text-[0.68rem] bg-muted/60">
              Dev Seeded
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="rounded-lg border border-border/50 bg-background/60 p-2.5 space-y-1">
              <div className="flex items-center gap-1 font-semibold text-foreground text-[0.72rem]">
                <UserCheckIcon className="size-3.5 text-emerald-500" />
                <span>Giáo viên (Teacher)</span>
              </div>
              <p className="text-[0.68rem] text-muted-foreground font-mono truncate">
                teacher@ielts.liuhocngoaingu.com
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/60 p-2.5 space-y-1">
              <div className="flex items-center gap-1 font-semibold text-foreground text-[0.72rem]">
                <UserCheckIcon className="size-3.5 text-violet-500" />
                <span>Dual Role Account</span>
              </div>
              <p className="text-[0.68rem] text-muted-foreground font-mono truncate">
                learnerteacher@ielts.liuhocngoaingu.com
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/60 p-2.5 space-y-1">
              <div className="flex items-center gap-1 font-semibold text-foreground text-[0.72rem]">
                <UserCheckIcon className="size-3.5 text-blue-500" />
                <span>Học viên (Learner)</span>
              </div>
              <p className="text-[0.68rem] text-muted-foreground font-mono truncate">
                learner@ielts-prep.vn
              </p>
            </div>
          </div>
        </div>

        {/* Feature Cards Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left w-full pt-6">
          <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <MicIcon className="size-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Speaking Live AI
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Thi thử Speaking tương tác âm thanh hai chiều thời gian thực với
              công nghệ AI Gemini và bộ lọc nhiễu âm thanh Web Audio / WASM.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <BookOpenIcon className="size-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Writing Diagnostic
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Trình soạn thảo Tiptap v3 tích hợp công cụ kiểm tra độ dài từ,
              phân tích 4 tiêu chí chấm điểm và phát hiện lỗi ngữ pháp tức thì.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <ShieldCheckIcon className="size-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              Giảng viên Chấm chữa
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Không gian chuyên sâu cho Giáo viên duyệt chấm bài, thêm chú thích
              inline annotations, và xuất bản bảng điểm chính thức.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            © {new Date().getFullYear()} IELTS Master Platform. All rights
            reserved.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/login"
              className="hover:text-foreground transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              href="/signup"
              className="hover:text-foreground transition-colors"
            >
              Đăng ký
            </Link>
            <Link
              href="/teacher/review"
              className="hover:text-foreground transition-colors"
            >
              Dành cho Giáo viên
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
