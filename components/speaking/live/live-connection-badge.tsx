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
          "gap-1.5 text-xs text-muted-foreground font-medium animate-pulse",
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
          "gap-1.5 text-xs text-muted-foreground font-medium animate-pulse",
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
          variant="secondary"
          data-testid="live-status-badge"
          className={cn(
            "gap-1.5 text-xs shadow-xs animate-pulse border",
            className
          )}
        >
          <Volume2 className="w-3.5 h-3.5 animate-bounce text-muted-foreground" />
          Giám khảo đang nói
        </Badge>
      );
    }

    if (voiceActivity === "user_speaking") {
      return (
        <Badge
          variant="default"
          data-testid="live-status-badge"
          className={cn("gap-1.5 text-xs shadow-xs animate-pulse", className)}
        >
          <span className="w-2 h-2 rounded-full bg-primary-foreground animate-ping" />
          Bạn đang nói
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        data-testid="live-status-badge"
        className={cn(
          "gap-1.5 text-xs border-primary/40 text-primary bg-primary/5",
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

  if (status === "permission_denied") {
    return (
      <Badge
        variant="destructive"
        data-testid="live-status-badge"
        className={cn("gap-1.5 text-xs", className)}
      >
        <AlertCircle className="w-3 h-3" />
        Micro bị chặn
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
