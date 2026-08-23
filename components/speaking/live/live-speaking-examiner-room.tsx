"use client";

import { Sparkles, User, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveConnectionBadge } from "./live-connection-badge";
import { LiveTranscriptStream } from "./live-transcript-stream";
import { LiveSessionControls } from "./live-session-controls";
import { useGeminiLive } from "./use-gemini-live";
import { LiveSpeakingConfig } from "./types";

export interface LiveSpeakingExaminerRoomProps extends LiveSpeakingConfig {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function LiveSpeakingExaminerRoom({
  title = "Phòng Thi Thử IELTS Speaking Trực Tiếp",
  subtitle = "Đối thoại thời gian thực 1-on-1 với Giám khảo AI (Gemini 3.1 Flash Live)",
  candidateName = "Thí sinh",
  targetPart = "full",
  mockMode = false,
  className,
  ...config
}: LiveSpeakingExaminerRoomProps) {
  const {
    status,
    voiceActivity,
    transcripts,
    isMuted,
    inputVolume,
    connect,
    disconnect,
    toggleMute,
  } = useGeminiLive({
    candidateName,
    targetPart,
    mockMode,
    ...config,
  });

  const isConnected = status === "connected";

  return (
    <Card
      data-testid="live-speaking-examiner-room"
      className={cn(
        "w-full max-w-4xl mx-auto shadow-md border overflow-hidden transition-all",
        isConnected && "ring-1 ring-indigo-500/30",
        className
      )}
    >
      {/* Header */}
      <CardHeader className="pb-4 border-b bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {title}
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] font-mono uppercase"
              >
                {targetPart === "full"
                  ? "Full Test (Part 1-3)"
                  : targetPart.toUpperCase()}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {subtitle}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <LiveConnectionBadge
              status={status}
              voiceActivity={voiceActivity}
            />
          </div>
        </div>
      </CardHeader>

      {/* Main Content Studio */}
      <CardContent className="p-5 space-y-5">
        {/* Stage Visualization Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AI Examiner Card */}
          <div
            data-testid="examiner-stage-card"
            className={cn(
              "flex flex-col items-center justify-center p-6 rounded-2xl border text-center transition-all bg-gradient-to-b from-indigo-500/5 to-transparent",
              voiceActivity === "ai_speaking" &&
                "ring-2 ring-indigo-500 bg-indigo-500/10 shadow-sm"
            )}
          >
            <div className="relative mb-3">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center bg-indigo-600 text-white shadow-md transition-transform",
                  voiceActivity === "ai_speaking" && "scale-110"
                )}
              >
                <Sparkles className="w-8 h-8" />
              </div>
              {voiceActivity === "ai_speaking" && (
                <span className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping pointer-events-none" />
              )}
            </div>

            <h4 className="font-semibold text-sm text-foreground">
              Giám khảo IELTS (Dr. Harrison)
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {voiceActivity === "ai_speaking"
                ? "Đang đặt câu hỏi & lắng nghe phản xạ..."
                : isConnected
                  ? "Sẵn sàng hội thoại"
                  : "Chưa kết nối"}
            </p>
          </div>

          {/* Candidate Card */}
          <div
            data-testid="candidate-stage-card"
            className={cn(
              "flex flex-col items-center justify-center p-6 rounded-2xl border text-center transition-all bg-gradient-to-b from-emerald-500/5 to-transparent",
              voiceActivity === "user_speaking" &&
                "ring-2 ring-emerald-500 bg-emerald-500/10 shadow-sm"
            )}
          >
            <div className="relative mb-3">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-md transition-transform",
                  voiceActivity === "user_speaking" && "scale-110"
                )}
              >
                <User className="w-8 h-8" />
              </div>
              {voiceActivity === "user_speaking" && (
                <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping pointer-events-none" />
              )}
            </div>

            <h4 className="font-semibold text-sm text-foreground">
              {candidateName}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isMuted
                ? "Microphone đang tắt tiếng (Muted)"
                : voiceActivity === "user_speaking"
                  ? "Đang trả lời câu hỏi..."
                  : isConnected
                    ? "Microphone đang bật"
                    : "Sẵn sàng"}
            </p>
          </div>
        </div>

        {/* Real-time Subtitle & Transcript Stream */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-medium text-muted-foreground">
              Phụ đề & Gỡ băng hội thoại trực tiếp:
            </span>
            {mockMode && (
              <Badge
                variant="outline"
                className="text-[10px] text-amber-600 dark:text-amber-400"
              >
                Mock Simulation Mode
              </Badge>
            )}
          </div>
          <LiveTranscriptStream transcripts={transcripts} />
        </div>
      </CardContent>

      {/* Footer Controls */}
      <CardFooter className="flex items-center justify-between border-t bg-muted/10 p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Bảo mật qua Ephemeral Token</span>
        </div>

        <LiveSessionControls
          status={status}
          isMuted={isMuted}
          inputVolume={inputVolume}
          onConnect={connect}
          onDisconnect={disconnect}
          onToggleMute={toggleMute}
        />
      </CardFooter>
    </Card>
  );
}
