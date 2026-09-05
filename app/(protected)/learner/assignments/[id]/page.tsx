import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/authorization";
import { getLearnerAssignmentDetails } from "@/modules/homework/application/homework-submission-service";
import { LearnerHomeworkRecordingView } from "@/components/homework/learner-homework-recording-view";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ShieldAlertIcon } from "lucide-react";

export interface LearnerAssignmentPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: LearnerAssignmentPageProps): Promise<Metadata> {
  await params;
  return {
    title: "Làm bài tập Speaking | Chilly IELTS",
    description: "Thu âm câu trả lời cho bài tập Speaking được giao.",
  };
}

export default async function LearnerAssignmentPage({
  params,
}: LearnerAssignmentPageProps) {
  const session = await requireRoleOrRedirect(["learner", "teacher"]);
  const { id: assignmentId } = await params;

  let detail: Awaited<ReturnType<typeof getLearnerAssignmentDetails>> | null =
    null;
  let forbiddenMessage: string | null = null;

  try {
    detail = await getLearnerAssignmentDetails(session.user.id, assignmentId);
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      notFound();
    }
    if (err instanceof ForbiddenError) {
      forbiddenMessage =
        (err as Error)?.message ||
        "Bạn không phải là học viên của lớp này hoặc bài tập chưa được giao.";
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
          Không có quyền truy cập bài tập
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

  if (!detail) {
    notFound();
  }

  return (
    <div className="w-full py-2">
      <LearnerHomeworkRecordingView detail={detail} />
    </div>
  );
}
