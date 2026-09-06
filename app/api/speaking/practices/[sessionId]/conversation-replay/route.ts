import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError } from "@/lib/errors";
import { attachConversationReplay } from "@/modules/speaking/application/attach-conversation-replay";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await requireRole("learner", req.headers);
    const authenticatedUserId = session.user.id;
    const { sessionId } = await context.params;

    const body = await req.json().catch(() => ({}));
    const durationSeconds =
      typeof body.durationSeconds === "number"
        ? body.durationSeconds
        : undefined;

    const result = await attachConversationReplay({
      authenticatedUserId,
      sessionId,
      durationSeconds,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[AttachConversationReplayAPI] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to attach conversation replay",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
