import { NextRequest, NextResponse } from "next/server";
import { getSpeakingUploadPresignedUrl } from "@/lib/storage/s3-client";
import { requireRole } from "@/lib/authorization";
import {
  toErrorResponse,
  AppError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { speakingPracticeRepository } from "@/modules/speaking/infrastructure/speaking-practice-repository";
import { canAttachConversationReplay } from "@/modules/speaking/domain";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await requireRole("learner", req.headers);
    const authenticatedUserId = session.user.id;
    const { sessionId } = await context.params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required sessionId parameter" },
        { status: 400 }
      );
    }

    // 1. Verify practice existence & ownership
    const { practice } = await speakingPracticeRepository.findById(sessionId);
    if (!practice || practice.userId !== authenticatedUserId) {
      throw new NotFoundError("Speaking practice session not found");
    }

    // 2. Check replay attachment eligibility
    const eligibility = canAttachConversationReplay(practice.status);
    if (!eligibility.eligible) {
      throw new ForbiddenError(
        `Cannot upload conversation replay for session in status '${practice.status}' (${eligibility.reason})`
      );
    }

    const body = await req.json().catch(() => ({}));
    const mimeType = body.mimeType || "audio/wav";

    // 3. Compute canonical server-authoritative key: speaking/${cleanUserId}/${cleanSessionId}/conversation.wav
    const cleanUserId = authenticatedUserId.replace(/[^a-zA-Z0-9_-]/g, "");
    const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
    const storageKey = `speaking/${cleanUserId}/${cleanSessionId}/conversation.wav`;

    const uploadInfo = await getSpeakingUploadPresignedUrl(
      storageKey,
      mimeType
    );

    // Return uploadUrl without leaking the storage key
    return NextResponse.json({
      success: true,
      uploadUrl: uploadInfo.uploadUrl,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[ConversationReplayUploadUrlAPI] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate conversation replay upload URL",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
