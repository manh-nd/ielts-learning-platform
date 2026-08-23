import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "./auth";
import { UnauthorizedError, ForbiddenError } from "./errors";
import type { UserRole } from "@/modules/identity/infrastructure/auth-schema";

/**
 * Retrieves the current session from the server using Better Auth.
 * Reads request headers asynchronously if not explicitly provided.
 */
export async function getServerSession(
  reqHeaders?: Headers
): Promise<Session | null> {
  const h = reqHeaders ?? (await headers());
  return auth.api.getSession({ headers: h });
}

/**
 * Asserts that a valid authenticated session exists.
 * Throws UnauthorizedError if unauthenticated.
 */
export async function requireAuth(reqHeaders?: Headers): Promise<Session> {
  const session = await getServerSession(reqHeaders);
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

/**
 * Asserts that the authenticated user has one of the allowed roles.
 * Throws UnauthorizedError if unauthenticated, or ForbiddenError if role does not match.
 */
export async function requireRole(
  allowedRoles: UserRole | UserRole[],
  reqHeaders?: Headers
): Promise<Session> {
  const session = await requireAuth(reqHeaders);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const userRole = session.user.role as UserRole;

  if (!roles.includes(userRole)) {
    throw new ForbiddenError(
      `Bị từ chối truy cập: Thao tác này yêu cầu vai trò [${roles.join(", ")}]. Vai trò hiện tại của bạn là [${userRole}].`,
      { requiredRoles: roles, currentRole: userRole }
    );
  }

  return session;
}

/**
 * Page / Server Component helper: ensures user is logged in, or redirects to login.
 */
export async function requireAuthOrRedirect(
  redirectTo = "/login",
  reqHeaders?: Headers
): Promise<Session> {
  const session = await getServerSession(reqHeaders);
  if (!session) {
    redirect(redirectTo);
  }
  return session;
}

/**
 * Page / Server Component helper: ensures user has required role, or redirects to their dashboard fallback.
 */
export async function requireRoleOrRedirect(
  allowedRoles: UserRole | UserRole[],
  fallbackUrl?: string,
  reqHeaders?: Headers
): Promise<Session> {
  const session = await requireAuthOrRedirect("/login", reqHeaders);
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const userRole = session.user.role as UserRole;

  if (!roles.includes(userRole)) {
    const defaultFallback =
      userRole === "teacher" ? "/teacher/review" : "/learner/dashboard";
    redirect(fallbackUrl ?? defaultFallback);
  }

  return session;
}

/**
 * Checks if a user object has the 'teacher' role.
 */
export function isTeacher(user?: { role?: string } | null): boolean {
  return user?.role === "teacher";
}

/**
 * Checks if a user object has the 'learner' role.
 */
export function isLearner(user?: { role?: string } | null): boolean {
  return user?.role === "learner";
}
