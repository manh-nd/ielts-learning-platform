import { NextRequest, NextResponse } from "next/server";
import { getSpeakingAudioBuffer } from "@/lib/storage/s3-client";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, NotFoundError } from "@/lib/errors";
import { speakingPracticeRepository } from "@/modules/speaking/infrastructure/speaking-practice-repository";

export const runtime = "nodejs";

export async function GET(
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

    // 1. Verify practice existence and learner ownership
    const { practice } = await speakingPracticeRepository.findById(sessionId);
    if (!practice || practice.userId !== authenticatedUserId) {
      throw new NotFoundError("Speaking practice session not found");
    }

    // 2. Reject if audio is purged or storage key is missing
    if (
      practice.status === "audio_purged" ||
      !practice.conversationReplayStorageKey
    ) {
      throw new NotFoundError("Conversation audio is no longer available");
    }

    // 3. Fetch binary buffer from storage
    const audioData = await getSpeakingAudioBuffer(
      practice.conversationReplayStorageKey
    );
    if (!audioData || !audioData.buffer || audioData.buffer.length === 0) {
      throw new NotFoundError("Conversation audio file not found in storage");
    }

    const mimeType =
      practice.conversationReplayMimeType || audioData.mimeType || "audio/wav";
    const buffer = audioData.buffer;
    const totalBytes = buffer.length;

    // 4. Support HTTP Range requests (crucial for seekable playback in browser Audio element)
    const rangeHeader = req.headers.get("range");
    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalBytes - 1;

      if (start >= totalBytes || end >= totalBytes || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${totalBytes}`,
          },
        });
      }

      const chunk = buffer.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${totalBytes}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.length),
          "Content-Type": mimeType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(totalBytes),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[ConversationAudioAPI] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to stream conversation audio",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
