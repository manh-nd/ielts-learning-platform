import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, NotFoundError } from "@/lib/errors";
import { resolveTeacherReviewAudioClip } from "@/modules/homework/application/resolve-teacher-review-audio-clip";
import { getSpeakingAudioBuffer } from "@/lib/storage/s3-client";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string; promptId: string }>;
}

/**
 * GET /api/teacher/submissions/:id/audio/:promptId
 * Serves the authoritative recorded audio response clip for teacher inspection.
 * Enforces strict authorization order:
 * 1. Authenticate teacher session
 * 2. Authorize teacher owns the submission's classroom
 * 3. Resolve authoritative review attempt
 * 4. Resolve promptId to an actual clip in that attempt
 * 5. Stream the full audio buffer with private, no-store headers (storageKey is never exposed to client)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireRole("teacher", req.headers);
    const { id: submissionId, promptId } = await params;

    // Delegate authorization and attempt resolution to application use case
    const resolvedClip = await resolveTeacherReviewAudioClip(
      session.user.id,
      submissionId,
      promptId
    );

    // Fetch binary from infrastructure (S3 or dev cache)
    const audioData = await getSpeakingAudioBuffer(resolvedClip.storageKey);
    if (!audioData) {
      throw new NotFoundError("Không thể tải tệp âm thanh từ bộ lưu trữ.");
    }

    return new NextResponse(new Uint8Array(audioData.buffer), {
      status: 200,
      headers: {
        "Content-Type": audioData.mimeType || "audio/webm",
        "Content-Length": String(audioData.buffer.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error(
      "[TeacherReviewAudioAPI] Unexpected error streaming audio:",
      error
    );
    return NextResponse.json(
      {
        error: {
          message: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        },
      },
      { status: 500 }
    );
  }
}
