import { describe, it, expect } from "bun:test";
import { PUT, GET } from "./route";
import { NextRequest } from "next/server";

function createAuthHeaders(
  user?: {
    id: string;
    role: "learner" | "teacher";
    name?: string;
    email?: string;
  } | null,
  contentType = "audio/webm"
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
  headers.set("content-type", contentType);
  return headers;
}

describe("Upload Direct (Dev Fallback) API Endpoint", () => {
  const learnerA = {
    id: "usr_learner_a",
    role: "learner" as const,
    name: "Learner A",
    email: "learner_a@test.com",
  };

  const learnerB = {
    id: "usr_learner_b",
    role: "learner" as const,
    name: "Learner B",
    email: "learner_b@test.com",
  };

  const teacher = {
    id: "usr_teacher_01",
    role: "teacher" as const,
    name: "Teacher One",
    email: "teacher@test.com",
  };

  it("should reject unauthenticated PUT and GET with 401 Unauthorized", async () => {
    const putReq = new NextRequest(
      "http://localhost:3000/api/speaking/upload-direct?key=speaking/usr_learner_a/ses_1/candidate.webm",
      {
        method: "PUT",
        headers: createAuthHeaders(null),
        body: Buffer.from("audio-bytes"),
      }
    );
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(401);

    const getReq = new NextRequest(
      "http://localhost:3000/api/speaking/upload-direct?key=speaking/usr_learner_a/ses_1/candidate.webm",
      {
        method: "GET",
        headers: createAuthHeaders(null),
      }
    );
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(401);
  });

  it("should reject teacher role requests with 403 Forbidden", async () => {
    const putReq = new NextRequest(
      "http://localhost:3000/api/speaking/upload-direct?key=speaking/usr_learner_a/ses_1/candidate.webm",
      {
        method: "PUT",
        headers: createAuthHeaders(teacher),
        body: Buffer.from("audio-bytes"),
      }
    );
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(403);

    const getReq = new NextRequest(
      "http://localhost:3000/api/speaking/upload-direct?key=speaking/usr_learner_a/ses_1/candidate.webm",
      {
        method: "GET",
        headers: createAuthHeaders(teacher),
      }
    );
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(403);
  });

  it("should allow learner to PUT and GET their own audio file", async () => {
    const key = "speaking/usr_learner_a/ses_happy/candidate.webm";
    const audioData = Buffer.from("learner-a-audio-data");

    const putReq = new NextRequest(
      `http://localhost:3000/api/speaking/upload-direct?key=${encodeURIComponent(key)}`,
      {
        method: "PUT",
        headers: createAuthHeaders(learnerA),
        body: audioData,
      }
    );
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(200);

    const getReq = new NextRequest(
      `http://localhost:3000/api/speaking/upload-direct?key=${encodeURIComponent(key)}`,
      {
        method: "GET",
        headers: createAuthHeaders(learnerA),
      }
    );
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const retrievedArrayBuffer = await getRes.arrayBuffer();
    expect(Buffer.from(retrievedArrayBuffer).toString()).toBe(
      "learner-a-audio-data"
    );
  });

  it("should prevent Learner A from uploading to Learner B storage key", async () => {
    const crossKey = "speaking/usr_learner_b/ses_victim/candidate.webm";
    const putReq = new NextRequest(
      `http://localhost:3000/api/speaking/upload-direct?key=${encodeURIComponent(crossKey)}`,
      {
        method: "PUT",
        headers: createAuthHeaders(learnerA), // Learner A trying to write to Learner B's key
        body: Buffer.from("tampered-audio"),
      }
    );
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(403);
  });

  it("should prevent Learner A from accessing Learner B dev-fallback audio key", async () => {
    // First, Learner B uploads their audio
    const learnerBKey = "speaking/usr_learner_b/ses_private/candidate.webm";
    const putReq = new NextRequest(
      `http://localhost:3000/api/speaking/upload-direct?key=${encodeURIComponent(learnerBKey)}`,
      {
        method: "PUT",
        headers: createAuthHeaders(learnerB),
        body: Buffer.from("private-learner-b-audio"),
      }
    );
    await PUT(putReq);

    // Learner A attempts to retrieve Learner B's audio
    const getReq = new NextRequest(
      `http://localhost:3000/api/speaking/upload-direct?key=${encodeURIComponent(learnerBKey)}`,
      {
        method: "GET",
        headers: createAuthHeaders(learnerA), // Learner A trying to read Learner B's audio
      }
    );
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(403);
  });
});
