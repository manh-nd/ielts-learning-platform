"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface LiveAudioVisualizerProps {
  /**
   * AnalyserNode instance connected to the active MediaStream for live recording.
   */
  analyserNode?: AnalyserNode | null;
  /**
   * Is live recording currently paused (freezes live animation into low-amplitude baseline).
   */
  isPaused?: boolean;
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
   * Height of the visualizer container in pixels.
   * @default 64
   */
  height?: number;
}

export function LiveAudioVisualizer({
  analyserNode,
  isPaused = false,
  barCount = 40,
  height = 64,
  className,
}: LiveAudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Draw a single frame for live mic mode
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

    // Resolve semantic theme tokens via getComputedStyle on container
    let mutedFgColor = "oklch(0.556 0 0)";
    if (typeof window !== "undefined" && containerRef.current) {
      const computed = window.getComputedStyle(containerRef.current);
      const m = computed.getPropertyValue("--muted-foreground")?.trim();
      if (m) mutedFgColor = m;
    }

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

        // Conventional red recording affordance (active recording indicator)
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "rgba(239, 68, 68, 1)";

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
      // Idle or paused live state: low amplitude calm baseline using muted-foreground
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

        ctx.globalAlpha = 0.35;
        ctx.fillStyle = mutedFgColor;
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
    ctx.globalAlpha = 1.0;
  }, [analyserNode, isPaused, barCount]);

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

    drawLiveFrame();
  }, [drawLiveFrame, height]);

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

    if (!isPaused) {
      const loop = () => {
        if (!active) return;
        drawLiveFrame();
        animationFrameRef.current = requestAnimationFrame(loop);
      };
      animationFrameRef.current = requestAnimationFrame(loop);
    } else {
      drawLiveFrame();
    }

    return () => {
      active = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPaused, drawLiveFrame]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden flex items-center justify-center select-none",
        className
      )}
      style={{ height }}
      role="img"
      aria-label={
        isPaused
          ? "Sóng âm microphone đang tạm dừng"
          : "Sóng âm microphone trực tiếp"
      }
      data-testid="live-audio-visualizer"
    >
      <canvas
        ref={canvasRef}
        className="block pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}
