import { describe, it, expect, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import {
  POST as createClassroomRoute,
  GET as listClassroomsRoute,
} from "./route";
import {
  POST as enrollMemberRoute,
  GET as listMembersRoute,
  DELETE as removeMemberRoute,
} from "./[id]/members/route";
import { PATCH as updateClassroomRoute } from "./[id]/route";
import {
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { createTeacherClassroom } from "@/modules/classroom/application/classroom-service";

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

describe("Teacher Classroom Management API Endpoints (Issue #73, ADR-0009)", () => {
  const teacherA = {
    id: "teacher_api_01",
    role: "teacher" as const,
    name: "Teacher Alice",
    email: "alice@example.com",
  };

  const teacherB = {
    id: "teacher_api_02",
    role: "teacher" as const,
    name: "Teacher Bob",
    email: "bob@example.com",
  };

  const learnerUser = {
    id: "learner_api_01",
    role: "learner" as const,
    name: "Learner Charlie",
    email: "charlie@example.com",
  };

  beforeEach(() => {
    clearDevClassroomCache();

    registerDevUser({
      id: learnerUser.id,
      name: learnerUser.name,
      email: learnerUser.email,
      role: "learner",
    });

    registerDevUser({
      id: teacherB.id,
      name: teacherB.name,
      email: teacherB.email,
      role: "teacher",
    });
  });

  describe("POST & GET /api/teacher/classrooms", () => {
    it("should reject unauthenticated requests with 401 Unauthorized", async () => {
      const postReq = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms",
        {
          method: "POST",
          headers: createAuthHeaders(null),
          body: JSON.stringify({ name: "IELTS 6.5" }),
        }
      );
      const postRes = await createClassroomRoute(postReq);
      expect(postRes.status).toBe(401);

      const getReq = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms",
        {
          method: "GET",
          headers: createAuthHeaders(null),
        }
      );
      const getRes = await listClassroomsRoute(getReq);
      expect(getRes.status).toBe(401);
    });

    it("should reject learner role requests with 403 Forbidden", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms",
        {
          method: "POST",
          headers: createAuthHeaders(learnerUser),
          body: JSON.stringify({ name: "Learner Created Class" }),
        }
      );
      const res = await createClassroomRoute(req);
      expect(res.status).toBe(403);
    });

    it("should reject classroom creation when name is missing", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms",
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ description: "No name provided" }),
        }
      );
      const res = await createClassroomRoute(req);
      expect(res.status).toBe(400);
    });

    it("should allow teacher to create a classroom (201 Created)", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms",
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            name: "IELTS Speaking Intensive Morning",
            description: "Mon-Wed-Fri 9AM",
          }),
        }
      );
      const res = await createClassroomRoute(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.classroom.name).toBe("IELTS Speaking Intensive Morning");
      expect(data.classroom.teacherId).toBe(teacherA.id);
    });

    it("should allow creating classroom with explicit null description", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms",
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            name: "Class with Null Description",
            description: null,
          }),
        }
      );
      const res = await createClassroomRoute(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.classroom.description).toBeNull();
    });

    it("should list only classrooms owned by requesting teacher (200 OK)", async () => {
      await createTeacherClassroom(teacherA.id, { name: "Alice Class 1" });
      await createTeacherClassroom(teacherA.id, { name: "Alice Class 2" });
      await createTeacherClassroom(teacherB.id, { name: "Bob Class 1" });

      const req = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms",
        {
          method: "GET",
          headers: createAuthHeaders(teacherA),
        }
      );
      const res = await listClassroomsRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.classrooms.length).toBe(2);
      expect(
        data.classrooms.every(
          (c: { teacherId: string }) => c.teacherId === teacherA.id
        )
      ).toBe(true);
    });
  });

  describe("POST, GET, DELETE /api/teacher/classrooms/:id/members", () => {
    it("should reject learner role attempting to add members with 403 Forbidden", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Alice Class",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "POST",
          headers: createAuthHeaders(learnerUser),
          body: JSON.stringify({ email: "student@example.com" }),
        }
      );
      const res = await enrollMemberRoute(req, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject enrolling learner when Teacher A targets Teacher B classroom with 403 Forbidden", async () => {
      const bobClass = await createTeacherClassroom(teacherB.id, {
        name: "Bob Class",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${bobClass.id}/members`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ email: learnerUser.email }),
        }
      );
      const res = await enrollMemberRoute(req, {
        params: Promise.resolve({ id: bobClass.id }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject Teacher A viewing Teacher B's roster with 403 Forbidden", async () => {
      const bobClass = await createTeacherClassroom(teacherB.id, {
        name: "Bob Class",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${bobClass.id}/members`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherA),
        }
      );
      const res = await listMembersRoute(req, {
        params: Promise.resolve({ id: bobClass.id }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject Teacher A deleting a learner from Teacher B's roster with 403 Forbidden", async () => {
      const bobClass = await createTeacherClassroom(teacherB.id, {
        name: "Bob Class",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${bobClass.id}/members?learnerId=${learnerUser.id}`,
        {
          method: "DELETE",
          headers: createAuthHeaders(teacherA),
        }
      );
      const res = await removeMemberRoute(req, {
        params: Promise.resolve({ id: bobClass.id }),
      });
      expect(res.status).toBe(403);
    });

    it("should return 404 Not Found when email is not registered", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Alice Class",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ email: "unknown@example.com" }),
        }
      );
      const res = await enrollMemberRoute(req, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(res.status).toBe(404);
    });

    it("should return 400 Bad Request when attempting to enroll a teacher account", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Alice Class",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ email: teacherB.email }),
        }
      );
      const res = await enrollMemberRoute(req, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(res.status).toBe(400);
    });

    it("should allow teacher to enroll a valid learner (201 Created)", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Alice Class",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ email: learnerUser.email }),
        }
      );
      const res = await enrollMemberRoute(req, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.member.learnerId).toBe(learnerUser.id);
      expect(data.member.learnerEmail).toBe(learnerUser.email);
    });

    it("should return 409 Conflict when enrolling duplicate learner", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Alice Class",
      });

      // First enrollment
      const req1 = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ email: learnerUser.email }),
        }
      );
      const res1 = await enrollMemberRoute(req1, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(res1.status).toBe(201);

      // Duplicate enrollment
      const req2 = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ email: learnerUser.email }),
        }
      );
      const res2 = await enrollMemberRoute(req2, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(res2.status).toBe(409);
    });

    it("should list members of classroom (200 OK)", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Alice Class",
      });

      // Enroll learner
      const enrollReq = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ email: learnerUser.email }),
        }
      );
      await enrollMemberRoute(enrollReq, {
        params: Promise.resolve({ id: aliceClass.id }),
      });

      const getReq = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherA),
        }
      );
      const getRes = await listMembersRoute(getReq, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(getRes.status).toBe(200);
      const data = await getRes.json();
      expect(data.success).toBe(true);
      expect(data.members.length).toBe(1);
      expect(data.members[0].learnerEmail).toBe(learnerUser.email);
    });

    it("should remove learner from classroom (200 OK)", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Alice Class",
      });

      const enrollReq = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "POST",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ email: learnerUser.email }),
        }
      );
      await enrollMemberRoute(enrollReq, {
        params: Promise.resolve({ id: aliceClass.id }),
      });

      const deleteReq = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members?learnerId=${learnerUser.id}`,
        {
          method: "DELETE",
          headers: createAuthHeaders(teacherA),
        }
      );
      const deleteRes = await removeMemberRoute(deleteReq, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(deleteRes.status).toBe(200);

      // Verify roster is now empty
      const getReq = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}/members`,
        {
          method: "GET",
          headers: createAuthHeaders(teacherA),
        }
      );
      const getRes = await listMembersRoute(getReq, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      const data = await getRes.json();
      expect(data.members.length).toBe(0);
    });
  });

  describe("PATCH /api/teacher/classrooms/:id", () => {
    it("should reject unauthenticated requests with 401 Unauthorized", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms/cls_123",
        {
          method: "PATCH",
          headers: createAuthHeaders(null),
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );
      const res = await updateClassroomRoute(req, {
        params: Promise.resolve({ id: "cls_123" }),
      });
      expect(res.status).toBe(401);
    });

    it("should reject learner role requests with 403 Forbidden", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms/cls_123",
        {
          method: "PATCH",
          headers: createAuthHeaders(learnerUser),
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );
      const res = await updateClassroomRoute(req, {
        params: Promise.resolve({ id: "cls_123" }),
      });
      expect(res.status).toBe(403);
    });

    it("should reject Teacher A updating Teacher B's classroom with 403 Forbidden", async () => {
      const bobClass = await createTeacherClassroom(teacherB.id, {
        name: "Bob Class",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${bobClass.id}`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ name: "Hijacked by Alice" }),
        }
      );
      const res = await updateClassroomRoute(req, {
        params: Promise.resolve({ id: bobClass.id }),
      });
      expect(res.status).toBe(403);
    });

    it("should return 404 Not Found when classroom does not exist", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/teacher/classrooms/non_existent_cls",
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );
      const res = await updateClassroomRoute(req, {
        params: Promise.resolve({ id: "non_existent_cls" }),
      });
      expect(res.status).toBe(404);
    });

    it("should reject empty name with 400 Bad Request", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Alice Class",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ name: "   " }),
        }
      );
      const res = await updateClassroomRoute(req, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(res.status).toBe(400);
    });

    it("should successfully update name and description (200 OK)", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Original Name",
        description: "Original Description",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({
            name: "Renamed Class",
            description: "Updated Description",
          }),
        }
      );
      const res = await updateClassroomRoute(req, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.classroom.name).toBe("Renamed Class");
      expect(data.classroom.description).toBe("Updated Description");
    });

    it("should allow setting description to null (200 OK)", async () => {
      const aliceClass = await createTeacherClassroom(teacherA.id, {
        name: "Alice Class",
        description: "Will be removed",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/teacher/classrooms/${aliceClass.id}`,
        {
          method: "PATCH",
          headers: createAuthHeaders(teacherA),
          body: JSON.stringify({ description: null }),
        }
      );
      const res = await updateClassroomRoute(req, {
        params: Promise.resolve({ id: aliceClass.id }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.classroom.description).toBeNull();
    });
  });
});
