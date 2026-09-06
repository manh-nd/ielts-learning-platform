import { describe, it, expect, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import { GET as getTeacherReviewAudioRoute } from "./route";
import {
  clearDevClassroomCache,
  createClassroom,
  addMembership,
} from "@/modules/classroom/infrastructure/classroom-repository";
import {
  clearDevHomeworkCache,
  createAssignment,
} from "@/modules/homework/infrastructure/homework-assignment-repository";
import {
  clearDevHomeworkSubmissionCache,
  createInitialSubmissionWithAttempt,
} from "@/modules/homework/infrastructure/homework-submission-repository";
import { saveDirectAudioDevFallback } from "@/lib/storage/s3-client";

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
  return headers;
}

describe("Teacher Review Audio Endpoint (Issue #100)", () => {
  const teacherA = {
    id: "tch_audio_01",
    role: "teacher" as const,
    name: "Teacher Alpha",
    email: "alpha@ielts.local",
  };
  const teacherB = {
    id: "tch_audio_02",
    role: "teacher" as const,
    name: "Teacher Beta",
    email: "beta@ielts.local",
  };
  const learner = {
    id: "lrn_audio_01",
    role: "learner" as const,
    name: "Student Candidate",
    email: "candidate@ielts.local",
  };

  let submissionId: string;
  const promptId = "prompt_audio_1";
  const storageKey = `homework/${learner.id}/asg_audio_01/${promptId}/response.webm`;
  const mockAudioBytes = Buffer.from("RIFFmock-audio-data-bytes-for-testing");

  beforeEach(async () => {
    clearDevClassroomCache();
    clearDevHomeworkCache();
    clearDevHomeworkSubmissionCache();

    // 1. Create classroom for Teacher A
    const classroom = await createClassroom(teacherA.id, {
      name: "Audio Review Class",
      description: "Testing audio review stream",
    });

    await addMembership(classroom.id, learner.id);

    // 2. Create Assignment with prompt
    const assignment = await createAssignment({
      classroomId: classroom.id,
      teacherId: teacherA.id,
      title: "Audio Assignment",
      instructions: "Record audio",
      prompts: [
        {
          promptId,
          text: "Describe your favorite hobby.",
          partNumber: 1,
        },
      ],
      submissionDeadline: new Date(Date.now() + 86400000),
      status: "published",
    });

    // 3. Create submission
    const result = await createInitialSubmissionWithAttempt({
      assignmentId: assignment.id,
      learnerId: learner.id,
      audioResponses: [
        {
          promptId,
          storageKey,
          durationMs: 30000,
          audioBytes: mockAudioBytes.length,
        },
      ],
      status: "submitted",
    });

    submissionId = result.submission.id;

    // 4. Save test audio in dev cache
    await saveDirectAudioDevFallback(storageKey, mockAudioBytes, "audio/webm");
  });

  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/teacher/submissions/${submissionId}/audio/${promptId}`,
      { headers: createAuthHeaders(null) }
    );
    const res = await getTeacherReviewAudioRoute(req, {
      params: Promise.resolve({ id: submissionId, promptId }),
    });
    expect(res.status).toBe(401);
  });

  it("should reject learner requests with 403 Forbidden", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/teacher/submissions/${submissionId}/audio/${promptId}`,
      { headers: createAuthHeaders(learner) }
    );
    const res = await getTeacherReviewAudioRoute(req, {
      params: Promise.resolve({ id: submissionId, promptId }),
    });
    expect(res.status).toBe(403);
  });

  it("should reject Teacher B accessing Teacher A's submission with 403 Forbidden", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/teacher/submissions/${submissionId}/audio/${promptId}`,
      { headers: createAuthHeaders(teacherB) }
    );
    const res = await getTeacherReviewAudioRoute(req, {
      params: Promise.resolve({ id: submissionId, promptId }),
    });
    expect(res.status).toBe(403);
  });

  it("should return 404 Not Found for non-existent submission", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/teacher/submissions/sub_non_existent/audio/${promptId}`,
      { headers: createAuthHeaders(teacherA) }
    );
    const res = await getTeacherReviewAudioRoute(req, {
      params: Promise.resolve({ id: "sub_non_existent", promptId }),
    });
    expect(res.status).toBe(404);
  });

  it("should return 404 Not Found for invalid / mismatched promptId", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/teacher/submissions/${submissionId}/audio/invalid_prompt`,
      { headers: createAuthHeaders(teacherA) }
    );
    const res = await getTeacherReviewAudioRoute(req, {
      params: Promise.resolve({ id: submissionId, promptId: "invalid_prompt" }),
    });
    expect(res.status).toBe(404);
  });

  it("should successfully serve audio with 200 OK and no-store headers for authorized teacher", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/teacher/submissions/${submissionId}/audio/${promptId}`,
      { headers: createAuthHeaders(teacherA) }
    );
    const res = await getTeacherReviewAudioRoute(req, {
      params: Promise.resolve({ id: submissionId, promptId }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/webm");
    expect(res.headers.get("content-length")).toBe(
      String(mockAudioBytes.length)
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("accept-ranges")).toBeNull();

    const bodyBuffer = await res.arrayBuffer();
    expect(Buffer.from(bodyBuffer).equals(mockAudioBytes)).toBe(true);
  });
});
