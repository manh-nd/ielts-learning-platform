import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import { deleteSpeakingPractice } from "@/modules/speaking/application/delete-speaking-practice";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await requireRole("learner", req.headers);
    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams?.id;

    if (!id) {
      throw new ValidationError("Missing required practice session id");
    }

    const result = await deleteSpeakingPractice({
      sessionId: id,
      authenticatedUserId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Speaking practice permanently deleted",
      deletedId: result.sessionId,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[PracticeDeleteAPI] Error deleting practice:", error);
    return NextResponse.json(
      {
        error: "Failed to delete speaking practice",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
