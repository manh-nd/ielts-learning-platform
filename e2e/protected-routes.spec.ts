import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  MOCK_TEACHER,
  MOCK_LEARNER,
} from "./fixtures/auth-fixtures";

test.describe("Protected Routes & Role Authorization", () => {
  test.describe("Unauthenticated Access Protection", () => {
    test("should redirect unauthenticated visitor from /teacher/review to /login", async ({
      page,
    }) => {
      await page.goto("/teacher/review");
      await expect(page).toHaveURL(/\/login\?redirectTo=%2Fteacher%2Freview/);
      await expect(
        page.getByText("Đăng nhập tài khoản", { exact: true })
      ).toBeVisible();
    });

    test("should redirect unauthenticated visitor from /learner/dashboard to /login", async ({
      page,
    }) => {
      await page.goto("/learner/dashboard");
      await expect(page).toHaveURL(
        /\/login\?redirectTo=%2Flearner%2Fdashboard/
      );
      await expect(
        page.getByText("Đăng nhập tài khoản", { exact: true })
      ).toBeVisible();
    });
  });

  test.describe("Role-Based Dashboard Navigation (Mocked Session)", () => {
    test("should allow Teacher to access /teacher/review and display teacher workspace", async ({
      page,
    }) => {
      await mockAuthenticatedUser(page, MOCK_TEACHER);
      await page.goto("/teacher/review");

      // Verify header & brand
      await expect(page.getByText("Chilly IELTS").first()).toBeVisible();

      // Verify review workspace elements
      await expect(
        page.getByText(/Không gian Chấm bài & Phản hồi Chuyên sâu/i)
      ).toBeVisible();
      await expect(page.getByText("Nguyễn Minh Khang")).toBeVisible();
    });

    test("should allow Learner to access /learner/dashboard and display practice options", async ({
      page,
    }) => {
      await mockAuthenticatedUser(page, MOCK_LEARNER);
      await page.goto("/learner/dashboard");

      // Verify dashboard content
      await expect(page.locator("h1")).toContainText("Xin chào");
      await expect(
        page.getByRole("heading", { name: "IELTS Speaking Practice" })
      ).toBeVisible();
      await expect(
        page.locator("#speaking a[href='/learner/speaking/live']")
      ).toBeVisible();

      // Negative assertions: no Writing card, no fake band scores, no fake history
      await expect(
        page.getByText("IELTS Writing Essay Assessment")
      ).not.toBeVisible();
      await expect(page.getByText("Mục tiêu Band")).not.toBeVisible();
      await expect(page.getByText("Tổng quan Kỹ năng")).not.toBeVisible();
      await expect(page.getByText("Lịch sử Luyện tập")).not.toBeVisible();
    });

    test("should force sidebar closed off-canvas upon client-side transition to /learner/speaking/live", async ({
      page,
    }) => {
      await mockAuthenticatedUser(page, MOCK_LEARNER);
      await page.goto("/learner/dashboard");

      // Verify desktop sidebar is initially expanded with icon collapsible mode
      const sidebar = page.locator("div[data-slot='sidebar'][data-state]");
      await expect(sidebar).toHaveAttribute("data-state", "expanded");
      await expect(sidebar).toHaveAttribute("data-collapsible", "");

      // Click link to enter Live Speaking
      const liveSpeakingLink = page.locator(
        "#speaking a[href='/learner/speaking/live']"
      );
      await expect(liveSpeakingLink).toBeVisible();
      await liveSpeakingLink.click();

      // Verify client-side route navigation completed
      await expect(page).toHaveURL(/\/learner\/speaking\/live/);

      // Verify sidebar is reactively forced closed with offcanvas mode (no icon rail)
      await expect(sidebar).toHaveAttribute("data-state", "collapsed");
      await expect(sidebar).toHaveAttribute("data-collapsible", "offcanvas");

      // Verify footer is omitted in immersive mode
      await expect(
        page.getByText(/Nền tảng Luyện thi IELTS Thông minh/i)
      ).not.toBeVisible();
    });

    test("should handle user dropdown menu and trigger logout", async ({
      page,
    }) => {
      await mockAuthenticatedUser(page, MOCK_TEACHER);
      await page.goto("/teacher/review");

      // Open user dropdown menu
      const userMenuTrigger = page.locator(
        "button[aria-label='Menu tài khoản']"
      );
      await expect(userMenuTrigger).toBeVisible();
      await userMenuTrigger.click();

      // Verify menu content
      await expect(page.getByText(MOCK_TEACHER.name).first()).toBeVisible();
      await expect(page.getByText("Giáo viên").first()).toBeVisible();

      // Click logout
      const logoutItem = page.getByRole("menuitem", { name: /Đăng xuất/i });
      await logoutItem.click();

      await expect(page).toHaveURL(/\/login/);
    });
  });
});
