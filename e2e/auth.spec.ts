import { test, expect } from "@playwright/test";
import { mockAuthenticatedUser, MOCK_TEACHER } from "./fixtures/auth-fixtures";

test.describe("Authentication Forms & Interactions", () => {
  test.describe("Login Page (/login)", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/login");
    });

    test("should render login form with fields and quick-fill dev credentials", async ({
      page,
    }) => {
      await expect(page.locator("label[for='login-email']")).toBeVisible();
      await expect(page.locator("label[for='login-password']")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Đăng nhập", exact: true })
      ).toBeVisible();

      // Quick fill dev helpers
      await expect(
        page.getByRole("button", {
          name: /^teacher@ielts\.liuhocngoaingu\.com/i,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /^learnerteacher@ielts\.liuhocngoaingu\.com/i,
        })
      ).toBeVisible();
    });

    test("should autofill email when clicking quick-fill buttons", async ({
      page,
    }) => {
      const teacherButton = page.getByRole("button", {
        name: /^teacher@ielts\.liuhocngoaingu\.com/i,
      });
      await teacherButton.click();

      const emailInput = page.locator("#login-email");
      await expect(emailInput).toHaveValue("teacher@ielts.liuhocngoaingu.com");
    });

    test("should toggle password visibility", async ({ page }) => {
      const passwordInput = page.locator("#login-password");
      await passwordInput.fill("Secret123!");
      await expect(passwordInput).toHaveAttribute("type", "password");

      const toggleButton = page.locator("button[aria-label='Hiện mật khẩu']");
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute("type", "text");

      const hideButton = page.locator("button[aria-label='Ẩn mật khẩu']");
      await hideButton.click();
      await expect(passwordInput).toHaveAttribute("type", "password");
    });

    test("should display validation errors for empty/invalid fields", async ({
      page,
    }) => {
      const submitButton = page.getByRole("button", {
        name: "Đăng nhập",
        exact: true,
      });
      await submitButton.click();

      await expect(
        page.getByText("Vui lòng nhập địa chỉ email.")
      ).toBeVisible();
      await expect(page.getByText("Vui lòng nhập mật khẩu.")).toBeVisible();

      // Type invalid email
      await page.locator("#login-email").fill("invalid-email");
      await submitButton.click();
      await expect(
        page.getByText("Địa chỉ email không đúng định dạng.")
      ).toBeVisible();
    });

    test("should successfully login teacher and redirect to /auth/redirect in mock mode", async ({
      page,
    }) => {
      await mockAuthenticatedUser(page, MOCK_TEACHER);

      await page.locator("#login-email").fill(MOCK_TEACHER.email);
      await page.locator("#login-password").fill("Password123!");

      const submitButton = page.getByRole("button", {
        name: "Đăng nhập",
        exact: true,
      });
      await submitButton.click();

      await expect(page).toHaveURL(/\/auth\/redirect|\/teacher\/review/);
    });
  });

  test.describe("SignUp Page (/signup)", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/signup");
    });

    test("should render signup form with name, email, password strength meter and confirm password", async ({
      page,
    }) => {
      await expect(page.locator("label[for='signup-name']")).toBeVisible();
      await expect(page.locator("label[for='signup-email']")).toBeVisible();
      await expect(page.locator("label[for='signup-password']")).toBeVisible();
      await expect(
        page.locator("label[for='signup-confirm-password']")
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Tạo tài khoản" })
      ).toBeVisible();
    });

    test("should dynamically update password strength meter and criteria checklist", async ({
      page,
    }) => {
      const passwordInput = page.locator("#signup-password");

      // 1. Weak password (score 1)
      await passwordInput.fill("abc");
      await expect(page.getByText("Độ mạnh mật khẩu:")).toBeVisible();
      await expect(page.getByText("Yếu")).toBeVisible();

      // 2. Medium/Strong password with uppercase, lowercase, numbers and special chars
      await passwordInput.fill("StrongPass123!");
      await expect(page.getByText(/Mạnh|Rất mạnh/)).toBeVisible();
      await expect(page.getByText("Tối thiểu 8 ký tự")).toBeVisible();
      await expect(page.getByText("1 chữ hoa (A-Z)")).toBeVisible();
      await expect(page.getByText("1 chữ thường (a-z)")).toBeVisible();
      await expect(page.getByText("Số hoặc ký tự đặc biệt")).toBeVisible();
    });

    test("should validate mismatched passwords", async ({ page }) => {
      await page.locator("#signup-name").fill("Nguyễn Văn A");
      await page.locator("#signup-email").fill("test@example.com");
      await page.locator("#signup-password").fill("Password123!");
      await page
        .locator("#signup-confirm-password")
        .fill("DifferentPassword123!");

      const submitButton = page.getByRole("button", { name: "Tạo tài khoản" });
      await submitButton.click();

      await expect(
        page.getByText("Mật khẩu xác nhận không trùng khớp.")
      ).toBeVisible();
    });
  });
});
