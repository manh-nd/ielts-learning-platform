import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import {
  createTeacherHomeworkAssignment,
  listTeacherAssignmentsByClassroom,
} from "@/modules/homework/application/homework-assignment-service";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teacher/classrooms/:id/assignments
 * Teacher creates and publishes a discrete speaking homework assignment for their classroom.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
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

    const { title, instructions, prompts, submissionDeadline, status } =
      body as {
        title?: unknown;
        instructions?: unknown;
        prompts?: unknown;
        submissionDeadline?: unknown;
        status?: unknown;
      };

    if (typeof title !== "string") {
      throw new ValidationError("Tiêu đề bài tập là bắt buộc (string).");
    }

    if (!Array.isArray(prompts)) {
      throw new ValidationError(
        "Danh sách câu hỏi (prompts) phải là một mảng."
      );
    }

    if (
      typeof submissionDeadline !== "string" &&
      !(submissionDeadline instanceof Date)
    ) {
      throw new ValidationError(
        "Hạn nộp bài (submissionDeadline) phải là chuỗi thời gian hoặc Date."
      );
    }

    const assignment = await createTeacherHomeworkAssignment(
      session.user.id,
      classroomId,
      {
        title,
        instructions:
          typeof instructions === "string"
            ? instructions
            : instructions === null
              ? null
              : undefined,
        prompts: prompts as Array<{
          promptId?: string;
          text: string;
          partNumber: 1 | 2 | 3;
          subPrompts?: string[];
        }>,
        submissionDeadline: submissionDeadline as string | Date,
        status:
          status === "published"
            ? "published"
            : status === "draft"
              ? "draft"
              : undefined,
      }
    );

    return NextResponse.json(
      {
        success: true,
        assignment,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[TeacherAssignmentsAPI] Error creating assignment:", error);
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
 * GET /api/teacher/classrooms/:id/assignments
 * Lists all homework assignments for a specific classroom.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("teacher", req.headers);
    const { id: classroomId } = await params;

    if (!classroomId) {
      throw new ValidationError("Thiếu thông tin mã lớp học.");
    }

    const assignments = await listTeacherAssignmentsByClassroom(
      session.user.id,
      classroomId
    );

    return NextResponse.json(
      {
        success: true,
        assignments,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[TeacherAssignmentsAPI] Error listing assignments:", error);
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
