import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import {
  addLearnerMembership,
  getClassroomRoster,
  removeLearnerMembership,
} from "@/modules/classroom/application/classroom-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

/**
 * POST /api/teacher/classrooms/:id/members
 * Teacher enrolls a learner into the classroom by email.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole("teacher", req.headers);
    const resolvedParams = await Promise.resolve(context.params);
    const classroomId = resolvedParams?.id;

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

    const { email } = body as { email?: unknown };

    if (typeof email !== "string") {
      throw new ValidationError("Email học viên là trường bắt buộc (string).");
    }

    const member = await addLearnerMembership(
      session.user.id,
      classroomId,
      email
    );

    return NextResponse.json(
      {
        success: true,
        member,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[ClassroomMembersAPI] Error enrolling member:", error);
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
 * GET /api/teacher/classrooms/:id/members
 * Lists all enrolled members of the classroom.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole("teacher", req.headers);
    const resolvedParams = await Promise.resolve(context.params);
    const classroomId = resolvedParams?.id;

    if (!classroomId) {
      throw new ValidationError("Thiếu thông tin mã lớp học.");
    }

    const members = await getClassroomRoster(session.user.id, classroomId);

    return NextResponse.json(
      {
        success: true,
        members,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[ClassroomMembersAPI] Error listing members:", error);
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
 * DELETE /api/teacher/classrooms/:id/members
 * Removes a learner from the classroom roster.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole("teacher", req.headers);
    const resolvedParams = await Promise.resolve(context.params);
    const classroomId = resolvedParams?.id;

    if (!classroomId) {
      throw new ValidationError("Thiếu thông tin mã lớp học.");
    }

    let learnerId = req.nextUrl.searchParams.get("learnerId");

    if (!learnerId) {
      try {
        const body = (await req.json()) as { learnerId?: string };
        learnerId = body?.learnerId || null;
      } catch {
        // Body optional if query param used
      }
    }

    if (!learnerId) {
      throw new ValidationError("Thiếu thông tin learnerId cần xóa.");
    }

    const result = await removeLearnerMembership(
      session.user.id,
      classroomId,
      learnerId
    );

    return NextResponse.json(
      {
        success: true,
        message: result.message,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[ClassroomMembersAPI] Error removing member:", error);
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
