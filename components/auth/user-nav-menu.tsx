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
    <div className={cn("inline-flex items-center", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="group flex items-center gap-2 rounded-full p-1 pr-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:pr-1 transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
              aria-label="Menu tài khoản"
            >
              <Avatar size="sm" className="ring-1 ring-border">
                {user.image && <AvatarImage src={user.image} alt={user.name} />}
                <AvatarFallback className="text-[0.65rem] font-bold bg-primary text-primary-foreground">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[120px] truncate text-xs font-medium text-foreground text-left hidden sm:inline-block group-data-[collapsible=icon]:hidden">
                {user.name}
              </span>
              <ChevronDownIcon className="size-3 text-muted-foreground transition-transform group-data-open:rotate-180 group-data-[collapsible=icon]:hidden" />
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
