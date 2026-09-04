import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import { user } from "@/modules/identity/infrastructure/auth-schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// In-memory dev fallback when DATABASE_URL is not set (e.g. unit tests or local dev without Postgres)
export const devConsentCache = new Map<string, Date>();

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("learner", req.headers);
    const userId = session.user.id;
    const consentDate = new Date();

    if (process.env.DATABASE_URL) {
      try {
        await db
          .update(user)
          .set({
            consentFreeTierAt: consentDate,
            updatedAt: consentDate,
          })
          .where(eq(user.id, userId));
      } catch (dbErr) {
        console.warn("[ConsentAPI] Database update warning:", dbErr);
      }
    }

    devConsentCache.set(userId, consentDate);

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

    let consentDate: Date | null = null;

    if (process.env.DATABASE_URL) {
      try {
        const rows = await db
          .select({ consentFreeTierAt: user.consentFreeTierAt })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);
        if (rows.length > 0 && rows[0].consentFreeTierAt) {
          consentDate = rows[0].consentFreeTierAt;
        }
      } catch (dbErr) {
        console.warn("[ConsentAPI] Database query warning:", dbErr);
      }
    }

    if (!consentDate && devConsentCache.has(userId)) {
      consentDate = devConsentCache.get(userId)!;
    }

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
