import { NextRequest, NextResponse } from "next/server";
import {
  saveDirectAudioDevFallback,
  getDirectAudioDevFallback,
  isSpeakingAudioStorageKeyOwnedBy,
} from "@/lib/storage/s3-client";
import { requireRole } from "@/lib/authorization";
import {
  toErrorResponse,
  AppError,
  ValidationError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";

export const runtime = "nodejs";

// PUT handler: receives raw audio stream or blob and stores in dev cache
export async function PUT(req: NextRequest) {
  try {
    const session = await requireRole("learner", req.headers);
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      throw new ValidationError("Missing storage key");
    }

    if (!isSpeakingAudioStorageKeyOwnedBy(key, session.user.id)) {
      throw new ForbiddenError(
        "Cannot upload audio to a storage key belonging to another user."
      );
    }

    const contentType = req.headers.get("content-type") || "audio/webm";
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await saveDirectAudioDevFallback(key, buffer, contentType);

    return new NextResponse(null, {
      status: 200,
      headers: {
        ETag: `"${Date.now()}"`,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return toErrorResponse(err);
    }
    console.error("[UploadDirectAPI] Error handling direct upload:", err);
    return NextResponse.json(
      { error: "Direct upload failed", message: String(err) },
      { status: 500 }
    );
  }
}

// GET handler: serves raw audio for playback in dev/test
export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("learner", req.headers);
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      throw new ValidationError("Missing storage key");
    }

    if (!isSpeakingAudioStorageKeyOwnedBy(key, session.user.id)) {
      throw new ForbiddenError(
        "Cannot access audio belonging to another user."
      );
    }

    const item = await getDirectAudioDevFallback(key);
    if (!item) {
      throw new NotFoundError("Audio not found");
    }

    return new NextResponse(new Uint8Array(item.data), {
      status: 200,
      headers: {
        "Content-Type": item.mimeType,
        "Content-Length": String(item.data.byteLength),
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return toErrorResponse(err);
    }
    return NextResponse.json(
      { error: "Direct audio retrieval failed", message: String(err) },
      { status: 500 }
    );
  }
}
