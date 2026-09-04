import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/authorization";
import { getLearnerPublishedAssessment } from "@/modules/homework/application/homework-submission-service";
import { LearnerPublishedAssessmentView } from "@/components/homework/learner-published-assessment-view";
import { NotFoundError, ForbiddenError, ConflictError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ShieldAlertIcon, ClockIcon } from "lucide-react";

export interface LearnerAssignmentResultPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: LearnerAssignmentResultPageProps): Promise<Metadata> {
  await params;
  return {
    title: "Kết quả bài tập Speaking | Chilly IELTS",
    description: "Bảng điểm và nhận xét chính thức từ Giáo viên.",
  };
}

export default async function LearnerAssignmentResultPage({
  params,
}: LearnerAssignmentResultPageProps) {
  const session = await requireRoleOrRedirect(["learner", "teacher"]);
  const { id: assignmentId } = await params;

  let data: Awaited<ReturnType<typeof getLearnerPublishedAssessment>> | null =
    null;
  let forbiddenMessage: string | null = null;
  let notPublishedMessage: string | null = null;

  try {
    data = await getLearnerPublishedAssessment(session.user.id, assignmentId);
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    if (err instanceof ForbiddenError) {
      forbiddenMessage =
        (err as Error)?.message ||
        "Bạn không phải là thành viên của lớp học này hoặc bài tập chưa được giao.";
    } else if (err instanceof ConflictError) {
      notPublishedMessage =
        (err as Error)?.message ||
        "Bài làm chưa được Giáo viên xuất bản kết quả đánh giá.";
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
          Không có quyền truy cập kết quả
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {forbiddenMessage}
        </p>
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/learner/dashboard" />}
            className="gap-1.5 text-xs"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>Quay lại Bảng điều khiển</span>
          </Button>
        </div>
      </div>
    );
  }

  if (notPublishedMessage) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto">
          <ClockIcon className="size-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">
          Kết quả đang được xử lý
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {notPublishedMessage}
        </p>
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/learner/assignments/${assignmentId}`} />}
            className="gap-1.5 text-xs"
          >
            <ArrowLeftIcon className="size-3.5" />
            <span>Quay lại bài làm</span>
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  return (
    <div className="w-full py-2">
      <LearnerPublishedAssessmentView data={data} />
    </div>
  );
}
