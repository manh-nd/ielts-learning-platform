import { describe, it, expect, mock } from "bun:test";
import { buildLiveTokenPayload, POST, GET } from "./route";
import { NextRequest } from "next/server";
import { geminiRotator } from "@/lib/gemini";

function createAuthHeaders(
  user?: {
    id: string;
    role: "learner" | "teacher";
    name?: string;
    email?: string;
  } | null
): Headers {
  const headers = new Headers();
  if (user) {
    const session = {
      id: `sess_${user.id}`,
      userId: user.id,
      token: `token_${user.id}`,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const payload = JSON.stringify({ user, session });
    headers.set("cookie", `e2e_mock_session=${encodeURIComponent(payload)}`);
  }
  headers.set("content-type", "application/json");
  return headers;
}

describe("Live Token API (Ephemeral Token)", () => {
  it("should build auth token payload with valid expireTime and uses for Gemini v1alpha", () => {
    const expireTime = "2026-08-27T20:00:00.000Z";
    const payload = buildLiveTokenPayload(expireTime, 3);

    expect(payload.expireTime).toBe(expireTime);
    expect(payload.uses).toBe(3);
  });

  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/live-token",
      {
        method: "POST",
        headers: createAuthHeaders(null),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should reject teacher role requests with 403 Forbidden", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/live-token",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: "teacher_01",
          role: "teacher",
          name: "Teacher Test",
          email: "teacher@test.com",
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("should allow authenticated learner requests and mint token", async () => {
    const originalExecute = geminiRotator.executeWithRotation;
    geminiRotator.executeWithRotation = mock(async () => ({
      token: "mock-ephemeral-token",
      model: "gemini-3.1-flash-live-preview",
      expiresAt: "2026-08-31T20:00:00.000Z",
    })) as unknown as typeof geminiRotator.executeWithRotation;

    try {
      const req = new NextRequest(
        "http://localhost:3000/api/speaking/live-token",
        {
          method: "POST",
          headers: createAuthHeaders({
            id: "learner_01",
            role: "learner",
            name: "Learner Test",
            email: "learner@test.com",
          }),
        }
      );

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.token).toBe("mock-ephemeral-token");

      // Also verify GET handler works identically
      const getReq = new NextRequest(
        "http://localhost:3000/api/speaking/live-token",
        {
          method: "GET",
          headers: createAuthHeaders({
            id: "learner_01",
            role: "learner",
            name: "Learner Test",
            email: "learner@test.com",
          }),
        }
      );
      const getRes = await GET(getReq);
      expect(getRes.status).toBe(200);
    } finally {
      geminiRotator.executeWithRotation = originalExecute;
    }
  });
});
