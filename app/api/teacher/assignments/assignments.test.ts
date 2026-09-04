import { describe, it, expect, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import {
  POST as createAssignmentRoute,
  GET as listAssignmentsRoute,
} from "../classrooms/[id]/assignments/route";
import {
  GET as getAssignmentRoute,
  PATCH as updateAssignmentRoute,
  DELETE as deleteAssignmentRoute,
} from "./[id]/route";
import {
  clearDevClassroomCache,
  registerDevUser,
  createClassroom,
  enrollMember,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { clearDevHomeworkCache } from "@/modules/homework/infrastructure/homework-assignment-repository";

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

describe("Teacher Speaking Homework Assignment API Endpoints (Issue #74, ADR-0009)", () => {
  const teacherA = {
    id: "teacher_hw_01",
    role: "teacher" as const,
    name: "Teacher Alice",
    email: "alice.hw@test.com",
  };

  const teacherB = {
    id: "teacher_hw_02",
    role: "teacher" as const,
    name: "Teacher Bob",
    email: "bob.hw@test.com",
  };

  const learnerUser = {
    id: "learner_hw_01",
    role: "learner" as const,
    name: "Learner Charlie",
    email: "charlie.hw@test.com",
  };

  let classroomId: string;

  beforeEach(async () => {
    clearDevClassroomCache();
    clearDevHomeworkCache();

    registerDevUser({
      id: teacherA.id,
      name: teacherA.name,
      email: teacherA.email,
      role: teacherA.role,
    });
    registerDevUser({
      id: teacherB.id,
      name: teacherB.name,
      email: teacherB.email,
      role: teacherB.role,
    });
    registerDevUser({
      id: learnerUser.id,
      name: learnerUser.name,
      email: learnerUser.email,
      role: learnerUser.role,
    });

    const cls = await createClassroom(teacherA.id, {
      name: "IELTS Speaking Room 101",
      description: "Homework Test Room",
    });
    classroomId = cls.id;
    await enrollMember(classroomId, learnerUser.id);
  });

  describe("POST /api/teacher/classrooms/:id/assignments", () => {
    it("should reject unauthenticated requests with 401 Unauthorized", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "POST",
          headers: createAuthHeaders(null),
          body: JSON.stringify({
            title: "Speaking HW",
            prompts: [{ text: "Q1", partNumber: 1 }],
            submissionDeadline: new Date(Date.now() + 86400000).toISOString(),
          }),
        }
      );

      const res = await createAssignmentRoute(req, {
        params: Promise.resolve({ id: classroomId }),
      });
      expect(res.status).toBe(401);
    });

    it("should reject learner role requests with 403 Forbidden", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "POST",
          headers: createAuthHeaders(learnerUser),
          body: JSON.stringify({
            title: "Learner HW Creation",
            prompts: [{ text: "Q1", partNumber: 1 }],
            submissionDeadline: new Date(Date.now() + 86400000).toISOString(),
          }),
        }
      );

      const res = await createAssignmentRoute(req, {
        params: Promise.resolve({ id: classroomId }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject Teacher B creating assignment in Teacher A's classroom with 403 Forbidden", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherB),
          body: JSON.stringify({
            title: "Hijacked HW",
            prompts: [{ text: "Q1", partNumber: 1 }],
            submissionDeadline: new Date(Date.now() + 86400000).toISOString(),
          }),
        }
      );

      const res = await createAssignmentRoute(req, {
        params: Promise.resolve({ id: classroomId }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject assignment creation with missing title or invalid prompts count", async () => {
      // Missing title
      const req1 = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            prompts: [{ text: "Q1", partNumber: 1 }],
            submissionDeadline: new Date(Date.now() + 86400000).toISOString(),
          }),
        }
      );
      const res1 = await createAssignmentRoute(req1, {
        params: Promise.resolve({ id: classroomId }),
      });
      expect(res1.status).toBe(400);

      // 4 prompts
      const req2 = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            title: "Valid Title",
            prompts: [
              { text: "Q1", partNumber: 1 },
              { text: "Q2", partNumber: 1 },
              { text: "Q3", partNumber: 1 },
              { text: "Q4", partNumber: 1 },
            ],
            submissionDeadline: new Date(Date.now() + 86400000).toISOString(),
          }),
        }
      );
      const res2 = await createAssignmentRoute(req2, {
        params: Promise.resolve({ id: classroomId }),
      });
      expect(res2.status).toBe(400);
    });

    it("should reject assignment creation with past deadline", async () => {
      const past = new Date(Date.now() - 10000).toISOString();
      const req = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            title: "Past Deadline HW",
            prompts: [{ text: "Q1", partNumber: 1 }],
            submissionDeadline: past,
          }),
        }
      );
      const res = await createAssignmentRoute(req, {
        params: Promise.resolve({ id: classroomId }),
      });
      expect(res.status).toBe(400);
    });

    it("should successfully create and publish a discrete homework assignment (201 Created)", async () => {
      const futureDeadline = new Date(Date.now() + 86400000 * 3).toISOString();
      const req = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            title: "Speaking Part 1 & 2 Task",
            instructions: "Answer fluently with standard pronunciation.",
            prompts: [
              { text: "Tell me about your hometown.", partNumber: 1 },
              {
                text: "Describe a book you read recently.",
                partNumber: 2,
                subPrompts: [
                  "What book it is",
                  "Why you chose it",
                  "What it is about",
                ],
              },
            ],
            submissionDeadline: futureDeadline,
            status: "published",
          }),
        }
      );

      const res = await createAssignmentRoute(req, {
        params: Promise.resolve({ id: classroomId }),
      });
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.assignment.title).toBe("Speaking Part 1 & 2 Task");
      expect(data.assignment.status).toBe("published");
      expect(data.assignment.prompts).toHaveLength(2);
      expect(data.assignment.prompts[0].promptId).toBeDefined();
    });
  });

  describe("GET /api/teacher/classrooms/:id/assignments", () => {
    it("should list assignments for the classroom (200 OK)", async () => {
      // Create an assignment first
      const futureDeadline = new Date(Date.now() + 86400000 * 2).toISOString();
      const createReq = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            title: "Classroom HW 1",
            prompts: [{ text: "Q1", partNumber: 1 }],
            submissionDeadline: futureDeadline,
          }),
        }
      );
      await createAssignmentRoute(createReq, {
        params: Promise.resolve({ id: classroomId }),
      });

      const listReq = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherA),
        }
      );
      const res = await listAssignmentsRoute(listReq, {
        params: Promise.resolve({ id: classroomId }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.assignments).toHaveLength(1);
      expect(data.assignments[0].title).toBe("Classroom HW 1");
    });
  });

  describe("GET, PATCH, DELETE /api/teacher/assignments/:id", () => {
    let createdAssignmentId: string;

    beforeEach(async () => {
      const futureDeadline = new Date(Date.now() + 86400000 * 3).toISOString();
      const createReq = new NextRequest(
        `http://localhost/api/teacher/classrooms/${classroomId}/assignments`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            title: "Initial Assignment",
            prompts: [{ text: "Cue card 1", partNumber: 2 }],
            submissionDeadline: futureDeadline,
            status: "draft",
          }),
        }
      );
      const res = await createAssignmentRoute(createReq, {
        params: Promise.resolve({ id: classroomId }),
      });
      const data = await res.json();
      createdAssignmentId = data.assignment.id;
    });

    it("should retrieve assignment details, classroom, and student roster (200 OK)", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/assignments/${createdAssignmentId}`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherA),
        }
      );
      const res = await getAssignmentRoute(req, {
        params: Promise.resolve({ id: createdAssignmentId }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.assignment.id).toBe(createdAssignmentId);
      expect(data.classroom.name).toBe("IELTS Speaking Room 101");
      expect(data.students).toHaveLength(1);
      expect(data.students[0].learnerName).toBe("Learner Charlie");
      expect(data.students[0].submissionStatus).toBe("not_submitted");
    });

    it("should reject Teacher B viewing Teacher A assignment with 403 Forbidden", async () => {
      const req = new NextRequest(
        `http://localhost/api/teacher/assignments/${createdAssignmentId}`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherB),
        }
      );
      const res = await getAssignmentRoute(req, {
        params: Promise.resolve({ id: createdAssignmentId }),
      });
      expect(res.status).toBe(403);
    });

    it("should update draft assignment fields and publish it", async () => {
      const patchReq = new NextRequest(
        `http://localhost/api/teacher/assignments/${createdAssignmentId}`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            title: "Updated & Published HW",
            status: "published",
          }),
        }
      );
      const patchRes = await updateAssignmentRoute(patchReq, {
        params: Promise.resolve({ id: createdAssignmentId }),
      });
      expect(patchRes.status).toBe(200);

      const patchData = await patchRes.json();
      expect(patchData.assignment.title).toBe("Updated & Published HW");
      expect(patchData.assignment.status).toBe("published");
    });

    it("should reject modifying prompts on published assignment with 400 Bad Request", async () => {
      // First publish it
      await updateAssignmentRoute(
        new NextRequest(
          `http://localhost/api/teacher/assignments/${createdAssignmentId}`,
          {
            method: "PATCH",
            headers: createAuthHeaders(teacherA),
            body: JSON.stringify({ status: "published" }),
          }
        ),
        { params: Promise.resolve({ id: createdAssignmentId }) }
      );

      // Attempt to change prompts
      const modifyReq = new NextRequest(
        `http://localhost/api/teacher/assignments/${createdAssignmentId}`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            prompts: [{ text: "Illegal prompt change", partNumber: 1 }],
          }),
        }
      );
      const modifyRes = await updateAssignmentRoute(modifyReq, {
        params: Promise.resolve({ id: createdAssignmentId }),
      });
      expect(modifyRes.status).toBe(400);
      const err = await modifyRes.json();
      expect(err.error.message).toMatch(
        /Không thể sửa đổi nội dung câu hỏi sau khi bài tập đã được giao/
      );
    });

    it("should delete draft assignment with 200 OK", async () => {
      const delReq = new NextRequest(
        `http://localhost/api/teacher/assignments/${createdAssignmentId}`,
        {
          method: "DELETE",
          headers: createAuthHeaders(teacherA),
        }
      );
      const delRes = await deleteAssignmentRoute(delReq, {
        params: Promise.resolve({ id: createdAssignmentId }),
      });
      expect(delRes.status).toBe(200);

      // Verify it's gone
      const getReq = new NextRequest(
        `http://localhost/api/teacher/assignments/${createdAssignmentId}`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherA),
        }
      );
      const getRes = await getAssignmentRoute(getReq, {
        params: Promise.resolve({ id: createdAssignmentId }),
      });
      expect(getRes.status).toBe(404);
    });
  });
});
