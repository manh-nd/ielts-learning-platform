import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError } from "@/lib/errors";
import { startPractice } from "@/modules/speaking/application/start-practice";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("learner", req.headers);
    const body = await req.json().catch(() => ({}));
    const {
      sessionId = `ses_${crypto.randomUUID()}`,
      topicTitle = "IELTS Speaking Examination",
    } = body;

    const record = await startPractice({
      sessionId,
      userId: session.user.id,
      candidateName: session.user.name || "Learner",
      topicTitle,
      topicId: body.topicId,
      targetPart: body.targetPart,
    });

    return NextResponse.json({
      success: true,
      session: record,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[PracticeStartAPI] Error starting speaking session:", error);
    return NextResponse.json(
      {
        error: "Failed to start speaking practice session",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
