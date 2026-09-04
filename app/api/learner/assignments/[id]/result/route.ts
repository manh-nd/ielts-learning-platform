import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { getLearnerPublishedAssessment } from "@/modules/homework/application/homework-submission-service";
import { toErrorResponse, AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["learner", "teacher"], req.headers);
    const { id: assignmentId } = await context.params;

    const data = await getLearnerPublishedAssessment(
      session.user.id,
      assignmentId
    );

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[LearnerAssignmentResultAPI] Error fetching result:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Lỗi hệ thống khi tải kết quả bài tập.",
        },
      },
      { status: 500 }
    );
  }
}
