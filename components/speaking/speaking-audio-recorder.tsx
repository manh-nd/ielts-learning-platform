"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  HelpCircle,
  AudioLines,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAudioRecorder } from "./use-audio-recorder";
import { AudioWaveformVisualizer } from "./audio-waveform-visualizer";

export interface SpeakingAudioRecorderProps {
  /**
   * Title or question prompt to display (e.g. "IELTS Speaking Part 2 - Describe a memorable journey")
   */
  title?: string;
  /**
   * Subtitle or instruction hint
   */
  description?: string;
  /**
   * Maximum allowed duration in seconds (e.g., 60s for Part 1/3, 120s for Part 2)
   */
  maxDurationSeconds?: number;
  /**
   * Enable real-time WASM/DSP noise suppression filter
   */
  enableNoiseSuppression?: boolean;
  /**
   * Callback fired when recording finishes and blob is produced
   */
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  /**
   * Callback fired when user confirms / submits the recorded audio
   */
  onAudioSubmit?: (blob: Blob, duration: number) => void;
  /**
   * Custom CSS classes for the container card
   */
  className?: string;
  /**
   * Initial audio URL for standalone playback preview testing
   */
  initialAudioUrl?: string;
  /**
   * Initial duration in seconds for initial playback preview
   */
  initialDurationSeconds?: number;
}

