"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WritingDraft, SaveStatus } from "./types";

interface UseWritingDraftOptions {
  storageKey: string;
  debounceMs?: number;
  initialDraft?: WritingDraft;
}

export function useWritingDraft({
  storageKey,
  debounceMs = 1000,
  initialDraft,
}: UseWritingDraftOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const [restoredDraft, setRestoredDraft] = useState<WritingDraft | null>(
    () => {
      if (initialDraft) return initialDraft;
      if (typeof window === "undefined") return null;
      try {
        const cached = localStorage.getItem(storageKey);
        return cached ? JSON.parse(cached) : null;
      } catch (err) {
        console.warn("Failed to restore draft from localStorage:", err);
        return null;
      }
    }
  );

  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    if (initialDraft) return new Date(initialDraft.lastSavedAt);
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.lastSavedAt ? new Date(parsed.lastSavedAt) : null;
      }
    } catch {
      // Ignore parse errors on init
    }
    return null;
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveDraft = useCallback(
    (draft: Omit<WritingDraft, "lastSavedAt">) => {
      setSaveStatus("saving");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        try {
          const now = new Date();
          const payload: WritingDraft = {
            ...draft,
            lastSavedAt: now.toISOString(),
          };
          if (typeof window !== "undefined") {
            localStorage.setItem(storageKey, JSON.stringify(payload));
          }
          setLastSaved(now);
          setSaveStatus("saved");
        } catch (err) {
          console.error("Auto-save failed:", err);
          setSaveStatus("error");
        }
      }, debounceMs);
    },
    [storageKey, debounceMs]
  );

  const clearDraft = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(storageKey);
      }
      setRestoredDraft(null);
      setLastSaved(null);
      setSaveStatus("idle");
    } catch (err) {
      console.error("Failed to clear draft:", err);
    }
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    saveStatus,
    lastSaved,
    restoredDraft,
    saveDraft,
    clearDraft,
  };
}
