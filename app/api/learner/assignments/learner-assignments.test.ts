import { describe, it, expect, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import { GET as getLearnerAssignmentRoute } from "./[id]/route";
import { POST as submitLearnerHomeworkRoute } from "./[id]/submit/route";
import { POST as uploadUrlLearnerHomeworkRoute } from "./[id]/upload-url/route";
import {
  clearDevClassroomCache,
  registerDevUser,
  createClassroom,
  enrollMember,
} from "@/modules/classroom/infrastructure/classroom-repository";
import {
  clearDevHomeworkCache,
  createAssignment,
} from "@/modules/homework/infrastructure/homework-assignment-repository";
import {
  clearDevHomeworkSubmissionCache,
  updateSubmissionStatus,
} from "@/modules/homework/infrastructure/homework-submission-repository";
import { buildHomeworkAudioStorageKey } from "@/lib/storage/s3-client";

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

describe("Learner Speaking Homework API Endpoints (Issue #75, ADR-0008, ADR-0009)", () => {
  const teacherUser = {
    id: "teacher_api_01",
    role: "teacher" as const,
    name: "Teacher Alice",
    email: "alice@test.com",
  };

  const enrolledLearner = {
    id: "learner_enrolled_01",
    role: "learner" as const,
    name: "Enrolled Learner",
    email: "enrolled@test.com",
  };

  const outsiderLearner = {
    id: "learner_outsider_02",
    role: "learner" as const,
    name: "Outsider Learner",
    email: "outsider@test.com",
  };

  let assignmentId: string;

  beforeEach(async () => {
    clearDevClassroomCache();
    clearDevHomeworkCache();
    clearDevHomeworkSubmissionCache();

    registerDevUser(teacherUser);
    registerDevUser(enrolledLearner);
    registerDevUser(outsiderLearner);

    const classroom = await createClassroom(teacherUser.id, {
      name: "IELTS Mastery Class",
    });

    await enrollMember(classroom.id, enrolledLearner.id);

    const assignment = await createAssignment({
      classroomId: classroom.id,
      teacherId: teacherUser.id,
      title: "IELTS Speaking Part 1 & 2 Homework",
      instructions: "Record your answers clearly in a quiet environment.",
      prompts: [
        {
          promptId: "p_1",
          text: "Tell me about your daily routine.",
          partNumber: 1,
        },
        {
          promptId: "p_2",
          text: "Describe your favorite hobby.",
          partNumber: 2,
          subPrompts: ["What it is", "When you started"],
        },
      ],
      submissionDeadline: new Date(Date.now() + 86400000), // 24h future
      status: "published",
    });

    assignmentId = assignment.id;
  });

  describe("GET /api/learner/assignments/:id", () => {
    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}`,
        {
          method: "GET",
          headers: createAuthHeaders(null),
        }
      );

      const res = await getLearnerAssignmentRoute(req, {
        params: Promise.resolve({ id: assignmentId }),
      });

      expect(res.status).toBe(401);
    });

    it("should reject learner who is not a member of the classroom with 403 Forbidden", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}`,
        {
          method: "GET",
          headers: createAuthHeaders(outsiderLearner),
        }
      );

      const res = await getLearnerAssignmentRoute(req, {
        params: Promise.resolve({ id: assignmentId }),
      });

      expect(res.status).toBe(403);
    });

    it("should return assignment details and null submission for enrolled learner", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}`,
        {
          method: "GET",
          headers: createAuthHeaders(enrolledLearner),
        }
      );

      const res = await getLearnerAssignmentRoute(req, {
        params: Promise.resolve({ id: assignmentId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.assignment.title).toBe("IELTS Speaking Part 1 & 2 Homework");
      expect(data.classroom.name).toBe("IELTS Mastery Class");
      expect(data.submission).toBeNull();
      expect(data.currentAttempt).toBeNull();
      expect(data.allAttempts).toHaveLength(0);
    });
  });

  describe("POST /api/learner/assignments/:id/submit", () => {
    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          headers: createAuthHeaders(null),
          body: JSON.stringify({ audioResponses: [] }),
        }
      );

      const res = await submitLearnerHomeworkRoute(req, {
        params: Promise.resolve({ id: assignmentId }),
      });

      expect(res.status).toBe(401);
    });

    it("should reject teacher role with 403 Forbidden (only learners submit homework)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherUser),
          body: JSON.stringify({ audioResponses: [] }),
        }
      );

      const res = await submitLearnerHomeworkRoute(req, {
        params: Promise.resolve({ id: assignmentId }),
      });

      expect(res.status).toBe(403);
    });

    it("should reject submission when prompt audio clips are incomplete with 400 Bad Request", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          headers: createAuthHeaders(enrolledLearner),
          body: JSON.stringify({
            audioResponses: [
              {
                promptId: "p_1",
                storageKey: buildHomeworkAudioStorageKey(
                  enrolledLearner.id,
                  assignmentId,
                  "p_1",
                  "p1.webm"
                ),
                durationMs: 30000,
                audioBytes: 40000,
              },
            ],
          }),
        }
      );

      const res = await submitLearnerHomeworkRoute(req, {
        params: Promise.resolve({ id: assignmentId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.message).toContain("Chưa ghi âm đủ câu trả lời");
    });

    it("should successfully create initial submission attempt #1 (201 Created)", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          headers: createAuthHeaders(enrolledLearner),
          body: JSON.stringify({
            audioResponses: [
              {
                promptId: "p_1",
                storageKey: buildHomeworkAudioStorageKey(
                  enrolledLearner.id,
                  assignmentId,
                  "p_1",
                  "p1.webm"
                ),
                durationMs: 30000,
                audioBytes: 50000,
              },
              {
                promptId: "p_2",
                storageKey: buildHomeworkAudioStorageKey(
                  enrolledLearner.id,
                  assignmentId,
                  "p_2",
                  "p2.webm"
                ),
                durationMs: 65000,
                audioBytes: 110000,
              },
            ],
          }),
        }
      );

      const res = await submitLearnerHomeworkRoute(req, {
        params: Promise.resolve({ id: assignmentId }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.submission.currentAttemptNumber).toBe(1);
      expect(data.submission.status).toBe("submitted");
      expect(data.attempt.attemptNumber).toBe(1);
      expect(data.attempt.audioResponses).toHaveLength(2);
    });

    it("should reject resubmission with 409 Conflict when Teacher has locked status to in_review", async () => {
      // 1. Submit attempt #1
      const initialReq = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          headers: createAuthHeaders(enrolledLearner),
          body: JSON.stringify({
            audioResponses: [
              {
                promptId: "p_1",
                storageKey: buildHomeworkAudioStorageKey(
                  enrolledLearner.id,
                  assignmentId,
                  "p_1",
                  "p1.webm"
                ),
                durationMs: 30000,
                audioBytes: 50000,
              },
              {
                promptId: "p_2",
                storageKey: buildHomeworkAudioStorageKey(
                  enrolledLearner.id,
                  assignmentId,
                  "p_2",
                  "p2.webm"
                ),
                durationMs: 65000,
                audioBytes: 110000,
              },
            ],
          }),
        }
      );

      const initialRes = await submitLearnerHomeworkRoute(initialReq, {
        params: Promise.resolve({ id: assignmentId }),
      });
      const initialData = await initialRes.json();
      const submissionId = initialData.submission.id;

      // 2. Teacher locks review
      await updateSubmissionStatus(submissionId, "in_review", 1);

      // 3. Learner attempts to resubmit
      const resubmitReq = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}/submit`,
        {
          method: "POST",
          headers: createAuthHeaders(enrolledLearner),
          body: JSON.stringify({
            audioResponses: [
              {
                promptId: "p_1",
                storageKey: buildHomeworkAudioStorageKey(
                  enrolledLearner.id,
                  assignmentId,
                  "p_1",
                  "p1_v2.webm"
                ),
                durationMs: 35000,
                audioBytes: 55000,
              },
              {
                promptId: "p_2",
                storageKey: buildHomeworkAudioStorageKey(
                  enrolledLearner.id,
                  assignmentId,
                  "p_2",
                  "p2_v2.webm"
                ),
                durationMs: 70000,
                audioBytes: 120000,
              },
            ],
          }),
        }
      );

      const conflictRes = await submitLearnerHomeworkRoute(resubmitReq, {
        params: Promise.resolve({ id: assignmentId }),
      });

      expect(conflictRes.status).toBe(409);
      const conflictData = await conflictRes.json();
      expect(conflictData.error.code).toBe("SUBMISSION_UNDER_REVIEW");
      expect(conflictData.error.message).toContain(
        "Bài làm đã được Giáo viên tiếp nhận chấm"
      );
    });
  });

  describe("POST /api/learner/assignments/:id/upload-url", () => {
    it("should return upload URL and canonical storage key for valid prompt", async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/learner/assignments/${assignmentId}/upload-url`,
        {
          method: "POST",
          headers: createAuthHeaders(enrolledLearner),
          body: JSON.stringify({
            promptId: "p_1",
            filename: "part1_clip.webm",
            mimeType: "audio/webm;codecs=opus",
          }),
        }
      );

      const res = await uploadUrlLearnerHomeworkRoute(req, {
        params: Promise.resolve({ id: assignmentId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.uploadUrl).toBeDefined();
      expect(data.storageKey).toContain(
        `homework/${enrolledLearner.id}/${assignmentId}/p_1/part1_clip.webm`
      );
    });
  });
});
