import type { ComponentType } from "react";
import { PenToolIcon, SchoolIcon, SparklesIcon, MicIcon } from "lucide-react";
import type { UserRole } from "@/components/auth/types";

export interface NavItem {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  matchPrefixes?: string[];
  exact?: boolean;
}

export const TEACHER_NAV_ITEMS: NavItem[] = [
  {
    title: "Không gian Chấm bài",
    href: "/teacher/review",
    icon: PenToolIcon,
    matchPrefixes: ["/teacher/submissions"],
  },
  {
    title: "Quản lý Lớp học",
    href: "/teacher/classrooms",
    icon: SchoolIcon,
  },
  {
    title: "Chế độ Xem Học viên",
    href: "/learner/dashboard",
    icon: SparklesIcon,
    exact: true,
  },
];

export const LEARNER_NAV_ITEMS: NavItem[] = [
  {
    title: "Tổng quan Dashboard",
    href: "/learner/dashboard",
    icon: SparklesIcon,
    matchPrefixes: ["/learner/assignments"],
  },
  {
    title: "Speaking Practice",
    href: "/learner/speaking/live",
    icon: MicIcon,
  },
];

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return role === "teacher" ? TEACHER_NAV_ITEMS : LEARNER_NAV_ITEMS;
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }
  if (
    item.matchPrefixes?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return true;
  }
  return false;
}

export function getActiveNavItem(
  pathname: string,
  role: UserRole
): NavItem | undefined {
  const items = getNavItemsForRole(role);
  return items.find((item) => isNavItemActive(pathname, item));
}
