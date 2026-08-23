"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthRedirectView } from "@/components/auth/auth-redirect-view";
import { useSession } from "@/lib/auth-client";
import type { UserRole } from "@/components/auth/types";

function AuthRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  const { data: session, isPending, error } = useSession();
  const [isTimedOut, setIsTimedOut] = React.useState(false);

  const role = (session?.user as { role?: UserRole })?.role || null;

  const determineDestination = React.useCallback(
    (userRole?: UserRole | null): string => {
      if (
        redirectTo &&
        !redirectTo.startsWith("/auth/redirect") &&
        redirectTo !== "/login"
      ) {
        // Prevent learner from accessing teacher routes via redirectTo param
        if (userRole === "learner" && redirectTo.startsWith("/teacher")) {
          return "/learner/dashboard";
        }
        return redirectTo;
      }
      if (userRole === "teacher") {
        return "/teacher/review";
      }
      return "/learner/dashboard";
    },
    [redirectTo]
  );

  React.useEffect(() => {
    if (isPending || session?.user || error) return;
    const timer = setTimeout(() => {
      setIsTimedOut(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isPending, session?.user, error]);

  React.useEffect(() => {
    if (!session?.user) return;
    const targetUrl = determineDestination(role);
    const redirectTimer = setTimeout(() => {
      router.replace(targetUrl);
    }, 400);
    return () => clearTimeout(redirectTimer);
  }, [session?.user, role, determineDestination, router]);

  const handleManualRedirect = () => {
    const targetUrl = determineDestination(role);
    router.replace(targetUrl);
  };

  const handleRetry = () => {
    window.location.reload();
  };

  const handleBackToLogin = () => {
    router.replace("/login");
  };

  const isError =
    Boolean(error) || (!isPending && !session?.user && isTimedOut);
  const status = isError ? "error" : session?.user ? "redirecting" : "loading";
  const errorMessage = error
    ? "Không thể xác thực phiên đăng nhập. Vui lòng đăng nhập lại."
    : isTimedOut && !session?.user
      ? "Phiên đăng nhập đã hết hạn hoặc chưa được tạo."
      : null;

  return (
    <AuthRedirectView
      role={role}
      destinationPath={determineDestination(role)}
      status={status}
      errorMessage={errorMessage}
      onRetry={handleRetry}
      onManualRedirect={handleManualRedirect}
      onBackToLogin={handleBackToLogin}
    />
  );
}

export default function AuthRedirectPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <AuthRedirectContent />
    </React.Suspense>
  );
}
