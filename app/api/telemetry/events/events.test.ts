import { describe, it, expect, beforeEach } from "bun:test";
import { POST } from "./route";
import { NextRequest } from "next/server";
import {
  clearDevTelemetryCache,
  queryTelemetryEvents,
} from "@/modules/telemetry/infrastructure/telemetry-repository";

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

describe("Telemetry Events API Endpoint (POST /api/telemetry/events)", () => {
  beforeEach(() => {
    clearDevTelemetryCache();
  });

  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const req = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders(null),
      body: JSON.stringify({
        eventName: "practice_started",
        contextType: "practice",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should reject invalid eventName outside canonical taxonomy with 400 Bad Request", async () => {
    const req = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({
        id: "learner_01",
        role: "learner",
      }),
      body: JSON.stringify({
        eventName: "invalid_random_event",
        contextType: "practice",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject invalid contextType with 400 Bad Request", async () => {
    const req = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({
        id: "learner_01",
        role: "learner",
      }),
      body: JSON.stringify({
        eventName: "practice_started",
        contextType: "classroom_chat",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject spoofed userId with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({
        id: "real_learner_id",
        role: "learner",
      }),
      body: JSON.stringify({
        userId: "impersonated_victim_id",
        eventName: "practice_started",
        contextType: "practice",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("FORBIDDEN");
  });

  it("should reject non-numeric durationMs with 400 Bad Request", async () => {
    const req = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({
        id: "learner_01",
        role: "learner",
      }),
      body: JSON.stringify({
        eventName: "practice_feedback_ready",
        contextType: "practice",
        durationMs: -50,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should successfully record speaking practice telemetry event for authenticated learner", async () => {
    const learnerId = "learner_telemetry_valid";
    const req = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({
        id: learnerId,
        role: "learner",
      }),
      body: JSON.stringify({
        eventName: "practice_audio_recorded",
        contextType: "practice",
        contextId: "ses_test_001",
        durationMs: 45000,
        properties: {
          audio_bytes: 128000,
          mime_type: "audio/webm;codecs=opus",
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.eventId).toBeDefined();
    expect(data.eventName).toBe("practice_audio_recorded");

    // Verify stored event in repository
    const stored = await queryTelemetryEvents({
      userId: learnerId,
      contextId: "ses_test_001",
    });
    expect(stored.length).toBe(1);
    expect(stored[0].eventName).toBe("practice_audio_recorded");
    expect(stored[0].durationMs).toBe(45000);
    expect(stored[0].properties.audio_bytes).toBe(128000);
    expect(stored[0].userRole).toBe("learner");
  });

  it("should record practice_started and practice_feedback_ready events seamlessly", async () => {
    const learnerId = "learner_telemetry_flow";

    // 1. practice_started
    const req1 = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({ id: learnerId, role: "learner" }),
      body: JSON.stringify({
        eventName: "practice_started",
        contextType: "practice",
        contextId: "ses_flow_002",
      }),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(201);

    // 2. practice_feedback_ready
    const req2 = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({ id: learnerId, role: "learner" }),
      body: JSON.stringify({
        eventName: "practice_feedback_ready",
        contextType: "practice",
        contextId: "ses_flow_002",
        durationMs: 3200,
        properties: {
          overall_band: 6.5,
        },
      }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(201);

    const events = await queryTelemetryEvents({ contextId: "ses_flow_002" });
    expect(events.length).toBe(2);
    const eventNames = events.map((e) => e.eventName);
    expect(eventNames).toContain("practice_started");
    expect(eventNames).toContain("practice_feedback_ready");
  });

  it("should reject learner attempting to emit teacher-only event with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({
        id: "learner_02",
        role: "learner",
      }),
      body: JSON.stringify({
        eventName: "teacher_assessment_published",
        contextType: "homework",
        contextId: "hw_sub_123",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("FORBIDDEN");
    expect(data.error.message).toContain("Role 'learner' is not authorized");
  });

  it("should reject teacher attempting to emit practice-only event with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({
        id: "teacher_01",
        role: "teacher",
      }),
      body: JSON.stringify({
        eventName: "practice_started",
        contextType: "practice",
        contextId: "ses_practice_001",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("FORBIDDEN");
    expect(data.error.message).toContain("Role 'teacher' is not authorized");
  });

  it("should allow teacher emitting teacher_assessment_published event", async () => {
    const teacherId = "teacher_auth_valid";
    const req = new NextRequest("http://localhost:3000/api/telemetry/events", {
      method: "POST",
      headers: createAuthHeaders({
        id: teacherId,
        role: "teacher",
      }),
      body: JSON.stringify({
        eventName: "teacher_assessment_published",
        contextType: "homework",
        contextId: "hw_sub_456",
        durationMs: 12000,
        properties: {
          band_score: 7.0,
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.eventName).toBe("teacher_assessment_published");

    const events = await queryTelemetryEvents({
      userId: teacherId,
      contextId: "hw_sub_456",
    });
    expect(events.length).toBe(1);
    expect(events[0].userRole).toBe("teacher");
    expect(events[0].eventName).toBe("teacher_assessment_published");
  });
});
