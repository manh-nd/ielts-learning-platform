"use client";

import { LogOutIcon, Loader2Icon, ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { UserProfile } from "./types";
import { cn } from "@/lib/utils";

export interface UserNavMenuProps {
  user: UserProfile;
  onSignOut?: () => void | Promise<void>;
  isSigningOut?: boolean;
  onNavigate?: (path: string) => void;
  className?: string;
}

export function UserNavMenu({
  user,
  onSignOut,
  isSigningOut = false,
  onNavigate: _onNavigate,
  className,
}: UserNavMenuProps) {
  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "U"
    );
  };

  const isTeacher = user.role === "teacher";

  return (
    <div className={cn("w-full", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                "group/user flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-xs outline-none transition-[width,height,padding]",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring select-none",
                "data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground",
                "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center"
              )}
              aria-label="Menu tài khoản"
            >
              <Avatar
                size="sm"
                className="size-8 rounded-lg shrink-0 ring-1 ring-border/40"
              >
                {user.image && <AvatarImage src={user.image} alt={user.name} />}
                <AvatarFallback className="rounded-lg text-xs font-bold bg-primary text-primary-foreground">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden min-w-0">
                <span className="truncate font-semibold text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-[0.68rem] text-muted-foreground">
                  {isTeacher ? "Giáo viên" : "Học viên"}
                </span>
              </div>
              <ChevronDownIcon className="ml-auto size-3.5 text-muted-foreground transition-transform group-data-open:rotate-180 group-data-[collapsible=icon]:hidden shrink-0" />
            </button>
          }
        />

        <DropdownMenuContent
          align="end"
          className="w-64 p-1.5 shadow-lg border-border/60"
        >
          {/* Header Profile Info */}
          <div className="flex items-start gap-2.5 p-2 bg-muted/40 rounded-md">
            <Avatar size="default" className="ring-1 ring-border">
              {user.image && <AvatarImage src={user.image} alt={user.name} />}
              <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-semibold text-foreground">
                  {user.name}
                </span>
                {isTeacher ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[0.65rem] px-1.5 py-0 h-4"
                  >
                    Giáo viên
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-primary/40 bg-primary text-primary-foreground text-[0.65rem] px-1.5 py-0 h-4"
                  >
                    Học viên
                  </Badge>
                )}
              </div>
              <span className="truncate text-[0.68rem] text-muted-foreground mt-0.5">
                {user.email}
              </span>
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* Logout Action */}
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              disabled={isSigningOut}
              onClick={() => onSignOut && onSignOut()}
            >
              {isSigningOut ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" />
                  <span>Đang đăng xuất...</span>
                </>
              ) : (
                <>
                  <LogOutIcon />
                  <span>Đăng xuất</span>
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
