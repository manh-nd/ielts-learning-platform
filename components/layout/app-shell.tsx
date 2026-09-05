"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { getActiveNavItem } from "./navigation";
import { signOut } from "@/lib/auth-client";
import type { UserProfile } from "@/components/auth/types";
import { cn } from "@/lib/utils";

function ImmersiveRouteController({ isImmersive }: { isImmersive: boolean }) {
  const { setOpen, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    if (isImmersive) {
      setOpen(false);
      setOpenMobile(false);
    }
  }, [isImmersive, setOpen, setOpenMobile]);

  return null;
}

export interface AppShellProps {
  user: UserProfile;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  defaultOpenMobile?: boolean;
}

export function AppShell({
  user,
  children,
  className,
  defaultOpen,
  defaultOpenMobile,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const isImmersive = pathname.startsWith("/learner/speaking/live");
  const isTeacherWorkspace =
    pathname.startsWith("/teacher/review") ||
    pathname.startsWith("/teacher/submissions");

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login");
            router.refresh();
          },
        },
      });
    } catch {
      router.push("/login");
    } finally {
      setIsSigningOut(false);
    }
  };

  const activeItem = getActiveNavItem(pathname, user.role);
  const title = activeItem
    ? activeItem.title
    : user.role === "teacher"
      ? "Không gian Giảng viên"
      : "Bảng điều khiển Học viên";

  const resolvedDefaultOpen =
    defaultOpen !== undefined ? defaultOpen : !isImmersive;

  return (
    <SidebarProvider
      defaultOpen={resolvedDefaultOpen}
      defaultOpenMobile={defaultOpenMobile}
      className={className}
    >
      <ImmersiveRouteController isImmersive={isImmersive} />
      <AppSidebar
        user={user}
        collapsible={isImmersive ? "offcanvas" : "icon"}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
      />
      <SidebarInset className="flex flex-col min-h-screen">
        <AppHeader title={title} />
        <div
          data-slot="app-content-container"
          className={cn(
            "flex-1 w-full",
            isTeacherWorkspace
              ? "p-3 sm:p-4"
              : isImmersive
                ? "p-4 sm:p-6"
                : "max-w-7xl mx-auto p-4 sm:p-6"
          )}
        >
          {children}
        </div>
        {!isImmersive && (
          <footer className="border-t border-border/30 py-4 text-center text-xs text-muted-foreground mt-auto">
            <div className="mx-auto max-w-7xl px-4">
              <p>
                © {new Date().getFullYear()} Chilly IELTS • Nền tảng Luyện thi
                IELTS Thông minh kết hợp AI & Giảng viên.
              </p>
            </div>
          </footer>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
