import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  getServerSession,
  requireAuth,
  requireRole,
  requireAuthOrRedirect,
  requireRoleOrRedirect,
  isTeacher,
  isLearner,
} from "./authorization";
import { UnauthorizedError, ForbiddenError } from "./errors";
import { auth } from "./auth";

// Mock auth.api.getSession
const mockGetSession = mock();
auth.api.getSession = mockGetSession as unknown as typeof auth.api.getSession;

// Mock next/navigation redirect
const mockRedirect = mock((url: string) => {
  const err = new Error(`NEXT_REDIRECT: ${url}`);
  // @ts-expect-error - simulate Next.js digest
  err.digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw err;
});

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}));

describe("Server Authorization Helpers", () => {
  const mockLearnerSession = {
    session: {
      id: "session-1",
      userId: "user-1",
      token: "tok-1",
      expiresAt: new Date(Date.now() + 100000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: "user-1",
      name: "Learner User",
      email: "learner@example.com",
      role: "learner",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockTeacherSession = {
    session: {
      id: "session-2",
      userId: "user-2",
      token: "tok-2",
      expiresAt: new Date(Date.now() + 100000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: "user-2",
      name: "Teacher User",
      email: "teacher@example.com",
      role: "teacher",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    mockGetSession.mockReset();
    mockRedirect.mockClear();
  });

  describe("getServerSession", () => {
    it("should return session when authenticated", async () => {
      mockGetSession.mockResolvedValue(mockLearnerSession);
      const session = await getServerSession(new Headers());
      expect(session).toEqual(mockLearnerSession as unknown as typeof session);
    });

    it("should return null when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);
      const session = await getServerSession(new Headers());
      expect(session).toBeNull();
    });
  });

  describe("requireAuth", () => {
    it("should return session if authenticated", async () => {
      mockGetSession.mockResolvedValue(mockLearnerSession);
      const session = await requireAuth(new Headers());
      expect(session).toEqual(mockLearnerSession as unknown as typeof session);
    });

    it("should throw UnauthorizedError if unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);
      expect(requireAuth(new Headers())).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("requireRole", () => {
    it("should return session if user has exact single required role", async () => {
      mockGetSession.mockResolvedValue(mockTeacherSession);
      const session = await requireRole("teacher", new Headers());
      expect(session.user.role).toBe("teacher");
    });

    it("should return session if user has one of multiple allowed roles", async () => {
      mockGetSession.mockResolvedValue(mockLearnerSession);
      const session = await requireRole(["learner", "teacher"], new Headers());
      expect(session.user.role).toBe("learner");
    });

    it("should throw UnauthorizedError if user is not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);
      expect(requireRole("teacher", new Headers())).rejects.toThrow(
        UnauthorizedError
      );
    });

    it("should throw ForbiddenError if user role is not in allowed list", async () => {
      mockGetSession.mockResolvedValue(mockLearnerSession);
      expect(requireRole("teacher", new Headers())).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe("requireAuthOrRedirect", () => {
    it("should return session when user is logged in", async () => {
      mockGetSession.mockResolvedValue(mockLearnerSession);
      const session = await requireAuthOrRedirect("/login", new Headers());
      expect(session).toEqual(mockLearnerSession as unknown as typeof session);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should redirect to target when user is not logged in", async () => {
      mockGetSession.mockResolvedValue(null);
      expect(
        requireAuthOrRedirect("/custom-login", new Headers())
      ).rejects.toThrow("NEXT_REDIRECT: /custom-login");
    });
  });

  describe("requireRoleOrRedirect", () => {
    it("should return session when role matches", async () => {
      mockGetSession.mockResolvedValue(mockTeacherSession);
      const session = await requireRoleOrRedirect(
        "teacher",
        undefined,
        new Headers()
      );
      expect(session.user.role).toBe("teacher");
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should redirect to /login when unauthenticated", async () => {
      mockGetSession.mockResolvedValue(null);
      expect(
        requireRoleOrRedirect("teacher", undefined, new Headers())
      ).rejects.toThrow("NEXT_REDIRECT: /login");
    });

    it("should redirect learner to /learner/dashboard when accessing teacher role without custom fallback", async () => {
      mockGetSession.mockResolvedValue(mockLearnerSession);
      expect(
        requireRoleOrRedirect("teacher", undefined, new Headers())
      ).rejects.toThrow("NEXT_REDIRECT: /learner/dashboard");
    });

    it("should redirect to custom fallback URL when role is insufficient", async () => {
      mockGetSession.mockResolvedValue(mockLearnerSession);
      expect(
        requireRoleOrRedirect("teacher", "/access-denied", new Headers())
      ).rejects.toThrow("NEXT_REDIRECT: /access-denied");
    });
  });

  describe("Role Predicate Helpers", () => {
    it("isTeacher should identify teacher role correctly", () => {
      expect(isTeacher({ role: "teacher" })).toBe(true);
      expect(isTeacher({ role: "learner" })).toBe(false);
      expect(isTeacher(null)).toBe(false);
      expect(isTeacher(undefined)).toBe(false);
    });

    it("isLearner should identify learner role correctly", () => {
      expect(isLearner({ role: "learner" })).toBe(true);
      expect(isLearner({ role: "teacher" })).toBe(false);
      expect(isLearner(null)).toBe(false);
      expect(isLearner(undefined)).toBe(false);
    });
  });
});
