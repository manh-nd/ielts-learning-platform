"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AudioWaveformVisualizer } from "@/components/speaking/audio-waveform-visualizer";
import { extractWaveformAmplitudes } from "@/lib/audio/waveform-extractor";
import { cn } from "@/lib/utils";

export interface LiveWaveformAudioPlayerHandle {
  seekTo: (timeInSeconds: number, autoPlay?: boolean) => void;
  play: () => Promise<void>;
  pause: () => void;
}

export interface LiveWaveformAudioPlayerProps {
  audioUrl?: string;
  audioBlob?: Blob | null;
  durationSeconds: number;
  title?: string;
  subtitle?: string;
  barCount?: number;
  staticAmplitudes?: number[];
  onSeek?: (timeInSeconds: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
  playButtonTestId?: string;
}

export function formatTimeDisplay(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export const LiveWaveformAudioPlayer = forwardRef<
  LiveWaveformAudioPlayerHandle,
  LiveWaveformAudioPlayerProps
>(function LiveWaveformAudioPlayer(
  {
    audioUrl,
    audioBlob,
    durationSeconds,
    title = "Bản ghi âm giọng nói",
    subtitle = "Nghe lại âm thanh nguyên bản & kiểm tra phát âm",
    barCount = 48,
    staticAmplitudes: precomputedAmplitudes,
    onSeek,
    onTimeUpdate,
    className,
    playButtonTestId,
  },
  ref
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [amplitudes, setAmplitudes] = useState<number[]>(() => {
    return precomputedAmplitudes && precomputedAmplitudes.length > 0
      ? precomputedAmplitudes
      : [];
  });
  const [effectiveDuration, setEffectiveDuration] = useState<number>(() =>
    Math.max(1, durationSeconds || 1)
  );

  // Sync duration changes
  useEffect(() => {
    if (durationSeconds > 0) {
      setEffectiveDuration(durationSeconds);
    }
  }, [durationSeconds]);

  // Extract real waveform amplitudes from audio blob or URL
  useEffect(() => {
    if (precomputedAmplitudes && precomputedAmplitudes.length > 0) {
      setAmplitudes(precomputedAmplitudes);
      return;
    }

    const source = audioBlob || audioUrl;
    if (!source) return;

    let isCancelled = false;
    extractWaveformAmplitudes(source, barCount)
      .then((extracted) => {
        if (!isCancelled && extracted.length > 0) {
          setAmplitudes(extracted);
        }
      })
      .catch(() => {
        // Handled internally by extractWaveformAmplitudes fallback
      });

    return () => {
      isCancelled = true;
    };
  }, [audioBlob, audioUrl, barCount, precomputedAmplitudes]);

  // Handle HTMLAudioElement lifecycle & time updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      // Resolve WebM duration Infinity quirk
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setEffectiveDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl, onTimeUpdate]);

  // Perform seek
  const executeSeek = useCallback(
    (targetSeconds: number, autoPlay: boolean = false) => {
      const audio = audioRef.current;
      const bounded = Math.max(0, Math.min(targetSeconds, effectiveDuration));
      setCurrentTime(bounded);
      onSeek?.(bounded);

      if (audio) {
        audio.currentTime = bounded;
        if (autoPlay && audio.paused) {
          audio.play().catch(() => {});
        }
      }
    },
    [effectiveDuration, onSeek]
  );

  // Imperative handle for parent control (e.g., clicking transcript timestamps)
  useImperativeHandle(
    ref,
    () => ({
      seekTo: (timeInSeconds: number, autoPlay: boolean = false) => {
        executeSeek(timeInSeconds, autoPlay);
      },
      play: async () => {
        if (audioRef.current) {
          await audioRef.current.play();
        }
      },
      pause: () => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      },
    }),
    [executeSeek]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [isPlaying]);

  const handleSkip = useCallback(
    (deltaSeconds: number) => {
      executeSeek(currentTime + deltaSeconds);
    },
    [currentTime, executeSeek]
  );

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  }, []);

  return (
    <div
      data-testid="live-waveform-audio-player"
      className={cn(
        "rounded-2xl border bg-card/60 backdrop-blur-xs p-4 sm:p-5 shadow-xs space-y-4",
        className
      )}
    >
      {/* Hidden native audio tag */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          className="hidden"
        />
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-foreground flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <span>{title}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge
            variant="outline"
            className="font-mono text-xs px-2 py-0.5 bg-muted/30"
          >
            <span data-testid="player-current-time">
              {formatTimeDisplay(currentTime)}
            </span>
            <span className="mx-1 text-muted-foreground">/</span>
            <span data-testid="player-total-duration">
              {formatTimeDisplay(effectiveDuration)}
            </span>
          </Badge>
        </div>
      </div>

      {/* Interactive Waveform Display */}
      <div
        data-testid="player-waveform-box"
        className="p-3 rounded-xl border bg-muted/20 hover:bg-muted/30 transition-colors"
      >
        <AudioWaveformVisualizer
          isLive={false}
          audioDuration={effectiveDuration}
          currentTime={currentTime}
          onSeek={executeSeek}
          staticAmplitudes={amplitudes}
          barCount={barCount}
          height={68}
          className="cursor-pointer rounded-lg bg-background/90 border shadow-2xs"
        />
      </div>

      {/* Transport Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Playback Primary Controls */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={togglePlay}
            data-testid={playButtonTestId || "player-toggle-play-btn"}
            className="h-9 px-4 gap-1.5 text-xs font-semibold rounded-full shadow-xs cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Phát ghi âm</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => handleSkip(-5)}
            data-testid="player-skip-back-btn"
            title="Tua lại 5 giây"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="sr-only">Tua lại 5s</span>
          </Button>

          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => handleSkip(5)}
            data-testid="player-skip-forward-btn"
            title="Tua tới 5 giây"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="sr-only">Tua tới 5s</span>
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={toggleMute}
            data-testid="player-toggle-mute-btn"
            title={isMuted ? "Bật tiếng" : "Tắt tiếng"}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-destructive" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
            <span className="sr-only">Tắt/Bật tiếng</span>
          </Button>
        </div>

        {/* Playback Speed Controls */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border">
          <span className="text-[11px] text-muted-foreground font-medium px-1.5 hidden sm:inline">
            Tốc độ:
          </span>
          {[1.0, 1.25, 1.5].map((speed) => (
            <Button
              key={speed}
              type="button"
              variant={playbackSpeed === speed ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleSpeedChange(speed)}
              data-testid={`player-speed-${speed}x`}
              className={cn(
                "h-7 px-2 text-xs font-mono rounded-md cursor-pointer transition-all",
                playbackSpeed === speed
                  ? "bg-background font-bold text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {speed}x
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
});
