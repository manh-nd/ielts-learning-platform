import { describe, it, expect, beforeEach } from "bun:test";
import {
  createTeacherHomeworkAssignment,
  getTeacherAssignmentDetails,
  listTeacherAssignmentsByClassroom,
  updateTeacherHomeworkAssignment,
  deleteTeacherDraftAssignment,
  archiveTeacherHomeworkAssignment,
} from "./homework-assignment-service";
import { clearDevHomeworkCache } from "../infrastructure/homework-assignment-repository";
import {
  createClassroom,
  enrollMember,
  clearDevClassroomCache,
  registerDevUser,
} from "@/modules/classroom/infrastructure/classroom-repository";
import { ValidationError, NotFoundError, ForbiddenError } from "@/lib/errors";

describe("Homework Assignment Application Service (Issue #74, ADR-0009)", () => {
  const teacherA = "usr_teacher_a";
  const teacherB = "usr_teacher_b";
  const learner1 = "usr_learner_1";
  let classroomAId: string;

  beforeEach(async () => {
    clearDevHomeworkCache();
    clearDevClassroomCache();

    // Register test users
    registerDevUser({
      id: teacherA,
      name: "Teacher Alpha",
      email: "teacher.a@test.com",
      role: "teacher",
    });
    registerDevUser({
      id: teacherB,
      name: "Teacher Beta",
      email: "teacher.b@test.com",
      role: "teacher",
    });
    registerDevUser({
      id: learner1,
      name: "Learner One",
      email: "learner.1@test.com",
      role: "learner",
    });

    // Create classroom owned by Teacher A
    const cls = await createClassroom(teacherA, {
      name: "IELTS Advanced Speaking",
      description: "Cohort 2026",
    });
    classroomAId = cls.id;

    // Enroll learner
    await enrollMember(classroomAId, learner1);
  });

  describe("createTeacherHomeworkAssignment", () => {
    it("should reject creation if teacher does not own the classroom (Single-Teacher ownership invariant)", async () => {
      expect(
        createTeacherHomeworkAssignment(teacherB, classroomAId, {
          title: "HW 1",
          prompts: [{ text: "Describe a book.", partNumber: 2 }],
          submissionDeadline: new Date(Date.now() + 86400000),
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should reject creation when prompt count is outside 1-3 range", async () => {
      // 0 prompts
      expect(
        createTeacherHomeworkAssignment(teacherA, classroomAId, {
          title: "Empty HW",
          prompts: [],
          submissionDeadline: new Date(Date.now() + 86400000),
        })
      ).rejects.toThrow(ValidationError);

      // 4 prompts
      expect(
        createTeacherHomeworkAssignment(teacherA, classroomAId, {
          title: "Too Many Prompts",
          prompts: [
            { text: "Q1", partNumber: 1 },
            { text: "Q2", partNumber: 1 },
            { text: "Q3", partNumber: 3 },
            { text: "Q4", partNumber: 3 },
          ],
          submissionDeadline: new Date(Date.now() + 86400000),
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should accept valid combinations of 1 to 3 prompts across Parts 1, 2, 3", async () => {
      const deadline = new Date(Date.now() + 86400000 * 3);

      const hw = await createTeacherHomeworkAssignment(teacherA, classroomAId, {
        title: "Part 1 & 2 Mixed HW",
        prompts: [
          { text: "Where do you live?", partNumber: 1 },
          {
            text: "Describe a historical building.",
            partNumber: 2,
            subPrompts: ["Where it is", "What it looks like"],
          },
        ],
        submissionDeadline: deadline,
        status: "published",
      });

      expect(hw.id).toBeDefined();
      expect(hw.status).toBe("published");
      expect(hw.prompts).toHaveLength(2);
      expect(hw.prompts[0].promptId).toBeDefined();
      expect(hw.prompts[1].subPrompts).toHaveLength(2);
    });

    it("should reject past submission deadlines", async () => {
      const pastDeadline = new Date(Date.now() - 60000); // 1 minute ago
      expect(
        createTeacherHomeworkAssignment(teacherA, classroomAId, {
          title: "Expired HW",
          prompts: [{ text: "Speak about music.", partNumber: 1 }],
          submissionDeadline: pastDeadline,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("getTeacherAssignmentDetails", () => {
    it("should return assignment details, classroom name, and student roster", async () => {
      const hw = await createTeacherHomeworkAssignment(teacherA, classroomAId, {
        title: "Speaking Assignment Details Test",
        prompts: [{ text: "Describe your job.", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 86400000),
      });

      const details = await getTeacherAssignmentDetails(teacherA, hw.id);
      expect(details.assignment.id).toBe(hw.id);
      expect(details.classroom.name).toBe("IELTS Advanced Speaking");
      expect(details.students).toHaveLength(1);
      expect(details.students[0].learnerEmail).toBe("learner.1@test.com");
      expect(details.students[0].submissionStatus).toBe("not_submitted");
    });

    it("should reject unauthorized teacher viewing assignment details", async () => {
      const hw = await createTeacherHomeworkAssignment(teacherA, classroomAId, {
        title: "Private HW",
        prompts: [{ text: "Secret question", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 86400000),
      });

      expect(getTeacherAssignmentDetails(teacherB, hw.id)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe("listTeacherAssignmentsByClassroom", () => {
    it("should list assignments for classroom and reject unauthorized teacher", async () => {
      await createTeacherHomeworkAssignment(teacherA, classroomAId, {
        title: "HW Alpha",
        prompts: [{ text: "Alpha question", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 86400000),
      });

      const list = await listTeacherAssignmentsByClassroom(
        teacherA,
        classroomAId
      );
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe("HW Alpha");

      expect(
        listTeacherAssignmentsByClassroom(teacherB, classroomAId)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("updateTeacherHomeworkAssignment (Invariants)", () => {
    it("should freeze prompts when assignment is published (Prompt Immutability Invariant)", async () => {
      const hw = await createTeacherHomeworkAssignment(teacherA, classroomAId, {
        title: "Published HW",
        prompts: [{ text: "Original Question", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 86400000 * 2),
        status: "published",
      });

      // Attempting to modify prompts on published assignment
      expect(
        updateTeacherHomeworkAssignment(teacherA, hw.id, {
          prompts: [{ text: "Modified Question", partNumber: 1 }],
        })
      ).rejects.toThrow(
        /Không thể sửa đổi nội dung câu hỏi sau khi bài tập đã được giao/
      );
    });

    it("should enforce deadline extension only for published assignments", async () => {
      const originalDeadline = new Date(Date.now() + 86400000 * 4); // 4 days out
      const hw = await createTeacherHomeworkAssignment(teacherA, classroomAId, {
        title: "Deadline Test HW",
        prompts: [{ text: "Part 2 Cue Card", partNumber: 2 }],
        submissionDeadline: originalDeadline,
        status: "published",
      });

      // Attempting to shorten deadline to 2 days out
      const shortenedDeadline = new Date(Date.now() + 86400000 * 2);
      expect(
        updateTeacherHomeworkAssignment(teacherA, hw.id, {
          submissionDeadline: shortenedDeadline,
        })
      ).rejects.toThrow(/Hạn nộp bài đã giao chỉ có thể gia hạn thêm/);

      // Successfully extending deadline to 7 days out
      const extendedDeadline = new Date(Date.now() + 86400000 * 7);
      const updated = await updateTeacherHomeworkAssignment(teacherA, hw.id, {
        submissionDeadline: extendedDeadline,
      });
      expect(updated.submissionDeadline.getTime()).toBe(
        extendedDeadline.getTime()
      );
    });

    it("should allow editing prompts while assignment is in draft status", async () => {
      const hw = await createTeacherHomeworkAssignment(teacherA, classroomAId, {
        title: "Draft HW",
        prompts: [{ text: "Draft question 1", partNumber: 1 }],
        submissionDeadline: new Date(Date.now() + 86400000),
        status: "draft",
      });

      const updated = await updateTeacherHomeworkAssignment(teacherA, hw.id, {
        title: "Polished Draft HW",
        prompts: [
          { text: "Draft question 1", partNumber: 1 },
          { text: "Draft question 2", partNumber: 1 },
        ],
      });

      expect(updated.title).toBe("Polished Draft HW");
      expect(updated.prompts).toHaveLength(2);
    });
  });

  describe("deleteTeacherDraftAssignment & archiveTeacherHomeworkAssignment", () => {
    it("should permit deleting an unassigned draft", async () => {
      const draftHw = await createTeacherHomeworkAssignment(
        teacherA,
        classroomAId,
        {
          title: "Temporary Draft",
          prompts: [{ text: "Draft question", partNumber: 1 }],
          submissionDeadline: new Date(Date.now() + 86400000),
          status: "draft",
        }
      );

      const res = await deleteTeacherDraftAssignment(teacherA, draftHw.id);
      expect(res.success).toBe(true);

      expect(getTeacherAssignmentDetails(teacherA, draftHw.id)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should reject deleting a published assignment", async () => {
      const publishedHw = await createTeacherHomeworkAssignment(
        teacherA,
        classroomAId,
        {
          title: "Published HW",
          prompts: [{ text: "Question", partNumber: 1 }],
          submissionDeadline: new Date(Date.now() + 86400000),
          status: "published",
        }
      );

      expect(
        deleteTeacherDraftAssignment(teacherA, publishedHw.id)
      ).rejects.toThrow(/Chỉ có thể xóa bài tập ở trạng thái Bản nháp/);
    });

    it("should archive a published assignment", async () => {
      const publishedHw = await createTeacherHomeworkAssignment(
        teacherA,
        classroomAId,
        {
          title: "Finished Assignment",
          prompts: [{ text: "Question", partNumber: 1 }],
          submissionDeadline: new Date(Date.now() + 86400000),
          status: "published",
        }
      );

      const archived = await archiveTeacherHomeworkAssignment(
        teacherA,
        publishedHw.id
      );
      expect(archived.status).toBe("archived");

      // Further edits should be blocked on archived assignment
      expect(
        updateTeacherHomeworkAssignment(teacherA, publishedHw.id, {
          title: "New Title",
        })
      ).rejects.toThrow(/Không thể chỉnh sửa bài tập đã lưu trữ/);
    });
  });
});
