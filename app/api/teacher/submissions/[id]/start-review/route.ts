import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import { claimHomeworkReview } from "@/modules/homework/application/claim-homework-review";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teacher/submissions/:id/start-review
 * Acquires First-Committed-Wins Concurrency Lock and marks status = 'in_review'.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("teacher", req.headers);
    const { id: submissionId } = await params;

    if (!submissionId) {
      throw new ValidationError("Thiếu thông tin mã bài nộp.");
    }

    const submission = await claimHomeworkReview(session.user.id, submissionId);

    return NextResponse.json(
      {
        success: true,
        submission,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[TeacherStartReviewAPI] Error starting review:", error);
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
