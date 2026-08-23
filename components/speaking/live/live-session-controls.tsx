"use client";

import { Mic, MicOff, PhoneOff, Play, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LiveSessionStatus } from "./types";

export interface LiveSessionControlsProps {
  status: LiveSessionStatus;
  isMuted: boolean;
  isNoiseSuppressionActive?: boolean;
  inputVolume?: number; // 0.0 to 1.0
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMute: () => void;
  onToggleNoiseSuppression?: () => void;
  className?: string;
  connectLabel?: string;
}

export function LiveSessionControls({
  status,
  isMuted,
  isNoiseSuppressionActive = true,
  inputVolume = 0,
  onConnect,
  onDisconnect,
  onToggleMute,
  onToggleNoiseSuppression,
  className,
  connectLabel = "Bắt đầu thi với Giám khảo AI",
}: LiveSessionControlsProps) {
  if (status === "idle" || status === "error") {
    return (
      <div
        data-testid="live-session-controls"
        className={cn("flex items-center justify-center p-2", className)}
      >
        <Button
          type="button"
          size="lg"
          variant="default"
          data-testid="connect-live-btn"
          onClick={onConnect}
          className="gap-2 font-semibold shadow-md bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 transition-transform hover:scale-105 active:scale-95"
        >
          <Play className="w-4 h-4 fill-current" />
          {connectLabel}
        </Button>
      </div>
    );
  }

  const isConnected = status === "connected";
  const isConnecting = status === "requesting_token" || status === "connecting";

  return (
    <div
      data-testid="live-session-controls"
      className={cn(
        "flex items-center justify-center gap-3 p-3 bg-background/80 backdrop-blur-xs border rounded-2xl shadow-xs",
        className
      )}
    >
      {/* Microphone Mute Toggle */}
      <div className="relative">
        <Button
          type="button"
          size="icon"
          variant={isMuted ? "destructive" : "secondary"}
          data-testid="mute-live-btn"
          disabled={isConnecting}
          onClick={onToggleMute}
          className="w-11 h-11 rounded-full shadow-xs transition-all relative z-10"
        >
          {isMuted ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5 text-foreground" />
          )}
          <span className="sr-only">
            {isMuted ? "Bật Microphone" : "Tắt tiếng Microphone"}
          </span>
        </Button>

        {/* Dynamic Voice Volume Ring */}
        {!isMuted && isConnected && inputVolume > 0.05 && (
          <span
            className="absolute inset-0 rounded-full bg-emerald-500/25 animate-ping -z-0 pointer-events-none"
            style={{
              transform: `scale(${1 + inputVolume * 0.5})`,
            }}
          />
        )}
      </div>

      {/* Noise Suppression Toggle */}
      {onToggleNoiseSuppression && (
        <Button
          type="button"
          size="icon"
          variant={isNoiseSuppressionActive ? "default" : "outline"}
          data-testid="noise-suppression-toggle-btn"
          disabled={isConnecting}
          onClick={onToggleNoiseSuppression}
          title={
            isNoiseSuppressionActive
              ? "Bộ lọc khử ồn AI (WASM) đang BẬT"
              : "Bộ lọc khử ồn AI (WASM) đang TẮT"
          }
          className={cn(
            "w-11 h-11 rounded-full shadow-xs transition-colors",
            isNoiseSuppressionActive
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground"
          )}
        >
          <Sparkles className="w-4 h-4" />
          <span className="sr-only">Bật/tắt khử ồn WASM</span>
        </Button>
      )}

      {/* End Call / Disconnect Button */}
      <Button
        type="button"
        variant="destructive"
        data-testid="disconnect-live-btn"
        onClick={onDisconnect}
        disabled={status === "disconnecting"}
        className="gap-2 rounded-full px-5 text-xs font-medium shadow-xs"
      >
        {status === "disconnecting" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <PhoneOff className="w-4 h-4" />
        )}
        Kết thúc buổi thi
      </Button>
    </div>
  );
}
