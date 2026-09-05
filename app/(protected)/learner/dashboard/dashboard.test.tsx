import { describe, it, expect, mock, beforeEach } from "bun:test";
import { renderToString } from "react-dom/server";
import LearnerDashboardPage, { metadata } from "./page";

// Controlled mock session
let mockUser = {
  id: "learner-1",
  name: "Nguyen Van A",
  role: "learner",
};

mock.module("@/lib/authorization", () => ({
  requireRoleOrRedirect: mock(async () => ({
    user: mockUser,
    session: { id: "sess-1", userId: mockUser.id },
  })),
}));

describe("Issue #84: Learner Dashboard Truthful for Pilot", () => {
  beforeEach(() => {
    mockUser = {
      id: "learner-1",
      name: "Nguyen Van A",
      role: "learner",
    };
  });

  it("renders truthful metadata without progress-tracking claims", () => {
    expect(metadata.title).toBe("Bảng điều khiển Học viên | Chilly IELTS");
    expect(metadata.description).toBe(
      "Không gian luyện IELTS Speaking dành cho học viên."
    );
  });

  it("renders learner greeting and honest Speaking Practice card without fake history", async () => {
    const pageElement = await LearnerDashboardPage();
    const html = renderToString(pageElement);

    // Positive checks: Greeting and Speaking Practice
    expect(html).toContain("Xin chào");
    expect(html).toContain("Nguyen Van A");
    expect(html).toContain("IELTS Speaking Practice");
    expect(html).toContain('href="/learner/speaking/live"');
    expect(html).toContain("Bắt đầu buổi luyện tập Speaking");
    expect(html).toContain("Luyện tập Trực tiếp");
    expect(html).toContain("Đàm thoại âm thanh hai chiều");

    // Strict Negative checks: No fabricated Band scores, targets, or progress bars
    expect(html).not.toContain("7.5");
    expect(html).not.toContain("Mục tiêu Band");
    expect(html).not.toContain("Band 6.5");
    expect(html).not.toContain("Band 7.0");
    expect(html).not.toContain("Tổng quan Kỹ năng");

    // Strict Negative checks: No fake history
    expect(html).not.toContain("Lịch sử Luyện tập");
    expect(html).not.toContain("3 bài gần nhất");
    expect(html).not.toContain("Technology & Work");
    expect(html).not.toContain("Compulsory Community Service");

    // Strict Negative checks: No Writing card or claims
    expect(html).not.toContain("IELTS Writing Essay Assessment");
    expect(html).not.toContain("Luyện viết đề thi mới");
    expect(html).not.toContain("nộp bài luận Writing");

    // Strict Negative checks: No Full Mock or Part 2/3 claims
    expect(html).not.toContain("Full Part 1, 2, 3");
    expect(html).not.toContain("Phòng thi Trực tiếp");
    expect(html).not.toContain("IDP/BC");
    expect(html).not.toContain("Chấm điểm theo Band");
  });

  it("renders teacher preview badge without exposing fabricated learner data", async () => {
    mockUser = {
      id: "teacher-1",
      name: "Teacher Bob",
      role: "teacher",
    };

    const pageElement = await LearnerDashboardPage();
    const html = renderToString(pageElement);

    // Teacher preview badge is shown
    expect(html).toContain("Xem trước (Giáo viên)");
    expect(html).toContain("Xin chào");
    expect(html).toContain("Teacher Bob");

    // Still strictly contains NO fabricated scores or history
    expect(html).not.toContain("7.5");
    expect(html).not.toContain("Mục tiêu Band");
    expect(html).not.toContain("Band 6.5");
    expect(html).not.toContain("Band 7.0");
    expect(html).not.toContain("Tổng quan Kỹ năng");
    expect(html).not.toContain("Lịch sử Luyện tập");
    expect(html).not.toContain("IELTS Writing Essay Assessment");
  });
});
