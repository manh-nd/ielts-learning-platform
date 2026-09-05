import { describe, it, expect, beforeEach } from "bun:test";
import {
  createClassroom,
  findClassroomById,
  listClassroomsByTeacherId,
  findMembership,
  addMembership,
  removeMembership,
  listClassroomRoster,
  findUserByEmail,
  registerDevUser,
  clearDevClassroomCache,
} from "./classroom-repository";

describe("Classroom Repository", () => {
  const teacherId = "teacher_repo_01";
  const otherTeacherId = "teacher_repo_02";

  beforeEach(() => {
    clearDevClassroomCache();
  });

  it("should create a classroom and retrieve it by id", async () => {
    const created = await createClassroom(teacherId, {
      name: "IELTS Intensive 7.5+",
      description: "Focus on Speaking Part 2 and 3",
    });

    expect(created.id).toBeDefined();
    expect(created.teacherId).toBe(teacherId);
    expect(created.name).toBe("IELTS Intensive 7.5+");
    expect(created.description).toBe("Focus on Speaking Part 2 and 3");
    expect(created.createdAt).toBeInstanceOf(Date);

    const retrieved = await findClassroomById(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.name).toBe("IELTS Intensive 7.5+");
  });

  it("should list classrooms by teacherId with accurate memberCount and isolation", async () => {
    const c1 = await createClassroom(teacherId, { name: "Class A" });
    const c2 = await createClassroom(teacherId, { name: "Class B" });
    const otherClass = await createClassroom(otherTeacherId, {
      name: "Other Teacher Class",
    });

    await addMembership(c1.id, "learner_01");
    await addMembership(c1.id, "learner_02");
    await addMembership(c2.id, "learner_03");

    const teacherClasses = await listClassroomsByTeacherId(teacherId);
    expect(teacherClasses.length).toBe(2);

    const foundC1 = teacherClasses.find((c) => c.id === c1.id);
    const foundC2 = teacherClasses.find((c) => c.id === c2.id);
    expect(foundC1?.memberCount).toBe(2);
    expect(foundC2?.memberCount).toBe(1);

    // Other teacher isolation check
    const otherTeacherClasses = await listClassroomsByTeacherId(otherTeacherId);
    expect(otherTeacherClasses.length).toBe(1);
    expect(otherTeacherClasses[0].id).toBe(otherClass.id);
    expect(otherTeacherClasses[0].memberCount).toBe(0);
  });

  it("should add, find, list, and remove classroom memberships", async () => {
    const classroom = await createClassroom(teacherId, {
      name: "Speaking Cohort",
    });

    registerDevUser({
      id: "learner_01",
      name: "Nguyen Van A",
      email: "vana@example.com",
      role: "learner",
    });

    const enrolled = await addMembership(classroom.id, "learner_01");
    expect(enrolled.id).toBeDefined();
    expect(enrolled.classroomId).toBe(classroom.id);
    expect(enrolled.learnerId).toBe("learner_01");

    const memberLookup = await findMembership(classroom.id, "learner_01");
    expect(memberLookup).not.toBeNull();
    expect(memberLookup?.learnerId).toBe("learner_01");

    const roster = await listClassroomRoster(classroom.id);
    expect(roster.length).toBe(1);
    expect(roster[0].learnerName).toBe("Nguyen Van A");
    expect(roster[0].learnerEmail).toBe("vana@example.com");

    const removed = await removeMembership(classroom.id, "learner_01");
    expect(removed).toBe(true);

    const rosterAfter = await listClassroomRoster(classroom.id);
    expect(rosterAfter.length).toBe(0);
  });

  it("should look up users by email case-insensitively", async () => {
    registerDevUser({
      id: "user_learner_99",
      name: "Trang Nguyen",
      email: "trang.nguyen@test.edu.vn",
      role: "learner",
    });

    const found = await findUserByEmail("TRANG.NGUYEN@test.edu.vn");
    expect(found).not.toBeNull();
    expect(found?.id).toBe("user_learner_99");
    expect(found?.email).toBe("trang.nguyen@test.edu.vn");

    const notFound = await findUserByEmail("nonexistent@domain.com");
    expect(notFound).toBeNull();
  });
});
