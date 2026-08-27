import { NextRequest, NextResponse } from "next/server";
import {
  saveDirectAudioDevFallback,
  getDirectAudioDevFallback,
} from "@/lib/storage/s3-client";

export const runtime = "nodejs";

// PUT handler: receives raw audio stream or blob and stores in dev cache
export async function PUT(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json(
        { error: "Missing storage key" },
        { status: 400 }
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
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json(
        { error: "Missing storage key" },
        { status: 400 }
      );
    }

    const item = await getDirectAudioDevFallback(key);
    if (!item) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(item.data), {
      status: 200,
      headers: {
        "Content-Type": item.mimeType,
        "Content-Length": String(item.data.byteLength),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Direct audio retrieval failed", message: String(err) },
      { status: 500 }
    );
  }
}