/**
 * Format seconds into mm:ss display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function SpeakingAudioRecorder({
  title = "IELTS Speaking Audio Response",
  description = "Ghi âm câu trả lời của bạn. Bạn có thể nghe lại trước khi nộp bài.",
  maxDurationSeconds,
  enableNoiseSuppression = true,
  onRecordingComplete,
  onAudioSubmit,
  className,
  initialAudioUrl,
  initialDurationSeconds = 0,
}: SpeakingAudioRecorderProps) {
  const {
    status: recorderStatus,
    duration: recordedDuration,
    audioBlob,
    audioUrl: recordedUrl,
    analyserNode,
    error: recorderError,
    isNoiseSuppressionActive,
    toggleNoiseSuppression,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useAudioRecorder({
    maxDurationSeconds,
    enableNoiseSuppression,
    onRecordingComplete,
  });

  // Effective audio URL & duration (supports mock initial playback)
  const effectiveAudioUrl = recordedUrl || initialAudioUrl || null;
  const effectiveDuration = recordedDuration || initialDurationSeconds;

  // Playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState<number>(0);
  const [isReRecordDialogOpen, setIsReRecordDialogOpen] =
    useState<boolean>(false);

  // Sync effective status when initialAudioUrl is passed
  const isPlaybackMode =
    recorderStatus === "playback" ||
    (recorderStatus === "idle" && !!initialAudioUrl);

  // Synchronize HTML5 audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setPlaybackCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackCurrentTime(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, [effectiveAudioUrl]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        // Playback error catch
      });
    }
  }, [isPlaying]);

  const handleSeek = useCallback((targetTime: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = targetTime;
      setPlaybackCurrentTime(targetTime);
    }
  }, []);

  const handleConfirmReRecord = () => {
    setIsReRecordDialogOpen(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlaybackCurrentTime(0);
    resetRecording();
    startRecording();
  };

  const handleSubmit = () => {
    if (onAudioSubmit && audioBlob) {
      onAudioSubmit(audioBlob, effectiveDuration);
    }
  };

  // Calculate progress percentage for countdown
  const timeProgressPercent = maxDurationSeconds
    ? Math.min(100, (recordedDuration / maxDurationSeconds) * 100)
    : 0;

  return (
    <Card
      data-testid="speaking-audio-recorder"
      className={cn(
        "w-full max-w-2xl mx-auto shadow-sm border overflow-hidden py-0 gap-0 transition-all",
        recorderStatus === "recording" && "ring-2 ring-destructive/30",
        className
      )}
    >
      {/* Hidden audio element for playback */}
      {effectiveAudioUrl && (
        <audio
          ref={audioRef}
          src={effectiveAudioUrl}
          preload="metadata"
          className="hidden"
        />
      )}

      {/* Header Bar */}
      <CardHeader className="px-6 py-4 border-b bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              {title}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {description}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Noise Suppression Toggle Badge */}
            <button
              type="button"
              onClick={() => toggleNoiseSuppression()}
              data-testid="noise-suppression-toggle-badge"
              title={
                isNoiseSuppressionActive
                  ? "Bộ lọc khử tiếng ồn đang BẬT - Nhấn để TẮT"
                  : "Bộ lọc khử tiếng ồn đang TẮT - Nhấn để BẬT"
              }
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer select-none",
                isNoiseSuppressionActive
                  ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              )}
            >
              <AudioLines className="w-3 h-3" />
              <span>Lọc ồn: {isNoiseSuppressionActive ? "BẬT" : "TẮT"}</span>
            </button>

            {/* Status Badges */}
            {recorderStatus === "idle" && !initialAudioUrl && (
              <Badge variant="outline" data-testid="status-badge">
                Sẵn sàng
              </Badge>
            )}

            {recorderStatus === "requesting_permission" && (
              <Badge
                variant="outline"
                data-testid="status-badge"
                className="animate-pulse"
              >
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Cấp quyền mic...
              </Badge>
            )}

            {recorderStatus === "recording" && (
              <Badge
                variant="destructive"
                data-testid="status-badge"
                className="gap-1.5 animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-destructive-foreground animate-ping" />
                Đang ghi âm
              </Badge>
            )}

            {recorderStatus === "paused" && (
              <Badge variant="secondary" data-testid="status-badge">
                Tạm dừng
              </Badge>
            )}

            {recorderStatus === "processing" && (
              <Badge
                variant="secondary"
                data-testid="status-badge"
                className="gap-1.5"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                Đang xử lý
              </Badge>
            )}

            {isPlaybackMode && (
              <Badge
                variant="secondary"
                data-testid="status-badge"
                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Đã có bản thu
              </Badge>
            )}

            {recorderStatus === "error" && (
              <Badge variant="destructive" data-testid="status-badge">
                <AlertCircle className="w-3 h-3 mr-1" />
                Lỗi Micro
              </Badge>
            )}
          </div>
        </div>

        {/* Max duration progress bar for timed tasks */}
        {maxDurationSeconds && recorderStatus === "recording" && (
          <div className="mt-3 space-y-1">
            <Progress value={timeProgressPercent} className="h-1.5" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Tiến độ ghi âm</span>
              <span className="font-mono">
                {formatDuration(recordedDuration)} /{" "}
                {formatDuration(maxDurationSeconds)}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {/* ================= 1. IDLE STATE ================= */}
        {recorderStatus === "idle" && !initialAudioUrl && (
          <div
            data-testid="idle-panel"
            className="flex flex-col items-center justify-center py-2 text-center space-y-4"
          >
            <div className="relative">
              <Button
                type="button"
                size="icon"
                variant="default"
                data-testid="start-record-btn"
                onClick={startRecording}
                className="w-16 h-16 rounded-full shadow-md bg-primary hover:bg-primary/90 text-primary-foreground transition-transform hover:scale-105 active:scale-95"
              >
                <Mic className="w-8 h-8" />
                <span className="sr-only">Bắt đầu ghi âm</span>
              </Button>
            </div>

            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-medium text-foreground">
                Nhấn vào nút Micro để bắt đầu nói
              </p>
              <p className="text-xs text-muted-foreground">
                {maxDurationSeconds
                  ? `Thời gian tối đa: ${formatDuration(maxDurationSeconds)}. Micro sẽ tự động dừng khi hết giờ.`
                  : "Nói to, rõ ràng và nhấn nút Dừng khi hoàn thành câu trả lời."}
              </p>
            </div>
          </div>
        )}

        {/* ================= 2. REQUESTING PERMISSION STATE ================= */}
        {recorderStatus === "requesting_permission" && (
          <div
            data-testid="permission-panel"
            className="flex flex-col items-center justify-center py-8 text-center space-y-3"
          >
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">
              Đang yêu cầu quyền truy cập Microphone...
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Vui lòng nhấn &quot;Cho phép&quot; (Allow) trên thông báo của
              trình duyệt.
            </p>
          </div>
        )}

        {/* ================= 3. RECORDING & PAUSED STATE ================= */}
        {(recorderStatus === "recording" || recorderStatus === "paused") && (
          <div data-testid="recording-panel" className="space-y-5">
            {/* Live Waveform Container */}
            <div className="bg-muted/30 p-3 rounded-xl border">
              <AudioWaveformVisualizer
                isLive={true}
                isPaused={recorderStatus === "paused"}
                analyserNode={analyserNode}
                height={72}
              />
            </div>

            {/* Timer and Controls */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span
                  data-testid="recording-timer"
                  className="font-mono text-xl font-bold tracking-tight text-foreground"
                >
                  {formatDuration(recordedDuration)}
                </span>
                {maxDurationSeconds && (
                  <span className="text-xs text-muted-foreground font-mono">
                    / {formatDuration(maxDurationSeconds)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {recorderStatus === "recording" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="pause-record-btn"
                    onClick={pauseRecording}
                    className="gap-1.5 text-xs"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Tạm dừng
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="resume-record-btn"
                    onClick={resumeRecording}
                    className="gap-1.5 text-xs"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Tiếp tục
                  </Button>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  data-testid="stop-record-btn"
                  onClick={stopRecording}
                  className="gap-1.5 text-xs"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Hoàn tất
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. PROCESSING STATE ================= */}
        {recorderStatus === "processing" && (
          <div
            data-testid="processing-panel"
            className="flex flex-col items-center justify-center py-8 text-center space-y-3"
          >
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-foreground">
              Đang hoàn thiện tệp âm thanh...
            </p>
          </div>
        )}

        {/* ================= 5. PLAYBACK & REVIEW STATE ================= */}
        {isPlaybackMode && (
          <div data-testid="playback-panel" className="space-y-5">
            {/* Interactive Playback Waveform */}
            <div className="bg-muted/30 p-3 rounded-xl border">
              <AudioWaveformVisualizer
                isLive={false}
                audioDuration={effectiveDuration}
                currentTime={playbackCurrentTime}
                onSeek={handleSeek}
                height={72}
              />
            </div>

            {/* Playback Controls & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  data-testid="play-audio-btn"
                  onClick={togglePlayback}
                  className="w-10 h-10 rounded-full shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                  )}
                  <span className="sr-only">
                    {isPlaying ? "Tạm dừng phát lại" : "Phát lại"}
                  </span>
                </Button>

                <div className="text-xs font-mono text-muted-foreground">
                  <span
                    data-testid="playback-current-time"
                    className="font-semibold text-foreground"
                  >
                    {formatDuration(playbackCurrentTime)}
                  </span>{" "}
                  /{" "}
                  <span data-testid="playback-total-duration">
                    {formatDuration(effectiveDuration)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="rerecord-btn"
                  onClick={() => setIsReRecordDialogOpen(true)}
                  className="gap-1 text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Ghi âm lại
                </Button>

                {onAudioSubmit && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    data-testid="submit-audio-btn"
                    onClick={handleSubmit}
                    className="gap-1.5 text-xs bg-primary text-primary-foreground"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Xác nhận & Nộp
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. ERROR STATE ================= */}
        {recorderStatus === "error" && recorderError && (
          <div
            data-testid="error-panel"
            className="p-4 sm:p-6 rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 text-card-foreground space-y-4"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-rose-950 dark:text-rose-200">
                  {recorderError.type === "permission_denied" &&
                    "Quyền truy cập Microphone bị từ chối"}
                  {recorderError.type === "device_not_found" &&
                    "Không tìm thấy Microphone"}
                  {recorderError.type === "unsupported" &&
                    "Trình duyệt không hỗ trợ"}
                  {recorderError.type === "unknown" && "Lỗi kết nối Microphone"}
                </h4>
                <p className="text-xs text-rose-900 dark:text-rose-300 leading-relaxed">
                  {recorderError.message}
                </p>
              </div>
            </div>

            {/* In-place Troubleshooting Guide */}
            {recorderError.type === "permission_denied" && (
              <div className="p-3 rounded-lg bg-background/80 border text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" />
                  <span>Cách mở quyền micro trên trình duyệt:</span>
                </div>
                <ol className="list-decimal list-inside space-y-0.5 pl-1">
                  <li>
                    Nhấp vào biểu tượng Cài đặt trang web (Site settings) ở góc
                    trái thanh địa chỉ URL.
                  </li>
                  <li>
                    Chuyển mục <strong>Microphone</strong> sang{" "}
                    <strong>Cho phép (Allow)</strong>.
                  </li>
                  <li>
                    Nhấn nút <strong>Thử lại</strong> bên dưới.
                  </li>
                </ol>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="retry-permission-btn"
                onClick={startRecording}
                className="gap-1 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Thử lại
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog for Re-recording */}
      <Dialog
        open={isReRecordDialogOpen}
        onOpenChange={setIsReRecordDialogOpen}
      >
        <DialogContent
          data-testid="rerecord-confirm-dialog"
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Xác nhận ghi âm lại?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Ghi âm lại sẽ xóa hoàn toàn bản thu âm hiện tại của bạn. Bạn sẽ
              phải thực hiện lại câu trả lời từ đầu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsReRecordDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              data-testid="confirm-rerecord-btn"
              onClick={handleConfirmReRecord}
            >
              Ghi âm lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
