import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/authorization";
import {
  MicIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Bảng điều khiển Học viên | Chilly IELTS",
  description: "Không gian luyện IELTS Speaking dành cho học viên.",
};

export default async function LearnerDashboardPage() {
  const session = await requireRoleOrRedirect(["learner", "teacher"]);
  const isTeacherPreview = session.user.role === "teacher";

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Xin chào, {session.user.name}! 👋
            </h1>
            {isTeacherPreview && (
              <Badge variant="secondary" className="text-xs">
                Xem trước (Giáo viên)
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            Chào mừng bạn đến với nền tảng luyện thi IELTS. Hãy bắt đầu buổi
            luyện Speaking tương tác cùng AI hôm nay.
          </p>
        </div>
      </div>

      {/* Speaking Practice Card */}
      <div className="max-w-xl">
        <div
          id="speaking"
          className="group rounded-xl border border-border/70 bg-card p-6 shadow-xs transition-all hover:border-primary/50 hover:shadow-md space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MicIcon className="size-5" />
            </div>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 text-xs"
            >
              Luyện tập Trực tiếp
            </Badge>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              IELTS Speaking Practice
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Luyện phản xạ nói 1-on-1 với AI qua đàm thoại âm thanh hai chiều
              theo các chủ đề Part 1, nhận nhận xét và bản chép lời chi tiết sau
              buổi luyện.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="size-3.5 text-primary" />
              Đàm thoại âm thanh hai chiều
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="size-3.5 text-primary" />
              Nhận xét sau buổi luyện
            </span>
          </div>

          <div className="pt-2">
            <Button
              render={<Link href="/learner/speaking/live" />}
              className="w-full justify-center gap-1.5 h-9 text-xs font-medium cursor-pointer"
            >
              <SparklesIcon className="size-3.5" />
              <span>Bắt đầu buổi luyện tập Speaking</span>
              <ArrowRightIcon className="size-3.5 ml-auto" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
