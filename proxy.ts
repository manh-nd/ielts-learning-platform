import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie, getCookieCache } from "better-auth/cookies";

/**
 * Optimistic route protection and role-based traffic routing.
 * Performs fast cookie-level checks at the network boundary before reaching Server Components.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Skip API routes and internal assets
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Check for session token in request cookies
  const sessionToken = getSessionCookie(request);
  const isAuthenticated = Boolean(sessionToken);

  // 3. Extract cached user data if available in Proxy (Optimistic Check)
  let userRole: string | undefined;
  if (isAuthenticated) {
    try {
      const cached = await getCookieCache(request, {
        secret: process.env.BETTER_AUTH_SECRET,
        strategy: "compact",
      });
      userRole = (cached?.user as { role?: string } | undefined)?.role;
    } catch {
      // Cookie cache decode error or secret missing; fallback to unverified role at proxy
      userRole = undefined;
    }
  }

  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isTeacherRoute = pathname.startsWith("/teacher");
  const isLearnerRoute = pathname.startsWith("/learner");
  const isProtectedRoute = isTeacherRoute || isLearnerRoute;

  // 4. Handle unauthenticated users trying to access protected routes
  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    const fullPath = pathname + (search || "");
    loginUrl.searchParams.set("redirectTo", fullPath);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Handle authenticated users visiting auth routes (/login, /signup)
  if (isAuthenticated && isAuthRoute) {
    if (userRole === "teacher") {
      return NextResponse.redirect(new URL("/teacher/review", request.url));
    }
    if (userRole === "learner") {
      return NextResponse.redirect(new URL("/learner/dashboard", request.url));
    }
    // If role cannot be determined at proxy, route to /auth/redirect for client-side resolution
    return NextResponse.redirect(new URL("/auth/redirect", request.url));
  }

  // 6. Role-based route authorization:
  // If a Learner attempts to access /teacher/*, redirect them to /learner/dashboard
  if (isAuthenticated && userRole === "learner" && isTeacherRoute) {
    return NextResponse.redirect(new URL("/learner/dashboard", request.url));
  }

  // Teachers are allowed into /learner/* for testing/previewing student assessments
  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image/asset extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wasm)$).*)",
  ],
};
