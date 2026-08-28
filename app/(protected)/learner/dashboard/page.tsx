import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/authorization";
import {
  MicIcon,
  BookOpenIcon,
  SparklesIcon,
  TrendingUpIcon,
  ClockIcon,
  ArrowRightIcon,
  AwardIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Bảng điều khiển Học viên | IELTS Master",
  description: "Trung tâm luyện thi IELTS AI và theo dõi tiến độ học tập.",
};

export default async function LearnerDashboardPage() {
  const session = await requireRoleOrRedirect(["learner", "teacher"]);
  const isTeacherPreview = session.user.role === "teacher";

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/15 via-primary/5 to-muted/20 border border-primary/20 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Xin chào, {session.user.name}! 👋
              </h1>
              {isTeacherPreview && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs"
                >
                  Xem trước (Giáo viên)
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Chào mừng bạn đến với lộ trình luyện thi IELTS cá nhân hóa. Hãy
              bắt đầu một buổi luyện Speaking tương tác AI hoặc nộp bài luận
              Writing hôm nay.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-card/80 border border-border/70 rounded-xl p-3.5 shadow-xs backdrop-blur-xs">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <AwardIcon className="size-5" />
            </div>
            <div>
              <span className="text-[0.68rem] uppercase font-semibold text-muted-foreground tracking-wider">
                Mục tiêu Band
              </span>
              <div className="text-xl font-extrabold text-foreground">
                7.5{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / 9.0
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Practice Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Speaking Practice Card */}
        <div
          id="speaking"
          className="group rounded-xl border border-border/70 bg-card p-6 shadow-xs transition-all hover:border-primary/50 hover:shadow-md space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <MicIcon className="size-5" />
            </div>
            <Badge
              variant="outline"
              className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs"
            >
              Phòng thi Trực tiếp
            </Badge>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              IELTS Speaking Live AI Examiner
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Thi thử Speaking 1:1 với Giám khảo ảo AI qua đàm thoại âm thanh
              hai chiều thời gian thực (Full Part 1, 2, 3), kèm chấm điểm 4 tiêu
              chí chuẩn IDP/BC.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="size-3.5 text-emerald-500" />
              Lọc tiếng ồn thông minh
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="size-3.5 text-emerald-500" />
              Chấm điểm theo Band
            </span>
          </div>

          <div className="pt-2">
            <Button
              render={<Link href="/learner/speaking/live" />}
              className="w-full justify-center gap-1.5 h-9 text-xs font-medium cursor-pointer"
            >
              <SparklesIcon className="size-3.5" />
              <span>Bắt đầu phòng thi Speaking Live</span>
              <ArrowRightIcon className="size-3.5 ml-auto" />
            </Button>
          </div>
        </div>

        {/* Writing Practice Card */}
        <div
          id="writing"
          className="group rounded-xl border border-border/70 bg-card p-6 shadow-xs transition-all hover:border-primary/50 hover:shadow-md space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <BookOpenIcon className="size-5" />
            </div>
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs"
            >
              AI Chấm chữa
            </Badge>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              IELTS Writing Essay Assessment
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Soạn thảo bài viết Task 1 & Task 2 trên trình soạn thảo hiện đại,
              nhận phân tích ngữ pháp, từ vựng C1-C2 và phản hồi chi tiết từ
              Giảng viên.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="size-3.5 text-emerald-500" />
              Đếm từ & Giới hạn thời gian
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2Icon className="size-3.5 text-emerald-500" />
              Highlight lỗi & gợi ý
            </span>
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              className="w-full justify-center gap-1.5 h-9 text-xs font-medium cursor-pointer"
            >
              <BookOpenIcon className="size-3.5" />
              <span>Luyện viết đề thi mới</span>
              <ArrowRightIcon className="size-3.5 ml-auto" />
            </Button>
          </div>
        </div>
      </div>

      {/* Progress & Recent Sessions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Band Overview */}
        <div className="rounded-xl border border-border/70 bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Tổng quan Kỹ năng
            </h3>
            <TrendingUpIcon className="size-4 text-primary" />
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">
                  Speaking (Trôi chảy & Phát âm)
                </span>
                <span className="font-semibold text-foreground">Band 6.5</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: "72%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">
                  Writing (Task Response & Ngữ pháp)
                </span>
                <span className="font-semibold text-foreground">Band 6.5</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: "72%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Practice List */}
        <div className="lg:col-span-2 rounded-xl border border-border/70 bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Lịch sử Luyện tập gần đây
            </h3>
            <span className="text-xs text-muted-foreground">
              3 bài gần nhất
            </span>
          </div>

          <div className="divide-y divide-border/40">
            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
                  <MicIcon className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Speaking Test: Technology & Work
                  </div>
                  <div className="text-[0.68rem] text-muted-foreground flex items-center gap-1">
                    <ClockIcon className="size-3" /> 2 giờ trước • Part 1 & 2
                  </div>
                </div>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs"
              >
                Band 6.5
              </Badge>
            </div>

            <div className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
                  <BookOpenIcon className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    Writing Task 2: Compulsory Community Service
                  </div>
                  <div className="text-[0.68rem] text-muted-foreground flex items-center gap-1">
                    <ClockIcon className="size-3" /> Hôm qua • 285 từ
                  </div>
                </div>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs"
              >
                Band 7.0 (Đã chấm)
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
