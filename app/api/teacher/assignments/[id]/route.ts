import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import { getHomeworkAssignmentDetail } from "@/modules/homework/application/get-homework-assignment-detail";
import { updateHomeworkAssignment } from "@/modules/homework/application/update-homework-assignment";
import { deleteHomeworkDraft } from "@/modules/homework/application/delete-homework-draft";
import type { HomeworkAssignmentStatus } from "@/modules/homework/domain/homework-types";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/teacher/assignments/:id
 * Retrieves assignment details and student submission roster.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("teacher", req.headers);
    const { id: assignmentId } = await params;

    if (!assignmentId) {
      throw new ValidationError("Thiếu thông tin mã bài tập.");
    }

    const details = await getHomeworkAssignmentDetail(
      session.user.id,
      assignmentId
    );

    return NextResponse.json(
      {
        success: true,
        ...details,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error(
      "[TeacherAssignmentDetailsAPI] Error retrieving assignment:",
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
 * PATCH /api/teacher/assignments/:id
 * Updates assignment title, instructions, extends deadline, or transitions status (publish/archive).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("teacher", req.headers);
    const { id: assignmentId } = await params;

    if (!assignmentId) {
      throw new ValidationError("Thiếu thông tin mã bài tập.");
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

    const assignment = await updateHomeworkAssignment(
      session.user.id,
      assignmentId,
      {
        title: typeof title === "string" ? title : undefined,
        instructions:
          typeof instructions === "string"
            ? instructions
            : instructions === null
              ? null
              : undefined,
        prompts: Array.isArray(prompts)
          ? (prompts as Array<{
              promptId?: string;
              text: string;
              partNumber: 1 | 2 | 3;
              subPrompts?: string[];
            }>)
          : undefined,
        submissionDeadline:
          typeof submissionDeadline === "string" ||
          submissionDeadline instanceof Date
            ? (submissionDeadline as string | Date)
            : undefined,
        status: status as HomeworkAssignmentStatus | undefined,
      }
    );

    return NextResponse.json(
      {
        success: true,
        assignment,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error(
      "[TeacherAssignmentUpdateAPI] Error updating assignment:",
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
 * DELETE /api/teacher/assignments/:id
 * Permanently deletes an unassigned draft assignment.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("teacher", req.headers);
    const { id: assignmentId } = await params;

    if (!assignmentId) {
      throw new ValidationError("Thiếu thông tin mã bài tập.");
    }

    const result = await deleteHomeworkDraft(session.user.id, assignmentId);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error(
      "[TeacherAssignmentDeleteAPI] Error deleting draft assignment:",
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
