import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import { getTeacherReviewCockpit } from "@/modules/homework/application/homework-review-service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teacher/submissions/:id/review
 * Retrieves full review cockpit data for teacher inspection and scoring.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("teacher", req.headers);
    const { id: submissionId } = await params;

    if (!submissionId) {
      throw new ValidationError("Thiếu thông tin mã bài nộp.");
    }

    const cockpitData = await getTeacherReviewCockpit(
      session.user.id,
      submissionId
    );

    return NextResponse.json(
      {
        success: true,
        ...cockpitData,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error(
      "[TeacherReviewCockpitAPI] Error retrieving review cockpit:",
      error
    );
    return NextResponse.json(
      {
        error: {
          message: (error as Error)?.message || "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        },
      },
      { status: 500 }
    );
  }
}
