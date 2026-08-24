import { test, expect } from "@playwright/test";
import { mockAuthError } from "./fixtures/auth-fixtures";

test.describe("Error Handling & Edge Cases", () => {
  test("should display invalid credentials error banner on 401 response", async ({
    page,
  }) => {
    await mockAuthError(page, {
      status: 401,
      message: "Invalid password",
    });

    await page.goto("/login");
    await page.locator("#login-email").fill("wrong@example.com");
    await page.locator("#login-password").fill("WrongPassword123!");

    const submitButton = page.getByRole("button", {
      name: "Đăng nhập",
      exact: true,
    });
    await submitButton.click();

    await expect(
      page.getByText("Địa chỉ email hoặc mật khẩu không chính xác.")
    ).toBeVisible();
  });

  test("should display friendly server error when DB is unavailable (500)", async ({
    page,
  }) => {
    await mockAuthError(page, {
      status: 500,
      code: "DB_CONNECTION_ERROR",
      message: "ECONNREFUSED: Connection refused",
    });

    await page.goto("/login");
    await page.locator("#login-email").fill("user@example.com");
    await page.locator("#login-password").fill("Password123!");

    const submitButton = page.getByRole("button", {
      name: "Đăng nhập",
      exact: true,
    });
    await submitButton.click();

    await expect(
      page.getByText("Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.")
    ).toBeVisible();
  });

  test("should show error view with retry & login buttons on /auth/redirect when unauthenticated", async ({
    page,
  }) => {
    // Intercept get-session with null/empty session
    await page.route("**/api/auth/get-session**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(null),
      });
    });

    await page.goto("/auth/redirect");

    // Wait for the timeout error state
    await expect(page.getByText("Không thể hoàn tất điều hướng")).toBeVisible({
      timeout: 6000,
    });

    await expect(
      page.getByRole("button", { name: /Quay lại trang Đăng nhập/i })
    ).toBeVisible();
  });
});
