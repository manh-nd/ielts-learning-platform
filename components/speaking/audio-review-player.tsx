"use client";

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useId,
  useImperativeHandle,
} from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AudioReviewMarker {
  id: string;
  timeSeconds: number;
  label?: string;
}

export interface AudioReviewPlayerRef {
  seekTo: (timeSeconds: number) => void;
  play: () => Promise<void>;
  pause: () => void;
}

export interface AudioReviewPlayerProps {
  /**
   * Browser-ready playable audio source (same-origin API URL or Blob URL).
   * When null/undefined, renders an idle standby state.
   */
  src: string | null;

  /**
   * Accessible description of the audio track for screen readers.
   */
  ariaLabel: string;

  /**
   * Presentation markers indicating notable timestamps on the waveform.
   */
  markers?: readonly AudioReviewMarker[];

  /**
   * Callback notifying parent when a marker is activated.
   * (The player automatically seeks to marker.timeSeconds internally).
   */
  onMarkerActivate?: (markerId: string) => void;

  /**
   * Optional callback notifying parent on audio time progression (in seconds).
   */
  onTimeUpdate?: (timeSeconds: number) => void;

  /**
   * Optional custom CSS class for container layout.
   */
  className?: string;

  /**
   * Optional muted flag (useful for testing and silent playback).
   */
  muted?: boolean;

  /**
   * Optional imperative control handle.
   */
  ref?: React.Ref<AudioReviewPlayerRef>;
}

