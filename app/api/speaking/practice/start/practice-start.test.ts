import { describe, it, expect } from "bun:test";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { devSessionCache } from "@/modules/speaking/infrastructure/speaking-practice-repository";

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

describe("POST /api/speaking/practice/start", () => {
  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/practice/start",
      {
        method: "POST",
        headers: createAuthHeaders(null),
        body: JSON.stringify({ topicTitle: "Test Topic" }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should reject teacher role requests with 403 Forbidden", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/practice/start",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: "teacher_01",
          role: "teacher",
          name: "Teacher Alice",
        }),
        body: JSON.stringify({ topicTitle: "Test Topic" }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("should create an in_progress session for authenticated learner", async () => {
    const sessionId = `ses_start_${Date.now()}`;
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/practice/start",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: "usr_learner_start",
          role: "learner",
          name: "Learner Bob",
        }),
        body: JSON.stringify({
          sessionId,
          topicTitle: "Hometown and Hobbies",
          targetPart: "part_1",
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.session.id).toBe(sessionId);
    expect(json.session.userId).toBe("usr_learner_start");
    expect(json.session.status).toBe("in_progress");
    expect(json.session.topicTitle).toBe("Hometown and Hobbies");

    const cached = devSessionCache.get(sessionId);
    expect(cached).toBeDefined();
    expect(cached?.status).toBe("in_progress");
  });

  it("should ignore spoofed userId in body and enforce authenticated session user.id", async () => {
    const sessionId = `ses_spoof_${Date.now()}`;
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/practice/start",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: "usr_learner_start",
          role: "learner",
          name: "Learner Bob",
        }),
        body: JSON.stringify({
          sessionId,
          userId: "spoofed_admin_victim",
          topicTitle: "Spoof Attempt",
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.session.userId).toBe("usr_learner_start");
    expect(json.session.userId).not.toBe("spoofed_admin_victim");
  });

  it("should normalize legacy wire targetPart 'part1' to canonical 'part_1'", async () => {
    const sessionId = `ses_norm_${Date.now()}`;
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/practice/start",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: "usr_learner_start",
          role: "learner",
          name: "Learner Bob",
        }),
        body: JSON.stringify({
          sessionId,
          topicTitle: "Legacy Part 1",
          targetPart: "part1",
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.session.targetPart).toBe("part_1");
  });

  it("should fallback to canonical 'part_1' when invalid or non-practice targetPart is provided", async () => {
    const sessionId = `ses_fallback_${Date.now()}`;
    const req = new NextRequest(
      "http://localhost:3000/api/speaking/practice/start",
      {
        method: "POST",
        headers: createAuthHeaders({
          id: "usr_learner_start",
          role: "learner",
          name: "Learner Bob",
        }),
        body: JSON.stringify({
          sessionId,
          topicTitle: "Invalid Target Part",
          targetPart: "full",
        }),
      }
    );

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.session.targetPart).toBe("part_1");
  });
});
