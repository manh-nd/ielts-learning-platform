"use client";

import * as React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

export function AppHeader({ title, className, children }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/85 px-4 backdrop-blur-md transition-[width,height] ease-linear",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        {title && (
          <>
            <Separator orientation="vertical" />
            <h2 className="text-xs sm:text-sm font-medium text-foreground truncate leading-none">
              {title}
            </h2>
          </>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
