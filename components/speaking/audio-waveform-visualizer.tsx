"use client";

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface AudioWaveformVisualizerProps {
  /**
   * AnalyserNode instance connected to the active MediaStream for live recording.
   */
  analyserNode?: AnalyserNode | null;
  /**
   * Mode toggle: true for real-time live microphone stream, false for playback waveform.
   */
  isLive?: boolean;
  /**
   * Is live recording currently paused (freezes live animation).
   */
  isPaused?: boolean;
  /**
   * Total audio duration in seconds for playback seeking.
   */
  audioDuration?: number;
  /**
   * Current playback progress time in seconds.
   */
  currentTime?: number;
  /**
   * Callback fired when user clicks or drags to seek on the playback waveform.
   */
  onSeek?: (timeSeconds: number) => void;
  /**
   * Predefined static amplitude levels (0.0 to 1.0) for playback mode.
   * If omitted, a natural waveform pattern will be deterministically generated.
   */
  staticAmplitudes?: number[];
  /**
   * Target number of vertical waveform bars.
   * @default 40
   */
  barCount?: number;
  /**
   * Custom CSS class names.
   */
  className?: string;
  /**
   * Height of the visualizer container.
   * @default 64
   */
  height?: number;
}

/**
 * Deterministically generates a natural-looking voice waveform pattern for playback mode.
 */
function generateDeterministicAmplitudes(count: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    // Layered sines to mimic natural speech syllables with pauses
    const envelope = Math.sin(progress * Math.PI); // fade in at start, fade out at end
    const wave1 = Math.sin(i * 0.45) * 0.3;
    const wave2 = Math.cos(i * 0.85) * 0.25;
    const wave3 = Math.sin(i * 1.3) * 0.15;
    const base = 0.25;
    const val = (base + wave1 + wave2 + wave3) * (0.4 + 0.6 * envelope);
    result.push(Math.max(0.12, Math.min(0.95, val)));
  }
  return result;
}

