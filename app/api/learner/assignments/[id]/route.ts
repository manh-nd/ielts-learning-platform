import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { getLearnerAssignmentDetails } from "@/modules/homework/application/homework-submission-service";
import { toErrorResponse, AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["learner", "teacher"], req.headers);
    const { id: assignmentId } = await context.params;

    const details = await getLearnerAssignmentDetails(
      session.user.id,
      assignmentId
    );

    return NextResponse.json({
      success: true,
      ...details,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[LearnerAssignmentAPI] Error fetching assignment:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Lỗi hệ thống khi tải thông tin bài tập.",
        },
      },
      { status: 500 }
    );
  }
}
