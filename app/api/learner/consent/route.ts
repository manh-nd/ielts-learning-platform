import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError } from "@/lib/errors";
import {
  recordLearnerConsent,
  getLearnerConsentDate,
} from "@/modules/identity/application/learner-consent";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("learner", req.headers);
    const userId = session.user.id;
    const consentDate = await recordLearnerConsent(userId);

    return NextResponse.json({
      success: true,
      userId,
      consentFreeTierAt: consentDate.toISOString(),
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[ConsentAPI] Error updating consent:", error);
    return NextResponse.json(
      {
        error: "Failed to record consent",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("learner", req.headers);
    const userId = session.user.id;
    const consentDate = await getLearnerConsentDate(userId);

    return NextResponse.json({
      success: true,
      hasConsent: Boolean(consentDate),
      consentFreeTierAt: consentDate ? consentDate.toISOString() : null,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    return NextResponse.json(
      {
        error: "Failed to query consent",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
