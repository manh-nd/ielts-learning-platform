import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import { publishHomeworkAssessment } from "@/modules/homework/application/publish-homework-assessment";
import type { PublishAssessmentInput } from "@/modules/homework/application/homework-inputs";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teacher/submissions/:id/publish
 * Executes Single-Action Atomic Publish:
 * Finalizes assessment, freezes published record, and persists calibration metrics.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("teacher", req.headers);
    const { id: submissionId } = await params;

    if (!submissionId) {
      throw new ValidationError("Thiếu thông tin mã bài nộp.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Dữ liệu gửi lên không đúng định dạng JSON.");
    }

    if (!body || typeof body !== "object") {
      throw new ValidationError("Nội dung đánh giá không hợp lệ.");
    }

    const input = body as PublishAssessmentInput;

    const result = await publishHomeworkAssessment(
      session.user.id,
      submissionId,
      input
    );

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error(
      "[TeacherPublishAssessmentAPI] Error publishing assessment:",
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
