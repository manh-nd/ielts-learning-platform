import { NextRequest, NextResponse } from "next/server";
import {
  assertBetaAccess,
  withBetaTokenLease,
} from "@/modules/speaking/infrastructure/speaking-beta-access";
import { speakingPracticeRepository } from "@/modules/speaking/infrastructure/speaking-practice-repository";
import { normalizeSpeakingPracticeScope } from "@/modules/speaking/domain";
import { ForbiddenError } from "@/lib/errors";
import { geminiRotator } from "@/lib/gemini";
import { requireRole } from "@/lib/authorization";
import { toErrorResponse, AppError } from "@/lib/errors";

export const runtime = "nodejs";

export interface LiveTokenResponse {
  token: string;
  model: string;
  expiresAt: string;
}

export function buildLiveTokenPayload(expireTime: string, uses = 1) {
  return {
    expireTime,
    uses,
    liveConnectConstraints: {
      model: "models/gemini-3.8-live",
      config: { responseModalities: ["AUDIO"] },
    },
  };
}

export async function POST(req?: NextRequest) {
  try {
    const session = await requireRole("learner", req?.headers);
    const sessionId = req?.nextUrl.searchParams.get("sessionId");
    if (
      process.env.SPEAKING_BETA_ENABLED === "true" ||
      process.env.NODE_ENV === "production"
    ) {
      if (!sessionId)
        throw new ForbiddenError("An active practice is required.");
      const { practice } = await speakingPracticeRepository.findById(sessionId);
      const scope = normalizeSpeakingPracticeScope(practice?.targetPart);
      if (
        !practice ||
        practice.userId !== session.user.id ||
        practice.status !== "in_progress" ||
        !scope
      )
        throw new ForbiddenError("An owned active practice is required.");
      assertBetaAccess(session.user.id, scope);
    }

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins expiry
    const payload = buildLiveTokenPayload(expireTime, 1); // Allow session resumption reconnects

    const mint = async (key: string) => {
      // Direct REST call to Gemini Developer API v1beta auth_tokens
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to mint ephemeral token (${response.status}): ${errorText}`
        );
      }

      const data = (await response.json()) as {
        name?: string;
        token?: string;
      };
      const tokenString = data.name || data.token;

      if (!tokenString) {
        throw new Error("No token returned in auth_tokens response");
      }

      return {
        token: tokenString,
        model: "gemini-3.8-live",
        expiresAt: expireTime,
      };
    };
    const tokenData =
      process.env.SPEAKING_BETA_ENABLED === "true"
        ? await withBetaTokenLease(session.user.id, sessionId!, () =>
            mint(
              process.env.GEMINI_BETA_API_KEY ||
                (() => {
                  throw new Error("Beta Gemini credential is not configured");
                })()
            )
          )
        : await geminiRotator.executeWithRotation((_client, key) => mint(key));

    return NextResponse.json(tokenData, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[LiveTokenAPI] Error generating ephemeral token:", error);
    return NextResponse.json(
      {
        error: "Failed to create live ephemeral token",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req?: NextRequest) {
  // Allow GET requests for simple health/handshake with auth
  return POST(req);
}
