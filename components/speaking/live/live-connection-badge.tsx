"use client";

import React from "react";
import { Wifi, Loader2, Volume2, Mic, Radio, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { LiveSessionStatus, VoiceActivityState } from "./types";

export interface LiveConnectionBadgeProps {
  status: LiveSessionStatus;
  voiceActivity?: VoiceActivityState;
  className?: string;
}

export function LiveConnectionBadge({
  status,
  voiceActivity = "idle",
  className,
}: LiveConnectionBadgeProps) {
  if (status === "idle") {
    return (
      <Badge
        variant="outline"
        data-testid="live-status-badge"
        className={cn("gap-1.5 text-xs text-muted-foreground", className)}
      >
        <Radio className="w-3 h-3 text-muted-foreground" />
        Sẵn sàng kết nối
      </Badge>
    );
  }

  if (status === "requesting_token") {
    return (
      <Badge
        variant="outline"
        data-testid="live-status-badge"
        className={cn(
          "gap-1.5 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 animate-pulse",
          className
        )}
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Cấp Token bảo mật...
      </Badge>
    );
  }

  if (status === "connecting") {
    return (
      <Badge
        variant="outline"
        data-testid="live-status-badge"
        className={cn(
          "gap-1.5 text-xs border-blue-500/30 text-blue-600 dark:text-blue-400 animate-pulse",
          className
        )}
      >
        <Wifi className="w-3 h-3 animate-pulse" />
        Kết nối Live API...
      </Badge>
    );
  }

  if (status === "connected") {
    if (voiceActivity === "ai_speaking") {
      return (
        <Badge
          data-testid="live-status-badge"
          className={cn(
            "gap-1.5 text-xs bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm animate-pulse border-none",
            className
          )}
        >
          <Volume2 className="w-3.5 h-3.5 animate-bounce" />
          Giám khảo đang nói
        </Badge>
      );
    }

    if (voiceActivity === "user_speaking") {
      return (
        <Badge
          data-testid="live-status-badge"
          className={cn(
            "gap-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm animate-pulse border-none",
            className
          )}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          Bạn đang nói
        </Badge>
      );
    }

    return (
      <Badge
        data-testid="live-status-badge"
        className={cn(
          "gap-1.5 text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
          className
        )}
      >
        <Mic className="w-3 h-3" />
        Đang lắng nghe
      </Badge>
    );
  }

  if (status === "disconnecting") {
    return (
      <Badge
        variant="secondary"
        data-testid="live-status-badge"
        className={cn("gap-1.5 text-xs", className)}
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Đang ngắt kết nối...
      </Badge>
    );
  }

  if (status === "error") {
    return (
      <Badge
        variant="destructive"
        data-testid="live-status-badge"
        className={cn("gap-1.5 text-xs", className)}
      >
        <AlertCircle className="w-3 h-3" />
        Lỗi kết nối Live
      </Badge>
    );
  }

  return null;
}