export function AudioWaveformVisualizer({
  analyserNode,
  isLive = false,
  isPaused = false,
  audioDuration = 0,
  currentTime = 0,
  onSeek,
  staticAmplitudes,
  barCount = 40,
  height = 64,
  className,
}: AudioWaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Cached amplitudes for playback mode
  const amplitudes = useMemo(() => {
    if (staticAmplitudes && staticAmplitudes.length > 0) {
      return staticAmplitudes;
    }
    return generateDeterministicAmplitudes(barCount);
  }, [staticAmplitudes, barCount]);

  /**
   * Draw a single frame for live mode
   */
  const drawLiveFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (analyserNode && !isPaused) {
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);

      const totalBars = barCount;
      const barSpacing = Math.max(2, width / (totalBars * 2.8));
      const barWidth = Math.max(
        2,
        (width - (totalBars - 1) * barSpacing) / totalBars
      );

      const step = Math.floor(bufferLength / totalBars) || 1;

      for (let i = 0; i < totalBars; i++) {
        const binIndex = Math.min(i * step, bufferLength - 1);
        const value = dataArray[binIndex] || 0;
        const percent = Math.max(0.1, value / 255);
        const barHeight = Math.max(4, percent * (canvasHeight - 8));

        const x = i * (barWidth + barSpacing) + barSpacing / 2;
        const y = (canvasHeight - barHeight) / 2;

        ctx.fillStyle = "rgba(239, 68, 68, 0.85)"; // Destructive red for active recording pulse

        drawRoundedRect(
          ctx,
          x * dpr,
          y * dpr,
          barWidth * dpr,
          barHeight * dpr,
          (barWidth / 2) * dpr
        );
      }
    } else {
      // Idle or paused live state: low amplitude calm baseline
      const totalBars = barCount;
      const barSpacing = Math.max(2, width / (totalBars * 2.8));
      const barWidth = Math.max(
        2,
        (width - (totalBars - 1) * barSpacing) / totalBars
      );

      for (let i = 0; i < totalBars; i++) {
        const barHeight = 6;
        const x = i * (barWidth + barSpacing) + barSpacing / 2;
        const y = (canvasHeight - barHeight) / 2;

        ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
        drawRoundedRect(
          ctx,
          x * dpr,
          y * dpr,
          barWidth * dpr,
          barHeight * dpr,
          (barWidth / 2) * dpr
        );
      }
    }
  }, [analyserNode, isPaused, barCount]);

  /**
   * Draw a single frame for playback mode
   */
  const drawPlaybackFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const totalBars = amplitudes.length;
    const barSpacing = Math.max(2, width / (totalBars * 2.8));
    const barWidth = Math.max(
      2,
      (width - (totalBars - 1) * barSpacing) / totalBars
    );

    const progressRatio =
      audioDuration > 0
        ? Math.min(1, Math.max(0, currentTime / audioDuration))
        : 0;
    const playedIndex = Math.floor(progressRatio * totalBars);

    for (let i = 0; i < totalBars; i++) {
      const amp = amplitudes[i];
      const barHeight = Math.max(6, amp * (canvasHeight - 12));
      const x = i * (barWidth + barSpacing) + barSpacing / 2;
      const y = (canvasHeight - barHeight) / 2;

      const isPlayed = i <= playedIndex;

      ctx.fillStyle = isPlayed
        ? "rgba(59, 130, 246, 0.95)" // Active / Played color (Blue/Primary)
        : "rgba(148, 163, 184, 0.35)"; // Unplayed color (Muted slate)

      drawRoundedRect(
        ctx,
        x * dpr,
        y * dpr,
        barWidth * dpr,
        barHeight * dpr,
        (barWidth / 2) * dpr
      );
    }
  }, [amplitudes, audioDuration, currentTime]);

  /**
   * Adjust canvas internal size to match physical display dimensions & DPR
   */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width || 320;
    const containerHeight = height;

    canvas.width = width * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${containerHeight}px`;

    if (isLive) {
      drawLiveFrame();
    } else {
      drawPlaybackFrame();
    }
  }, [drawLiveFrame, drawPlaybackFrame, height, isLive]);

  // Handle resizing via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    resizeCanvas();

    const observer = new ResizeObserver(() => {
      resizeCanvas();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [resizeCanvas]);

  // Main animation lifecycle loop
  useEffect(() => {
    let active = true;

    if (isLive && !isPaused) {
      const loop = () => {
        if (!active) return;
        drawLiveFrame();
        animationFrameRef.current = requestAnimationFrame(loop);
      };
      loop();
    } else if (isLive && isPaused) {
      drawLiveFrame();
    } else {
      drawPlaybackFrame();
    }

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isLive, isPaused, drawLiveFrame, drawPlaybackFrame]);

  // Handle Seeking Interaction (Click or Drag)
  const handleSeekFromEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      if (!onSeek || !containerRef.current || audioDuration <= 0) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetTime = ratio * audioDuration;
      onSeek(targetTime);
    },
    [audioDuration, onSeek]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLive || !onSeek) return;
    isDraggingRef.current = true;
    handleSeekFromEvent(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isDraggingRef.current) {
        handleSeekFromEvent(moveEvent);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={containerRef}
      data-testid="audio-waveform-container"
      role={!isLive && onSeek ? "slider" : "region"}
      aria-label={isLive ? "Live Audio Waveform" : "Audio Playback Waveform"}
      aria-valuemin={!isLive ? 0 : undefined}
      aria-valuemax={!isLive ? audioDuration : undefined}
      aria-valuenow={!isLive ? currentTime : undefined}
      tabIndex={!isLive && onSeek ? 0 : undefined}
      onMouseDown={handleMouseDown}
      style={{ height }}
      className={cn(
        "relative w-full rounded-lg flex items-center justify-center select-none overflow-hidden transition-colors",
        !isLive && onSeek
          ? "cursor-pointer hover:bg-muted/40"
          : "cursor-default",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        data-testid="audio-waveform-canvas"
        className="w-full h-full block"
      />
    </div>
  );
}

/**
 * Helper to draw a rounded rectangle on Canvas 2D context
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
