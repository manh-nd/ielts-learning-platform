"use client";

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
        className={cn(
          "gap-1.5 text-xs text-foreground/80 font-medium",
          className
        )}
      >
        <Radio className="w-3 h-3 text-primary" />
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
          "gap-1.5 text-xs border-amber-500/30 text-amber-800 dark:text-amber-300 font-semibold animate-pulse",
          className
        )}
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Đang khởi tạo phiên...
      </Badge>
    );
  }

  if (status === "connecting") {
    return (
      <Badge
        variant="outline"
        data-testid="live-status-badge"
        className={cn(
          "gap-1.5 text-xs border-blue-500/30 text-blue-800 dark:text-blue-300 font-semibold animate-pulse",
          className
        )}
      >
        <Wifi className="w-3 h-3 animate-pulse" />
        Đang kết nối phòng thi...
      </Badge>
    );
  }

  if (status === "connected") {
    if (voiceActivity === "ai_speaking") {
      return (
        <Badge
          data-testid="live-status-badge"
          className={cn(
            "gap-1.5 text-xs bg-indigo-700 text-white hover:bg-indigo-800 shadow-sm animate-pulse border-none",
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
            "gap-1.5 text-xs bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm animate-pulse border-none",
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
          "gap-1.5 text-xs bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300",
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
        Lỗi kết nối
      </Badge>
    );
  }

  return null;
}
