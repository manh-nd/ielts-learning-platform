import { test, expect } from "@playwright/test";

test.describe("Landing Page & Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should render brand header, hero title and feature badges", async ({
    page,
  }) => {
    // 1. Check Brand & Logo
    await expect(page.getByText("IELTS Master").first()).toBeVisible();
    await expect(page.getByText("AI Powered").first()).toBeVisible();

    // 2. Check Hero Section
    await expect(page.locator("h1")).toContainText(
      "Luyện thi IELTS Thông minh"
    );
    await expect(
      page.getByText("Gemini Live Audio & Tiptap Rich-Text")
    ).toBeVisible();

    // 3. Check 3 Core Pillars
    await expect(page.getByText("Speaking Live AI")).toBeVisible();
    await expect(page.getByText("Writing Diagnostic")).toBeVisible();
    await expect(page.getByText("Giảng viên Chấm chữa")).toBeVisible();
  });

  test("should display dev test accounts helper card", async ({ page }) => {
    await expect(
      page.getByText("teacher@ielts.liuhocngoaingu.com", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("learnerteacher@ielts.liuhocngoaingu.com", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("learner@ielts-prep.vn", { exact: true })
    ).toBeVisible();
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
    const signupButton = page.getByRole("link", { name: "Bắt đầu ngay" });
    await signupButton.click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByText("Tạo tài khoản mới", { exact: true })
    ).toBeVisible();
  });
});
