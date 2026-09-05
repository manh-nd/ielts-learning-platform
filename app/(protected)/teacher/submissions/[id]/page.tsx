import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/authorization";
import { getTeacherReviewCockpit } from "@/modules/homework/application/get-teacher-review-cockpit";
import { TeacherReviewCockpit } from "@/components/homework/teacher-review-cockpit";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeftIcon, ShieldAlertIcon } from "lucide-react";

export interface TeacherSubmissionReviewPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: TeacherSubmissionReviewPageProps): Promise<Metadata> {
  await params;
  return {
    title: "Chấm bài Học viên | Chilly IELTS",
    description:
      "Không gian chấm bài Speaking và duyệt kết quả bài nộp cho Giảng viên.",
  };
}

export default async function TeacherSubmissionReviewPage({
  params,
}: TeacherSubmissionReviewPageProps) {
  const session = await requireRoleOrRedirect(["teacher"]);
  const { id: submissionId } = await params;

  let cockpitData: Awaited<ReturnType<typeof getTeacherReviewCockpit>> | null =
    null;
  let forbiddenMessage: string | null = null;

  try {
    cockpitData = await getTeacherReviewCockpit(session.user.id, submissionId);
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    if (err instanceof ForbiddenError) {
      forbiddenMessage =
        (err as Error)?.message ||
        "Bạn không có quyền quản lý lớp học hoặc chấm bài nộp này.";
    } else {
      throw err;
    }
  }

  if (forbiddenMessage) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mx-auto">
          <ShieldAlertIcon className="size-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">
          Không có quyền truy cập bài nộp
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {forbiddenMessage}
        </p>
        <div className="pt-2">
          <Link
            href="/teacher/classrooms"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "text-xs gap-1.5 inline-flex items-center"
            )}
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>Quay lại Quản lý Lớp học</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!cockpitData) {
    notFound();
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <TeacherReviewCockpit initialData={cockpitData} />
    </div>
  );
}
