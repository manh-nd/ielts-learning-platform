import { Metadata } from "next";
import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/authorization";
import { listLearnerAssignments } from "@/modules/homework/application/get-learner-homework";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BookOpenIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  ArrowRightIcon,
  SparklesIcon,
  LayersIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Bài tập Speaking (Homework) | Chilly IELTS",
  description:
    "Danh sách các bài tập IELTS Speaking được giao từ lớp học của bạn.",
};

function formatDeadline(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function LearnerAssignmentsPage() {
  const session = await requireRoleOrRedirect(["learner", "teacher"]);
  const items = await listLearnerAssignments(session.user.id);
  const now = new Date();

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary text-xs font-semibold"
              >
                Bài tập Lớp học
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {items.length} bài tập
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Bài tập Speaking (Homework)
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Các bài tập Speaking do giáo viên giao trong lớp học. Thu âm các
              câu trả lời để nộp bài và nhận phản hồi, nhận xét chi tiết từ giáo
              viên.
            </p>
          </div>

          <div className="shrink-0">
            <Link
              href="/learner/speaking/live"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-1.5 text-xs font-medium"
              )}
            >
              <SparklesIcon className="size-3.5 text-primary" />
              <span>Luyện Speaking Tự do</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Assignment List */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center space-y-4 bg-muted/10">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
            <BookOpenIcon className="size-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-semibold text-foreground">
              Chưa có bài tập nào được giao
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Hiện tại bạn chưa có bài tập Speaking nào cần làm. Hãy tham gia
              lớp học hoặc bắt đầu luyện tập tự do với Giám khảo AI ngay hôm
              nay.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/learner/speaking/live"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "gap-1.5 text-xs"
              )}
            >
              <SparklesIcon className="size-3.5" />
              <span>Bắt đầu Luyện Speaking AI</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(
            ({ assignment, classroom, submissionStatus, publishedScore }) => {
              const deadline = new Date(assignment.submissionDeadline);
              const isOverdue = deadline.getTime() < now.getTime();
              const isSubmitted =
                submissionStatus === "submitted" ||
                submissionStatus === "in_review" ||
                submissionStatus === "published";

              return (
                <Card
                  key={assignment.id}
                  className="transition-all border py-0 gap-0 overflow-hidden shadow-xs hover:border-primary/50 flex flex-col justify-between"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono"
                          >
                            {classroom.name}
                          </Badge>
                          {submissionStatus === "published" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                              <CheckCircle2Icon className="size-3 mr-1" />
                              Đã có nhận xét{" "}
                              {publishedScore ? `• Band ${publishedScore}` : ""}
                            </Badge>
                          ) : isSubmitted ? (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]"
                            >
                              <ClockIcon className="size-3 mr-1" />
                              Đã nộp • Chờ chấm
                            </Badge>
                          ) : isOverdue ? (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              Quá hạn nộp
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Chưa nộp
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base font-bold text-foreground pt-1">
                          {assignment.title}
                        </CardTitle>
                      </div>
                    </div>
                    {assignment.instructions && (
                      <CardDescription className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {assignment.instructions}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="px-5 py-3 border-t bg-muted/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <LayersIcon className="size-3.5" />
                        {assignment.prompts.length} câu hỏi
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="size-3.5" />
                        Hạn: {formatDeadline(deadline)}
                      </span>
                    </div>

                    <Link
                      href={`/learner/assignments/${assignment.id}`}
                      className={cn(
                        buttonVariants({
                          variant:
                            submissionStatus === "published"
                              ? "outline"
                              : "default",
                          size: "sm",
                        }),
                        "gap-1.5 text-xs h-8"
                      )}
                    >
                      <span>
                        {submissionStatus === "published"
                          ? "Xem kết quả"
                          : isSubmitted
                            ? "Xem bài nộp"
                            : "Làm bài tập"}
                      </span>
                      <ArrowRightIcon className="size-3" />
                    </Link>
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
