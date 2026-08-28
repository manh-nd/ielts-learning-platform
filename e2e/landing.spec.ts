import { test, expect } from "@playwright/test";

test.describe("Landing Page & Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should render Chilly IELTS brand header, hero title and feature badges", async ({
    page,
  }) => {
    // 1. Check Brand & Logo
    await expect(page.getByText("Chilly IELTS").first()).toBeVisible();
    await expect(page.getByText("AI Powered").first()).toBeVisible();

    // 2. Check Hero Section
    await expect(page.locator("h1")).toContainText(
      "Luyện thi IELTS Thông minh"
    );
    await expect(
      page.getByText("Tự luyện cùng AI 24/7 & Giảng viên Chữa bài").first()
    ).toBeVisible();

    // 3. Check 3 Core Pillars & Journey Section
    await expect(
      page.getByRole("heading", { name: "Luyện Đàm Thoại Thời Gian Thực" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Luyện Viết Chuyên Sâu" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bảo Chứng Điểm Thi bởi" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Quy Trình Học Tập" })
    ).toBeVisible();
  });

  test("should allow interacting with Speaking Live and Teacher Diff previews", async ({
    page,
  }) => {
    // 1. Test Speaking Auto Play / Turn Switcher
    const switchTurnButton = page.locator(
      'button[title="Chuyển lượt hội thoại tiếp theo"]'
    );
    await expect(switchTurnButton).toBeVisible();
    await switchTurnButton.click();

    // 2. Test Teacher Review Diff Toggle
    const aiProposalTab = page.getByRole("button", {
      name: "1. AI Đề Xuất Sơ Bộ",
    });
    const teacherReviewTab = page.getByRole("button", {
      name: "2. Giáo Viên Duyệt & Sửa",
    });

    await expect(aiProposalTab).toBeVisible();
    await expect(teacherReviewTab).toBeVisible();

    // Click AI Proposal tab
    await aiProposalTab.click();
    await expect(
      page.getByText("Đề xuất sơ bộ từ AI (AiAssessmentProposal)")
    ).toBeVisible();

    // Click Teacher Review tab
    await teacherReviewTab.click();
    await expect(
      page.getByText("Bảng điểm chính thức đã duyệt (PublishedAssessment)")
    ).toBeVisible();
  });

  test("should render multi-column footer with copyright and brand information", async ({
    page,
  }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText("Chilly IELTS").first()).toBeVisible();
    await expect(footer.getByText("Tính Năng Cốt Lõi")).toBeVisible();
    await expect(footer.getByText("Tài Khoản & Truy Cập")).toBeVisible();
  });

  test("should navigate to /login when clicking Đăng nhập button", async ({
    page,
  }) => {
    const loginLink = page.getByRole("link", { name: "Đăng nhập" }).first();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText("Đăng nhập tài khoản", { exact: true })
    ).toBeVisible();
  });

  test("should navigate to /signup when clicking Bắt đầu ngay CTA", async ({
    page,
  }) => {
    const signupButton = page
      .getByRole("link", { name: "Bắt đầu ngay" })
      .first();
    await signupButton.click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByText("Tạo tài khoản mới", { exact: true })
    ).toBeVisible();
  });
});
