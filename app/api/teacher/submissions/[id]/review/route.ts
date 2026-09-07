import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import { getTeacherReviewCockpit } from "@/modules/homework/application/get-teacher-review-cockpit";
import { saveHomeworkReviewDraft } from "@/modules/homework/application/save-homework-review-draft";
import type { SaveAssessmentDraftInput } from "@/modules/homework/application/homework-inputs";

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

/**
 * PATCH /api/teacher/submissions/:id/review
 * Saves in-progress Teacher review draft (scores, feedback, criteria notes, annotations).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
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
      throw new ValidationError("Nội dung bản nháp không hợp lệ.");
    }

    const input = body as SaveAssessmentDraftInput;

    const teacherDraft = await saveHomeworkReviewDraft(
      session.user.id,
      submissionId,
      input
    );

    return NextResponse.json(
      {
        success: true,
        teacherDraft,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error(
      "[TeacherReviewCockpitAPI] Error saving review draft:",
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
