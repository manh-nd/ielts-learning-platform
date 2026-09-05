"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCapIcon } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { UserNavMenu } from "@/components/auth/user-nav-menu";
import type { UserProfile } from "@/components/auth/types";
import { getNavItemsForRole, isNavItemActive } from "./navigation";
import { cn } from "@/lib/utils";

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: UserProfile;
  onSignOut?: () => void | Promise<void>;
  isSigningOut?: boolean;
}

export function AppSidebar({
  user,
  onSignOut,
  isSigningOut = false,
  collapsible = "icon",
  className,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname();
  const isTeacher = user.role === "teacher";
  const navItems = getNavItemsForRole(user.role);

  return (
    <Sidebar
      collapsible={collapsible}
      className={cn("border-r border-sidebar-border", className)}
      {...props}
    >
      <SidebarHeader className="h-14 border-b border-sidebar-border/50 px-3 flex flex-row items-center justify-between">
        <Link
          href={isTeacher ? "/teacher/review" : "/learner/dashboard"}
          className="flex items-center gap-2 text-sm font-semibold tracking-tight transition-opacity hover:opacity-90 overflow-hidden"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <GraduationCapIcon className="size-5" />
          </div>
          <span className="font-bold bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/80 bg-clip-text truncate group-data-[collapsible=icon]:hidden">
            Chilly IELTS
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.68rem] tracking-wider text-muted-foreground uppercase group-data-[collapsible=icon]:hidden">
            Điều hướng
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(pathname, item);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                      className={cn(
                        "transition-colors",
                        isActive &&
                          "bg-primary/10 text-primary font-semibold hover:bg-primary/15 hover:text-primary"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-2 flex items-center justify-between group-data-[collapsible=icon]:justify-center">
        <UserNavMenu
          user={user}
          onSignOut={onSignOut}
          isSigningOut={isSigningOut}
          className="w-full group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center"
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
