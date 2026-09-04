"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface UseActiveReviewTimerOptions {
  initialDurationMs?: number;
  idleTimeoutMs?: number; // Defaults to 60,000ms (60 seconds)
  isEnabled?: boolean;
}

export interface UseActiveReviewTimerReturn {
  activeDurationMs: number;
  isPaused: boolean;
  pauseReason: "tab_hidden" | "idle" | "disabled" | null;
  formattedDuration: string;
  resetTimer: () => void;
}

/**
 * Formats duration milliseconds into MM:SS string
 */
export function formatReviewDuration(durationMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

/**
 * ActiveReviewTimer Hook (Issue #76, Ticket #52, ADR-0009)
 * Accurately tracks teacher engagement time by automatically pausing when:
 * 1. Tab is hidden (document.visibilityState === 'hidden')
 * 2. Inactivity/idle > 60 seconds without user interaction
 */
export function useActiveReviewTimer({
  initialDurationMs = 0,
  idleTimeoutMs = 60000,
  isEnabled = true,
}: UseActiveReviewTimerOptions = {}): UseActiveReviewTimerReturn {
  const [activeDurationMs, setActiveDurationMs] =
    useState<number>(initialDurationMs);
  const [isTabHidden, setIsTabHidden] = useState<boolean>(false);
  const [isIdle, setIsIdle] = useState<boolean>(false);

  const lastActiveTimestampRef = useRef<number>(0);
  const lastTickTimestampRef = useRef<number>(0);

  useEffect(() => {
    lastActiveTimestampRef.current = Date.now();
    lastTickTimestampRef.current = Date.now();
  }, []);

  const resetTimer = useCallback(() => {
    setActiveDurationMs(0);
    lastActiveTimestampRef.current = Date.now();
    lastTickTimestampRef.current = Date.now();
  }, []);

  // Determine current pause state and reason
  const isPaused = !isEnabled || isTabHidden || isIdle;
  const pauseReason: UseActiveReviewTimerReturn["pauseReason"] = !isEnabled
    ? "disabled"
    : isTabHidden
      ? "tab_hidden"
      : isIdle
        ? "idle"
        : null;

  // Listen to visibility change (tab hidden/visible)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      const hidden = document.visibilityState === "hidden";
      setIsTabHidden(hidden);
      if (!hidden) {
        // Reset tick on resume to avoid counting background time
        lastTickTimestampRef.current = Date.now();
        lastActiveTimestampRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Listen to user interaction to detect idle inactivity (> 60s)
  useEffect(() => {
    if (typeof window === "undefined" || !isEnabled) return;

    const handleUserActivity = () => {
      lastActiveTimestampRef.current = Date.now();
      if (isIdle) {
        setIsIdle(false);
        lastTickTimestampRef.current = Date.now();
      }
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    for (const evt of events) {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    }

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, handleUserActivity);
      }
    };
  }, [isEnabled, isIdle]);

  // Main timer ticker interval
  useEffect(() => {
    if (!isEnabled) return;

    lastTickTimestampRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();

      // Check for idle timeout
      if (now - lastActiveTimestampRef.current > idleTimeoutMs) {
        if (!isIdle) {
          setIsIdle(true);
        }
      }

      // If active and not paused, accumulate elapsed time
      if (!isTabHidden && !isIdle) {
        const delta = now - lastTickTimestampRef.current;
        if (delta > 0 && delta < 5000) {
          // Guard against sleep/hibernation jumps
          setActiveDurationMs((prev) => prev + delta);
        }
      }

      lastTickTimestampRef.current = now;
    }, 1000);

    return () => clearInterval(interval);
  }, [isEnabled, isTabHidden, isIdle, idleTimeoutMs]);

  return {
    activeDurationMs,
    isPaused,
    pauseReason,
    formattedDuration: formatReviewDuration(activeDurationMs),
    resetTimer,
  };
}
