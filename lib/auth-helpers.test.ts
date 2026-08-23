import { describe, it, expect } from "bun:test";
import {
  parseTeacherEmails,
  isTeacherEmail,
  resolveUserRole,
} from "./auth-helpers";

describe("Auth Helpers", () => {
  describe("parseTeacherEmails", () => {
    it("should return empty array for undefined or empty env var", () => {
      expect(parseTeacherEmails(undefined)).toEqual([]);
      expect(parseTeacherEmails("")).toEqual([]);
      expect(parseTeacherEmails("   ")).toEqual([]);
    });

    it("should parse comma-separated emails, trim whitespace, and normalize to lowercase", () => {
      const input =
        " Teacher1@example.com , teacher2@ielts.org,  ADMIN@SCHOOL.EDU  ";
      const parsed = parseTeacherEmails(input);
      expect(parsed).toEqual([
        "teacher1@example.com",
        "teacher2@ielts.org",
        "admin@school.edu",
      ]);
    });

    it("should ignore empty tokens caused by trailing or duplicate commas", () => {
      const input = "teacher@example.com,, ,teacher2@example.com,";
      const parsed = parseTeacherEmails(input);
      expect(parsed).toEqual(["teacher@example.com", "teacher2@example.com"]);
    });
  });

  describe("isTeacherEmail", () => {
    const teacherEnv = "teacher@example.com, mentor@school.edu";

    it("should return true for matching email regardless of casing or extra spaces", () => {
      expect(isTeacherEmail("teacher@example.com", teacherEnv)).toBe(true);
      expect(isTeacherEmail("TEACHER@EXAMPLE.COM", teacherEnv)).toBe(true);
      expect(isTeacherEmail("  Teacher@Example.Com  ", teacherEnv)).toBe(true);
      expect(isTeacherEmail("mentor@school.edu", teacherEnv)).toBe(true);
    });

    it("should return false for non-matching email, null, or undefined", () => {
      expect(isTeacherEmail("student@example.com", teacherEnv)).toBe(false);
      expect(isTeacherEmail("", teacherEnv)).toBe(false);
      expect(isTeacherEmail(null, teacherEnv)).toBe(false);
      expect(isTeacherEmail(undefined, teacherEnv)).toBe(false);
    });
  });

  describe("resolveUserRole", () => {
    const teacherEnv = "teacher@ielts.com, admin@ielts.com";

    it("should return 'teacher' if email matches TEACHER_EMAILS", () => {
      expect(resolveUserRole("teacher@ielts.com", teacherEnv)).toBe("teacher");
      expect(resolveUserRole("ADMIN@IELTS.COM", teacherEnv)).toBe("teacher");
    });

    it("should return 'learner' if email does not match TEACHER_EMAILS", () => {
      expect(resolveUserRole("learner@ielts.com", teacherEnv)).toBe("learner");
      expect(resolveUserRole("hacker@malicious.com", teacherEnv)).toBe(
        "learner"
      );
      expect(resolveUserRole(undefined, teacherEnv)).toBe("learner");
      expect(resolveUserRole(null, teacherEnv)).toBe("learner");
    });
  });
});
