import { NextRequest, NextResponse } from "next/server";
import {
  buildSpeakingAudioStorageKey,
  getSpeakingUploadPresignedUrl,
} from "@/lib/storage/s3-client";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("learner", req.headers);
    const body = await req.json().catch(() => ({}));
    const {
      sessionId = `ses_${Date.now()}`,
      filename = "candidate.webm",
      mimeType = "audio/webm;codecs=opus",
    } = body;

    const storageKey = buildSpeakingAudioStorageKey(
      session.user.id,
      sessionId,
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
    console.error("[UploadUrlAPI] Error generating upload URL:", error);
    return NextResponse.json(
      {
        error: "Failed to generate audio upload URL",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
