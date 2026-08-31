import { describe, it, expect } from "bun:test";
import { POST } from "./route";
import { NextRequest } from "next/server";

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

describe("Upload URL API Endpoint", () => {
  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/upload-url",
      {
        method: "POST",
        headers: createAuthHeaders(null),
        body: JSON.stringify({ sessionId: "ses_123" }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should reject teacher role requests with 403 Forbidden", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/upload-url",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: "teacher_01",
          role: "teacher",
          name: "Teacher Test",
          email: "teacher@test.com",
        }),
        body: JSON.stringify({ sessionId: "ses_123" }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("should generate storage key bound to authenticated learner user.id", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/upload-url",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: "usr_learner_real",
          role: "learner",
          name: "Real Learner",
          email: "learner@test.com",
        }),
        body: JSON.stringify({
          sessionId: "ses_test_abc",
          filename: "candidate.webm",
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.storageKey).toBe(
      "speaking/usr_learner_real/ses_test_abc/candidate.webm"
    );
  });

  it("should ignore spoofed userId in body and enforce authenticated session user.id", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/upload-url",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: "usr_learner_real",
          role: "learner",
          name: "Real Learner",
          email: "learner@test.com",
        }),
        body: JSON.stringify({
          userId: "spoofed_admin_victim", // Client tries to spoof another user
          sessionId: "ses_test_abc",
          filename: "candidate.webm",
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    // Key MUST use authenticated user id, NOT spoofed userId
    expect(data.storageKey).toBe(
      "speaking/usr_learner_real/ses_test_abc/candidate.webm"
    );
    expect(data.storageKey).not.toContain("spoofed_admin_victim");
  });
});
