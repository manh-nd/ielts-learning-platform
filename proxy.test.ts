import { describe, it, expect, mock, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

// Mock better-auth/cookies
const mockGetSessionCookie = mock();
const mockGetCookieCache = mock();

mock.module("better-auth/cookies", () => ({
  getSessionCookie: mockGetSessionCookie,
  getCookieCache: mockGetCookieCache,
}));

function createMockRequest(url: string, cookieHeader?: string): NextRequest {
  const req = new NextRequest(new URL(url, "https://example.com"), {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  return req;
}

describe("Route Protection Proxy", () => {
  beforeEach(() => {
    mockGetSessionCookie.mockReset();
    mockGetCookieCache.mockReset();
  });

  describe("API and Static Asset Bypass", () => {
    it("should bypass API routes without checking session", async () => {
      const req = createMockRequest("https://example.com/api/auth/get-session");
      const res = await proxy(req);
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
      expect(res.status).toBe(200);
      expect(mockGetSessionCookie).not.toHaveBeenCalled();
    });

    it("should bypass Next.js internal static assets", async () => {
      const req = createMockRequest("https://example.com/_next/static/test.js");
      const res = await proxy(req);
      expect(res.status).toBe(200);
      expect(mockGetSessionCookie).not.toHaveBeenCalled();
    });

    it("should bypass favicon.ico", async () => {
      const req = createMockRequest("https://example.com/favicon.ico");
      const res = await proxy(req);
      expect(res.status).toBe(200);
      expect(mockGetSessionCookie).not.toHaveBeenCalled();
    });
  });

  describe("Unauthenticated Requests", () => {
    beforeEach(() => {
      mockGetSessionCookie.mockReturnValue(null);
      mockGetCookieCache.mockResolvedValue(null);
    });

    it("should allow unauthenticated access to landing page /", async () => {
      const req = createMockRequest("https://example.com/");
      const res = await proxy(req);
      expect(res.status).toBe(200);
    });

    it("should allow unauthenticated access to /login and /signup", async () => {
      const reqLogin = createMockRequest("https://example.com/login");
      const resLogin = await proxy(reqLogin);
      expect(resLogin.status).toBe(200);

      const reqSignup = createMockRequest("https://example.com/signup");
      const resSignup = await proxy(reqSignup);
      expect(resSignup.status).toBe(200);
    });

    it("should redirect unauthenticated access on /learner/* to /login with redirectTo param", async () => {
      const req = createMockRequest(
        "https://example.com/learner/dashboard?view=recent"
      );
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "https://example.com/login?redirectTo=%2Flearner%2Fdashboard%3Fview%3Drecent"
      );
    });

    it("should redirect unauthenticated access on /teacher/* to /login with redirectTo param", async () => {
      const req = createMockRequest("https://example.com/teacher/review");
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "https://example.com/login?redirectTo=%2Fteacher%2Freview"
      );
    });
  });

  describe("Authenticated User Navigation", () => {
    it("should redirect authenticated Learner from /login to /learner/dashboard", async () => {
      mockGetSessionCookie.mockReturnValue("valid-token");
      mockGetCookieCache.mockResolvedValue({
        user: { role: "learner" },
      });

      const req = createMockRequest("https://example.com/login");
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "https://example.com/learner/dashboard"
      );
    });

    it("should redirect authenticated Teacher from /signup to /teacher/review", async () => {
      mockGetSessionCookie.mockReturnValue("valid-token");
      mockGetCookieCache.mockResolvedValue({
        user: { role: "teacher" },
      });

      const req = createMockRequest("https://example.com/signup");
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "https://example.com/teacher/review"
      );
    });

    it("should redirect authenticated user with unknown cached role from /login to /auth/redirect", async () => {
      mockGetSessionCookie.mockReturnValue("valid-token");
      mockGetCookieCache.mockResolvedValue(null);

      const req = createMockRequest("https://example.com/login");
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "https://example.com/auth/redirect"
      );
    });

    it("should redirect authenticated Learner trying to access /teacher/* to /learner/dashboard", async () => {
      mockGetSessionCookie.mockReturnValue("valid-token");
      mockGetCookieCache.mockResolvedValue({
        user: { role: "learner" },
      });

      const req = createMockRequest("https://example.com/teacher/prompts");
      const res = await proxy(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "https://example.com/learner/dashboard"
      );
    });

    it("should allow authenticated Teacher to access /teacher/*", async () => {
      mockGetSessionCookie.mockReturnValue("valid-token");
      mockGetCookieCache.mockResolvedValue({
        user: { role: "teacher" },
      });

      const req = createMockRequest("https://example.com/teacher/review");
      const res = await proxy(req);
      expect(res.status).toBe(200);
    });

    it("should allow authenticated Teacher to access /learner/* in preview mode", async () => {
      mockGetSessionCookie.mockReturnValue("valid-token");
      mockGetCookieCache.mockResolvedValue({
        user: { role: "teacher" },
      });

      const req = createMockRequest("https://example.com/learner/practice");
      const res = await proxy(req);
      expect(res.status).toBe(200);
    });

    it("should allow authenticated Learner to access /learner/*", async () => {
      mockGetSessionCookie.mockReturnValue("valid-token");
      mockGetCookieCache.mockResolvedValue({
        user: { role: "learner" },
      });

      const req = createMockRequest("https://example.com/learner/dashboard");
      const res = await proxy(req);
      expect(res.status).toBe(200);
    });
  });
});
