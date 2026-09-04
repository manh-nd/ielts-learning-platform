import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { submitLearnerHomeworkAttempt } from "@/modules/homework/application/homework-submission-service";
import { toErrorResponse, AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("learner", req.headers);
    const { id: assignmentId } = await context.params;

    const body = await req.json().catch(() => ({}));
    const result = await submitLearnerHomeworkAttempt(
      session.user.id,
      assignmentId,
      body
    );

    return NextResponse.json(
      {
        success: true,
        submission: result.submission,
        attempt: result.attempt,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[LearnerSubmitAPI] Error submitting attempt:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Lỗi hệ thống khi nộp bài tập.",
        },
      },
      { status: 500 }
    );
  }
}
