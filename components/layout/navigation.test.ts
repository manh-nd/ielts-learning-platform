import { describe, it, expect } from "bun:test";
import {
  TEACHER_NAV_ITEMS,
  LEARNER_NAV_ITEMS,
  getNavItemsForRole,
  isNavItemActive,
  getActiveNavItem,
} from "./navigation";

describe("Layout Navigation Configuration (Issue #99)", () => {
  it("returns distinct navigation items for teacher and learner roles", () => {
    const teacherItems = getNavItemsForRole("teacher");
    const learnerItems = getNavItemsForRole("learner");

    expect(teacherItems).toEqual(TEACHER_NAV_ITEMS);
    expect(learnerItems).toEqual(LEARNER_NAV_ITEMS);
    expect(teacherItems.map((i) => i.title)).toEqual([
      "Không gian Chấm bài",
      "Quản lý Lớp học",
      "Chế độ Xem Học viên",
    ]);
    expect(learnerItems.map((i) => i.title)).toEqual([
      "Tổng quan Dashboard",
      "Speaking Practice",
    ]);
  });

  describe("isNavItemActive Matcher", () => {
    const teacherReviewItem = TEACHER_NAV_ITEMS[0];
    const classroomsItem = TEACHER_NAV_ITEMS[1];
    const teacherLearnerViewItem = TEACHER_NAV_ITEMS[2];
    const learnerDashboardItem = LEARNER_NAV_ITEMS[0];
    const speakingPracticeItem = LEARNER_NAV_ITEMS[1];

    it("matches exact route equality", () => {
      expect(isNavItemActive("/teacher/review", teacherReviewItem)).toBe(true);
      expect(isNavItemActive("/teacher/classrooms", classroomsItem)).toBe(true);
      expect(isNavItemActive("/learner/dashboard", learnerDashboardItem)).toBe(
        true
      );
      expect(
        isNavItemActive("/learner/speaking/live", speakingPracticeItem)
      ).toBe(true);
    });

    it("matches descendant child routes", () => {
      expect(
        isNavItemActive("/teacher/classrooms/cls-123/roster", classroomsItem)
      ).toBe(true);
      expect(
        isNavItemActive(
          "/learner/speaking/live/session-1",
          speakingPracticeItem
        )
      ).toBe(true);
    });

    it("matches configured alias prefixes for nested workflows", () => {
      // Teacher submissions cockpit descends from Teacher Review
      expect(
        isNavItemActive("/teacher/submissions/sub-101", teacherReviewItem)
      ).toBe(true);

      // Learner homework assignments descend from Learner Dashboard
      expect(
        isNavItemActive("/learner/assignments/asg-202", learnerDashboardItem)
      ).toBe(true);
      expect(
        isNavItemActive(
          "/learner/assignments/asg-202/result",
          learnerDashboardItem
        )
      ).toBe(true);
    });

    it("enforces exact matching when exact flag is set", () => {
      // Teacher Learner View item has exact: true
      expect(
        isNavItemActive("/learner/dashboard", teacherLearnerViewItem)
      ).toBe(true);
      expect(
        isNavItemActive("/learner/dashboard/subpath", teacherLearnerViewItem)
      ).toBe(false);
      expect(
        isNavItemActive("/learner/assignments/asg-202", teacherLearnerViewItem)
      ).toBe(false);
    });

    it("returns false for non-active routes", () => {
      expect(isNavItemActive("/teacher/classrooms", teacherReviewItem)).toBe(
        false
      );
      expect(
        isNavItemActive("/learner/speaking/live", learnerDashboardItem)
      ).toBe(false);
      expect(isNavItemActive("/teacher/review", learnerDashboardItem)).toBe(
        false
      );
    });
  });

  describe("getActiveNavItem Helper", () => {
    it("resolves the active item for teacher routes", () => {
      const active1 = getActiveNavItem("/teacher/review", "teacher");
      expect(active1?.title).toBe("Không gian Chấm bài");

      const active2 = getActiveNavItem(
        "/teacher/submissions/sub-101",
        "teacher"
      );
      expect(active2?.title).toBe("Không gian Chấm bài");

      const active3 = getActiveNavItem("/teacher/classrooms", "teacher");
      expect(active3?.title).toBe("Quản lý Lớp học");
    });

    it("resolves the active item for learner routes", () => {
      const active1 = getActiveNavItem("/learner/dashboard", "learner");
      expect(active1?.title).toBe("Tổng quan Dashboard");

      const active2 = getActiveNavItem(
        "/learner/assignments/asg-202",
        "learner"
      );
      expect(active2?.title).toBe("Tổng quan Dashboard");

      const active3 = getActiveNavItem("/learner/speaking/live", "learner");
      expect(active3?.title).toBe("Speaking Practice");
    });

    it("returns undefined for unrecognized routes", () => {
      expect(getActiveNavItem("/unrecognized/path", "teacher")).toBeUndefined();
    });
  });
});
