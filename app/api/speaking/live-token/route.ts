import { NextResponse } from "next/server";
import { geminiRotator } from "@/lib/gemini";

export const runtime = "nodejs";

export interface LiveTokenResponse {
  token: string;
  model: string;
  expiresAt: string;
}

export function buildLiveTokenPayload(expireTime: string, uses = 3) {
  return {
    expireTime,
    uses,
  };
}

export async function POST() {
  try {
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins expiry
    const payload = buildLiveTokenPayload(expireTime, 3); // Allow session resumption reconnects

    const tokenData = await geminiRotator.executeWithRotation(
      async (_client, key) => {
        // Direct REST call to Gemini Developer API v1alpha auth_tokens
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1alpha/auth_tokens",
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
          model: "gemini-3.1-flash-live-preview",
          expiresAt: expireTime,
        };
      }
    );

    return NextResponse.json(tokenData);
  } catch (error: unknown) {
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

export async function GET() {
  // Allow GET requests for simple health/handshake
  return POST();
}
