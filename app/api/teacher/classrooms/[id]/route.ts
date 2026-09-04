import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import { updateTeacherClassroom } from "@/modules/classroom/application/classroom-service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/teacher/classrooms/:id
 * Teacher updates classroom name and/or description.
 * Enforces Single-Teacher ownership invariant (Ticket #53, ADR-0009).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("teacher", req.headers);
    const { id: classroomId } = await params;

    if (!classroomId) {
      throw new ValidationError("Thiếu thông tin mã lớp học.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Dữ liệu gửi lên không đúng định dạng JSON.");
    }

    if (!body || typeof body !== "object") {
      throw new ValidationError("Nội dung yêu cầu không hợp lệ.");
    }

    const { name, description } = body as {
      name?: unknown;
      description?: unknown;
    };

    if (name !== undefined && typeof name !== "string") {
      throw new ValidationError("Tên lớp học phải là chuỗi ký tự.");
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      throw new ValidationError("Mô tả lớp học phải là chuỗi ký tự hoặc null.");
    }

    const updated = await updateTeacherClassroom(session.user.id, classroomId, {
      name: name !== undefined ? name : undefined,
      description:
        description !== undefined ? (description as string | null) : undefined,
    });

    return NextResponse.json({
      success: true,
      classroom: updated,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[TeacherClassroomUpdateAPI] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Đã xảy ra lỗi hệ thống khi cập nhật lớp học.",
        },
      },
      { status: 500 }
    );
  }
}