const PLAYBACK_SPEEDS = [0.8, 1.0, 1.2, 1.5] as const;
type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function AudioReviewPlayer({
  src,
  ariaLabel,
  markers,
  onMarkerActivate,
  onTimeUpdate,
  className,
  muted = false,
  ref,
}: AudioReviewPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const [prevSrc, setPrevSrc] = useState(src);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(src));
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0);

  if (prevSrc !== src) {
    setPrevSrc(src);
    setIsLoading(Boolean(src));
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }

  const playbackSpeedRef = useRef<PlaybackSpeed>(playbackSpeed);
  const isReadyRef = useRef<boolean>(isReady);
  const onTimeUpdateRef = useRef<((time: number) => void) | undefined>(
    onTimeUpdate
  );

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    isReadyRef.current = isReady;
    onTimeUpdateRef.current = onTimeUpdate;
  }, [playbackSpeed, isReady, onTimeUpdate]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: (timeSeconds: number) => {
        if (!wavesurferRef.current) return;
        const dur = wavesurferRef.current.getDuration();
        if (dur > 0) {
          const progress = Math.max(0, Math.min(1, timeSeconds / dur));
          wavesurferRef.current.seekTo(progress);
        }
      },
      play: async () => {
        if (wavesurferRef.current && isReadyRef.current) {
          await wavesurferRef.current.play();
        }
      },
      pause: () => {
        wavesurferRef.current?.pause();
      },
    }),
    []
  );

  const playerId = useId();

  // Lifecycle: Instance Recreation per Source
  useEffect(() => {
    if (!src) {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      return;
    }

    const waveformElement = waveformRef.current;
    if (!waveformElement) return;

    // Resolve semantic theme tokens via getComputedStyle
    let waveColor = "#94a3b8";
    let progressColor = "#0d9488";
    if (typeof window !== "undefined") {
      const computed = window.getComputedStyle(waveformElement);
      const m = computed.getPropertyValue("--muted-foreground")?.trim();
      const p = computed.getPropertyValue("--primary")?.trim();
      if (m) waveColor = m;
      if (p) progressColor = p;
    }

    const ws = WaveSurfer.create({
      container: waveformElement,
      url: src,
      height: 64,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      waveColor,
      progressColor,
      cursorColor: progressColor,
      cursorWidth: 2,
      normalize: true,
    });

    const mediaElement = ws.getMediaElement();
    if (mediaElement && muted) {
      mediaElement.setAttribute("muted", "");
      mediaElement.defaultMuted = true;
      mediaElement.muted = true;
    }

    wavesurferRef.current = ws;

    ws.on("ready", () => {
      setIsReady(true);
      setIsLoading(false);
      setDuration(ws.getDuration());
      // Speech pitch preservation
      ws.setPlaybackRate(playbackSpeedRef.current, true);
      if (muted) {
        ws.setMuted(true);
      }
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("timeupdate", (time) => {
      setCurrentTime(time);
      onTimeUpdateRef.current?.(time);
    });
    ws.on("finish", () => {
      setIsPlaying(false);
      setCurrentTime(ws.getDuration());
      onTimeUpdateRef.current?.(ws.getDuration());
    });
    ws.on("error", (err) => {
      setIsLoading(false);
      setIsReady(false);
      const message =
        typeof err === "string"
          ? err
          : (err as Error)?.message || "Không thể tải tệp âm thanh";
      setError(message);
    });

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [src, muted]);

  const handlePlayPause = useCallback(async () => {
    if (!wavesurferRef.current || !isReadyRef.current) return;
    try {
      await wavesurferRef.current.playPause();
    } catch {
      // Safely catch autoplay errors in test environments without document gesture
    }
  }, []);

  const handleReset = useCallback(() => {
    if (!wavesurferRef.current || !isReadyRef.current) return;
    wavesurferRef.current.setTime(0);
    setCurrentTime(0);
  }, []);

  const handleSpeedChange = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
    if (wavesurferRef.current && isReadyRef.current) {
      wavesurferRef.current.setPlaybackRate(speed, true);
    }
  }, []);

  const handleMarkerClick = useCallback(
    (marker: AudioReviewMarker) => {
      if (!wavesurferRef.current || !isReadyRef.current) return;
      wavesurferRef.current.setTime(marker.timeSeconds);
      setCurrentTime(marker.timeSeconds);
      onMarkerActivate?.(marker.id);
    },
    [onMarkerActivate]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === "BUTTON" || target.tagName === "INPUT";

      if (isInteractive && e.code === "Space") {
        return; // Allow button's native keyboard trigger
      }

      if (!isReadyRef.current || !wavesurferRef.current) return;

      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        const newTime = Math.max(0, currentTime - 5);
        wavesurferRef.current.setTime(newTime);
        setCurrentTime(newTime);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        const newTime = Math.min(duration, currentTime + 5);
        wavesurferRef.current.setTime(newTime);
        setCurrentTime(newTime);
      }
    },
    [currentTime, duration, handlePlayPause]
  );

  if (!src) {
    return (
      <div
        role="region"
        aria-label={ariaLabel}
        data-testid="audio-review-player"
        className={cn(
          "flex items-center justify-center h-20 rounded-lg border border-dashed border-border/70 bg-muted/20 text-xs text-muted-foreground",
          className
        )}
      >
        <span data-testid="audio-player-standby">Chưa có bản ghi âm</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="audio-review-player"
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-3 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40 transition-colors",
        className
      )}
    >
      {/* Error state */}
      {error && (
        <div
          role="alert"
          data-testid="audio-player-error"
          className="flex items-center gap-2 rounded-md bg-rose-50 p-2.5 text-xs text-rose-950 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800"
        >
          <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Waveform container with markers & loading overlay */}
      <div
        className={cn(
          "relative w-full rounded-lg bg-muted/30 px-2 py-1 overflow-hidden",
          error && "opacity-40 pointer-events-none"
        )}
      >
        {/* Loading overlay */}
        {isLoading && (
          <div
            data-testid="audio-player-loading"
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-[1px]"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Đang tải âm thanh...</span>
            </div>
          </div>
        )}

        {/* WaveSurfer canvas mount point */}
        <div
          ref={waveformRef}
          data-testid="audio-waveform-canvas-container"
          className="w-full h-16 cursor-pointer"
        />

        {/* Interactive marker pins overlay */}
        {markers && markers.length > 0 && duration > 0 && (
          <div
            className="pointer-events-none absolute inset-x-2 top-0 h-full z-10"
            data-testid="audio-player-markers-layer"
          >
            {markers.map((marker) => {
              const leftPercent = Math.min(
                100,
                Math.max(0, (marker.timeSeconds / duration) * 100)
              );
              return (
                <button
                  key={marker.id}
                  type="button"
                  data-testid={`audio-marker-${marker.id}`}
                  onClick={() => handleMarkerClick(marker)}
                  title={
                    marker.label
                      ? `${marker.label} (${formatTime(marker.timeSeconds)})`
                      : formatTime(marker.timeSeconds)
                  }
                  aria-label={
                    marker.label
                      ? `${marker.label} tại ${formatTime(marker.timeSeconds)}`
                      : `Dấu mốc tại ${formatTime(marker.timeSeconds)}`
                  }
                  className="pointer-events-auto absolute top-1 -translate-x-1/2 p-0.5 text-primary hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full transition-transform hover:scale-125 cursor-pointer"
                  style={{ left: `${leftPercent}%` }}
                >
                  <div className="size-2.5 rounded-full bg-primary ring-2 ring-background shadow-xs" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        {/* Left: Play/Pause, Reset, Time */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!isReady}
            onClick={handlePlayPause}
            aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            data-testid="audio-player-play-pause"
          >
            {isPlaying ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!isReady}
            onClick={handleReset}
            aria-label="Phát lại từ đầu"
            data-testid="audio-player-reset"
          >
            <RotateCcw className="size-3.5" />
          </Button>

          <div
            id={`${playerId}-time`}
            data-testid="audio-player-time"
            aria-live="off"
            className="ml-1 text-xs font-mono text-muted-foreground select-none"
          >
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Playback Speed selector */}
        <div
          role="group"
          aria-label="Tốc độ phát"
          data-testid="audio-player-speed-group"
          className="flex items-center gap-0.5 rounded-md bg-muted/40 p-0.5"
        >
          {PLAYBACK_SPEEDS.map((speed) => {
            const isActive = playbackSpeed === speed;
            return (
              <Button
                key={speed}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                size="xs"
                disabled={!isReady}
                onClick={() => handleSpeedChange(speed)}
                aria-pressed={isActive}
                aria-label={`Tốc độ ${speed}x`}
                data-testid={`audio-player-speed-${speed}`}
                className={cn(
                  "h-5 px-1.5 text-[11px] font-mono",
                  isActive &&
                    "bg-background font-semibold text-foreground shadow-xs"
                )}
              >
                {speed}x
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
