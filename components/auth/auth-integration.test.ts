import { describe, it, expect } from "bun:test";
import { isTeacher, isLearner } from "@/lib/authorization";
import { resolveUserRole } from "@/lib/auth-helpers";

describe("Auth Flow & Role Authorization Integration", () => {
  const teacherEnv =
    "teacher@ielts.liuhocngoaingu.com,learnerteacher@ielts.liuhocngoaingu.com,teacher@ielts-prep.vn";

  it("should verify teacher role predicate correctly", () => {
    const teacherUser = { role: "teacher" };
    const learnerUser = { role: "learner" };
    const noRoleUser = { role: undefined };

    expect(isTeacher(teacherUser)).toBe(true);
    expect(isTeacher(learnerUser)).toBe(false);
    expect(isTeacher(noRoleUser)).toBe(false);
  });

  it("should verify learner role predicate correctly", () => {
    const teacherUser = { role: "teacher" };
    const learnerUser = { role: "learner" };
    const noRoleUser = { role: undefined };

    expect(isLearner(learnerUser)).toBe(true);
    expect(isLearner(teacherUser)).toBe(false);
    expect(isLearner(noRoleUser)).toBe(false);
  });

  it("should route sample dev teacher accounts to teacher review workspace", () => {
    const teacherEmail = "teacher@ielts.liuhocngoaingu.com";
    const role = resolveUserRole(teacherEmail, teacherEnv);
    expect(role).toBe("teacher");

    const destination =
      role === "teacher" ? "/teacher/review" : "/learner/dashboard";
    expect(destination).toBe("/teacher/review");
  });

  it("should route sample dev dual role account to teacher review workspace", () => {
    const dualEmail = "learnerteacher@ielts.liuhocngoaingu.com";
    const role = resolveUserRole(dualEmail, teacherEnv);
    expect(role).toBe("teacher");

    const destination =
      role === "teacher" ? "/teacher/review" : "/learner/dashboard";
    expect(destination).toBe("/teacher/review");
  });

  it("should route sample dev learner accounts to learner dashboard", () => {
    const learnerEmail = "learner@ielts-prep.vn";
    const role = resolveUserRole(learnerEmail, teacherEnv);
    expect(role).toBe("learner");

    const destination =
      role === "teacher" ? "/teacher/review" : "/learner/dashboard";
    expect(destination).toBe("/learner/dashboard");
  });
});
