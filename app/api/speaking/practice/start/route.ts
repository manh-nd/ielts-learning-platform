import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError, ValidationError } from "@/lib/errors";
import { speakingPracticeRepository } from "@/modules/speaking/infrastructure/speaking-practice-repository";
import {
  normalizeSpeakingPracticeScope,
  CANONICAL_SPEAKING_PRACTICE_SCOPE,
  SpeakingPracticeScope,
} from "@/modules/speaking/domain";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("learner", req.headers);
    const body = await req.json().catch(() => ({}));
    const {
      sessionId = `ses_${crypto.randomUUID()}`,
      topicTitle = "IELTS Speaking Examination",
    } = body;

    let targetPart: SpeakingPracticeScope = CANONICAL_SPEAKING_PRACTICE_SCOPE;
    if (body.targetPart !== undefined && body.targetPart !== null) {
      const normalized = normalizeSpeakingPracticeScope(body.targetPart);
      if (!normalized) {
        throw new ValidationError(
          `Invalid targetPart '${body.targetPart}'. SpeakingPractice only supports Part 1 practice ('part_1'). Full Mock and other scopes are not permitted.`
        );
      }
      targetPart = normalized;
    }

    const record = await speakingPracticeRepository.createInProgress({
      sessionId,
      userId: session.user.id,
      candidateName: session.user.name || null,
      topicTitle,
      targetPart,
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
