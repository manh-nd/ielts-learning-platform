"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  GraduationCapIcon,
  SparklesIcon,
  MicIcon,
  PenToolIcon,
  SchoolIcon,
} from "lucide-react";
import { UserNavMenu } from "./user-nav-menu";
import { signOut } from "@/lib/auth-client";
import type { UserProfile } from "./types";
import { cn } from "@/lib/utils";

export interface ProtectedHeaderProps {
  user: UserProfile;
}

export function ProtectedHeader({ user }: ProtectedHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const isTeacher = user.role === "teacher";

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

  const navLinks = isTeacher
    ? [
        {
          href: "/teacher/review",
          label: "Không gian Chấm bài",
          icon: PenToolIcon,
        },
        {
          href: "/teacher/classrooms",
          label: "Quản lý Lớp học",
          icon: SchoolIcon,
        },
        {
          href: "/learner/dashboard",
          label: "Chế độ Xem Học viên",
          icon: SparklesIcon,
        },
      ]
    : [
        {
          href: "/learner/dashboard",
          label: "Tổng quan Dashboard",
          icon: SparklesIcon,
        },
        {
          href: "/learner/speaking/live",
          label: "Speaking Practice",
          icon: MicIcon,
        },
      ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand & Nav */}
        <div className="flex items-center gap-6">
          <Link
            href={isTeacher ? "/teacher/review" : "/learner/dashboard"}
            className="flex items-center gap-2 text-sm font-semibold tracking-tight transition-opacity hover:opacity-90"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <GraduationCapIcon className="size-5" />
            </div>
            <span className="font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Chilly IELTS
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Navigation Dropdown */}
        <div className="flex items-center gap-3">
          <UserNavMenu
            user={user}
            isSigningOut={isSigningOut}
            onSignOut={handleSignOut}
            onNavigate={(path) => router.push(path)}
          />
        </div>
      </div>
    </header>
  );
}
