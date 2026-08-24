import { type Page } from "@playwright/test";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "learner";
  image?: string | null;
}

export const MOCK_TEACHER: MockUser = {
  id: "usr_mock_teacher_01",
  name: "IELTS Teacher Dev",
  email: "teacher@ielts.liuhocngoaingu.com",
  role: "teacher",
  image: null,
};

export const MOCK_LEARNER: MockUser = {
  id: "usr_mock_learner_01",
  name: "IELTS Learner Dev",
  email: "learner@ielts-prep.vn",
  role: "learner",
  image: null,
};

/**
 * Intercepts Better Auth API routes and sets session cookies to simulate
 * an authenticated session without requiring an active PostgreSQL database connection.
 */
export async function mockAuthenticatedUser(page: Page, user: MockUser) {
  const session = {
    id: `sess_${user.id}`,
    userId: user.id,
    token: `token_${user.id}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const payload = JSON.stringify({ user, session });

  // Add cookies to browser context for server-side Next.js proxy and SSR
  await page.context().addCookies([
    {
      name: "e2e_mock_session",
      value: encodeURIComponent(payload),
      url: "http://localhost:3001",
    },
    {
      name: "better-auth.session_token",
      value: session.token,
      url: "http://localhost:3001",
    },
    {
      name: "e2e_mock_session",
      value: encodeURIComponent(payload),
      url: "http://localhost:3000",
    },
    {
      name: "better-auth.session_token",
      value: session.token,
      url: "http://localhost:3000",
    },
  ]);

  // 1. Mock get-session API for Client Components
  await page.route("**/api/auth/get-session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session,
        user,
      }),
    });
  });

  // 2. Mock sign-in API
  await page.route("**/api/auth/sign-in/email**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session,
        user,
      }),
    });
  });

  // 3. Mock sign-out API
  await page.route("**/api/auth/sign-out**", async (route) => {
    await page.context().clearCookies();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}

/**
 * Intercepts auth endpoints to simulate specific error conditions (e.g. invalid credentials, DB down).
 */
export async function mockAuthError(
  page: Page,
  options: {
    status: number;
    code?: string;
    message: string;
  }
) {
  await page.route("**/api/auth/sign-in/email**", async (route) => {
    await route.fulfill({
      status: options.status,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          status: options.status,
          code: options.code || "AUTH_ERROR",
          message: options.message,
        },
      }),
    });
  });
}
