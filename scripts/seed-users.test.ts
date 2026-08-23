import { describe, it, expect } from "bun:test";
import { DEV_SAMPLE_USERS } from "./seed-users";
import { resolveUserRole } from "@/lib/auth-helpers";
import { evaluatePasswordStrength } from "@/components/auth/types";

describe("Dev Seed Users Configuration", () => {
  it("should define all expected dev sample user accounts", () => {
    const emails = DEV_SAMPLE_USERS.map((u) => u.email);

    expect(emails).toContain("teacher@ielts.liuhocngoaingu.com");
    expect(emails).toContain("learnerteacher@ielts.liuhocngoaingu.com");
    expect(emails).toContain("teacher@ielts-prep.vn");
    expect(emails).toContain("learner@ielts-prep.vn");
    expect(emails).toContain("learner@ielts.liuhocngoaingu.com");
  });

  it("should resolve correct roles for each dev sample account against TEACHER_EMAILS", () => {
    const teacherEnv =
      "teacher@ielts.liuhocngoaingu.com,learnerteacher@ielts.liuhocngoaingu.com,teacher@ielts-prep.vn";

    const teacher1Role = resolveUserRole(
      "teacher@ielts.liuhocngoaingu.com",
      teacherEnv
    );
    const teacher2Role = resolveUserRole(
      "learnerteacher@ielts.liuhocngoaingu.com",
      teacherEnv
    );
    const teacher3Role = resolveUserRole("teacher@ielts-prep.vn", teacherEnv);
    const learner1Role = resolveUserRole("learner@ielts-prep.vn", teacherEnv);
    const learner2Role = resolveUserRole(
      "learner@ielts.liuhocngoaingu.com",
      teacherEnv
    );

    expect(teacher1Role).toBe("teacher");
    expect(teacher2Role).toBe("teacher");
    expect(teacher3Role).toBe("teacher");
    expect(learner1Role).toBe("learner");
    expect(learner2Role).toBe("learner");
  });

  it("should ensure all seed passwords meet strong password security criteria", () => {
    for (const user of DEV_SAMPLE_USERS) {
      const strength = evaluatePasswordStrength(user.password);
      expect(strength.criteria.minLength).toBe(true);
      expect(strength.criteria.hasUppercase).toBe(true);
      expect(strength.criteria.hasLowercase).toBe(true);
      expect(strength.criteria.hasNumberOrSpecial).toBe(true);
      expect(strength.score).toBeGreaterThanOrEqual(3);
    }
  });
});
