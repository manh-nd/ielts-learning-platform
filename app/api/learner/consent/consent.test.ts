import { describe, it, expect } from "bun:test";
import { POST, GET, devConsentCache } from "./route";
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

describe("Learner Consent API", () => {
  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/learner/consent", {
      method: "POST",
      headers: createAuthHeaders(null),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should reject teacher role requests with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/learner/consent", {
      method: "POST",
      headers: createAuthHeaders({
        id: "teacher_01",
        role: "teacher",
        name: "Teacher Test",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("should allow authenticated learner to record consent", async () => {
    const learnerId = "learner_consent_01";
    devConsentCache.delete(learnerId);

    const postReq = new NextRequest(
      "http://localhost:3000/api/learner/consent",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: learnerId,
          role: "learner",
          name: "Learner Consent",
        }),
      }
    );

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.success).toBe(true);
    expect(postData.userId).toBe(learnerId);
    expect(postData.consentFreeTierAt).toBeDefined();

    // Query back with GET
    const getReq = new NextRequest(
      "http://localhost:3000/api/learner/consent",
      {
        method: "GET",
        headers: createAuthHeaders({
          id: learnerId,
          role: "learner",
          name: "Learner Consent",
        }),
      }
    );

    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.hasConsent).toBe(true);
    expect(getData.consentFreeTierAt).toBeDefined();
  });
});
