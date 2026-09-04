import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { findAssignmentById } from "@/modules/homework/infrastructure/homework-assignment-repository";
import { findMember } from "@/modules/classroom/infrastructure/classroom-repository";
import {
  buildHomeworkAudioStorageKey,
  getSpeakingUploadPresignedUrl,
} from "@/lib/storage/s3-client";
import {
  toErrorResponse,
  AppError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole("learner", req.headers);
    const { id: assignmentId } = await context.params;

    const assignment = await findAssignmentById(assignmentId);
    if (!assignment) {
      throw new NotFoundError("Không tìm thấy bài tập được yêu cầu.");
    }

    const member = await findMember(assignment.classroomId, session.user.id);
    if (!member) {
      throw new ForbiddenError("Bạn không phải là thành viên của lớp học này.");
    }

    if (assignment.status !== "published") {
      throw new ForbiddenError("Bài tập chưa được xuất bản.");
    }

    if (new Date().getTime() > assignment.submissionDeadline.getTime()) {
      throw new ValidationError("Đã quá hạn nộp bài tập.");
    }

    const body = await req.json().catch(() => ({}));
    const {
      promptId,
      filename = "response.webm",
      mimeType = "audio/webm;codecs=opus",
    } = body;

    if (!promptId || typeof promptId !== "string") {
      throw new ValidationError("Thiếu mã câu hỏi (promptId).");
    }

    const validPrompt = assignment.prompts.some((p) => p.promptId === promptId);
    if (!validPrompt) {
      throw new ValidationError("Mã câu hỏi không thuộc bài tập này.");
    }

    const storageKey = buildHomeworkAudioStorageKey(
      session.user.id,
      assignmentId,
      promptId,
      filename
    );

    const uploadInfo = await getSpeakingUploadPresignedUrl(
      storageKey,
      mimeType
    );

    return NextResponse.json({
      success: true,
      ...uploadInfo,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error(
      "[LearnerUploadUrlAPI] Error generating homework upload URL:",
      error
    );
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Lỗi khi tạo URL tải lên âm thanh bài tập.",
        },
      },
      { status: 500 }
    );
  }
}
