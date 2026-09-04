import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import {
  createTeacherClassroom,
  getTeacherClassrooms,
} from "@/modules/classroom/application/classroom-service";

export const runtime = "nodejs";

/**
 * POST /api/teacher/classrooms
 * Teacher creates a new classroom cohort.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("teacher", req.headers);

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

    if (typeof name !== "string") {
      throw new ValidationError("Tên lớp học là trường bắt buộc (string).");
    }

    if (description !== undefined && typeof description !== "string") {
      throw new ValidationError("Mô tả lớp học phải là chuỗi ký tự.");
    }

    const classroom = await createTeacherClassroom(session.user.id, {
      name,
      description: description ?? null,
    });

    return NextResponse.json(
      {
        success: true,
        classroom,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[TeacherClassroomsAPI] Error creating classroom:", error);
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
 * GET /api/teacher/classrooms
 * Lists all classrooms owned by the authenticated teacher.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("teacher", req.headers);

    const classrooms = await getTeacherClassrooms(session.user.id);

    return NextResponse.json(
      {
        success: true,
        classrooms,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[TeacherClassroomsAPI] Error listing classrooms:", error);
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
