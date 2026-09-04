import { describe, it, expect, beforeEach } from "bun:test";
import { DELETE } from "./route";
import { NextRequest } from "next/server";
import {
  speakingPracticeRepository,
  devSessionCache,
  devResponseCache,
} from "@/modules/speaking/infrastructure/speaking-practice-repository";
import {
  devTelemetryCache,
  clearDevTelemetryCache,
} from "@/modules/telemetry/infrastructure/telemetry-repository";
import {
  saveDirectAudioDevFallback,
  getDirectAudioDevFallback,
  setSimulatedDeletionFailure,
} from "@/lib/storage/s3-client";

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

describe("DELETE /api/learner/practice/:id Endpoint", () => {
  beforeEach(() => {
    devSessionCache.clear();
    devResponseCache.clear();
    clearDevTelemetryCache();
  });

  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/learner/practice/ses_123",
      {
        method: "DELETE",
        headers: createAuthHeaders(null),
      }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "ses_123" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("should reject teacher role requests with 403 Forbidden (Teachers have zero access)", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/learner/practice/ses_123",
      {
        method: "DELETE",
        headers: createAuthHeaders({
          id: "teacher_1",
          role: "teacher",
          email: "teacher@ielts-prep.vn",
        }),
      }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "ses_123" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("should reject cross-learner deletion attempts with 403 Forbidden", async () => {
    const victimSessionId = "ses_victim_learner";
    await speakingPracticeRepository.commitCompleted({
      sessionId: victimSessionId,
      userId: "learner_victim",
      candidateName: "Victim Learner",
      topicTitle: "Work",
      durationSeconds: 60,
    });

    const req = new NextRequest(
      `http://localhost:3000/api/learner/practice/${victimSessionId}`,
      {
        method: "DELETE",
        headers: createAuthHeaders({
          id: "learner_attacker",
          role: "learner",
          email: "attacker@ielts-prep.vn",
        }),
      }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: victimSessionId }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");

    // Verify victim's session was not deleted
    const found = await speakingPracticeRepository.findById(victimSessionId);
    expect(found.practice).not.toBeNull();
  });

  it("should return 404 Not Found if session does not exist", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/learner/practice/ses_unknown",
      {
        method: "DELETE",
        headers: createAuthHeaders({
          id: "learner_1",
          role: "learner",
          email: "learner@ielts-prep.vn",
        }),
      }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "ses_unknown" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("should permanently delete practice session, purge audio binary, and emit practice_purged event", async () => {
    const sessionId = "ses_learner_hard_delete";
    const userId = "learner_legit";
    const storageKey = `speaking/${userId}/${sessionId}/candidate.webm`;

    await speakingPracticeRepository.commitCompleted({
      sessionId,
      userId,
      candidateName: "Legit Learner",
      topicTitle: "Hometown",
      durationSeconds: 85,
      storageKey,
      audioUrl: `/api/speaking/upload-direct?key=${encodeURIComponent(storageKey)}`,
    });

    await saveDirectAudioDevFallback(
      storageKey,
      Buffer.from("legit-audio-bytes"),
      "audio/webm"
    );
    expect(await getDirectAudioDevFallback(storageKey)).not.toBeNull();

    const req = new NextRequest(
      `http://localhost:3000/api/learner/practice/${sessionId}`,
      {
        method: "DELETE",
        headers: createAuthHeaders({
          id: userId,
          role: "learner",
          email: "legit@ielts-prep.vn",
        }),
      }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: sessionId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deletedId).toBe(sessionId);

    // 1. Session record is permanently removed from DB/cache
    const found = await speakingPracticeRepository.findById(sessionId);
    expect(found.practice).toBeNull();
    expect(found.responses).toEqual([]);

    // 2. Audio binary purged from storage
    expect(await getDirectAudioDevFallback(storageKey)).toBeNull();

    // 3. Telemetry event logged with userRole: "learner"
    const purgedEvents = devTelemetryCache.filter(
      (e) => e.eventName === "practice_purged" && e.contextId === sessionId
    );
    expect(purgedEvents.length).toBe(1);
    expect(purgedEvents[0].userId).toBe(userId);
    expect(purgedEvents[0].userRole).toBe("learner");
    expect(purgedEvents[0].properties.reason).toBe("learner_hard_delete");
  });

  it("should fail fast (500) and preserve DB record when storage deletion fails", async () => {
    const sessionId = "ses_storage_fail_test";
    const userId = "learner_storage_fail";
    const storageKey = `speaking/${userId}/${sessionId}/candidate.webm`;

    await speakingPracticeRepository.commitCompleted({
      sessionId,
      userId,
      candidateName: "Fail Learner",
      topicTitle: "Storage Failure Check",
      durationSeconds: 45,
      storageKey,
      audioUrl: `/api/speaking/upload-direct?key=${encodeURIComponent(storageKey)}`,
    });

    await saveDirectAudioDevFallback(
      storageKey,
      Buffer.from("storage-fail-audio"),
      "audio/webm"
    );

    setSimulatedDeletionFailure(true);

    try {
      const req = new NextRequest(
        `http://localhost:3000/api/learner/practice/${sessionId}`,
        {
          method: "DELETE",
          headers: createAuthHeaders({
            id: userId,
            role: "learner",
            email: "fail@ielts-prep.vn",
          }),
        }
      );

      const res = await DELETE(req, {
        params: Promise.resolve({ id: sessionId }),
      });

      expect(res.status).toBe(500);

      // Invariant: If storage deletion fails, DB session record MUST be preserved!
      const found = await speakingPracticeRepository.findById(sessionId);
      expect(found.practice).not.toBeNull();
      expect(found.practice?.id).toBe(sessionId);
    } finally {
      setSimulatedDeletionFailure(false);
    }
  });

  it("should not affect homework submissions (homework retention lock invariant)", async () => {
    // Learners cannot delete classroom homework assignments via the self-service practice endpoint
    const homeworkSessionId = "hw_submission_90d_locked";

    const req = new NextRequest(
      `http://localhost:3000/api/learner/practice/${homeworkSessionId}`,
      {
        method: "DELETE",
        headers: createAuthHeaders({
          id: "learner_hw",
          role: "learner",
          email: "learner_hw@ielts-prep.vn",
        }),
      }
    );

    const res = await DELETE(req, {
      params: Promise.resolve({ id: homeworkSessionId }),
    });

    // Endpoint only queries speakingPracticeRepository (speakingSessions) -> 404 for homework
    expect(res.status).toBe(404);
  });
});
