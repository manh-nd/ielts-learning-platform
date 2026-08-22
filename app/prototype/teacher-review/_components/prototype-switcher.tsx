"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

const VARIANTS = ["D", "E", "A", "B", "C"] as const;

const VARIANT_NAMES: Record<string, string> = {
  A: "Split-Pane Command Center",
  B: "Guided Review Flow",
  C: "Criterion Cards Grid",
  D: "Notion-style Document Review",
  E: "Google Docs Margin Comments",
};

export function PrototypeSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("variant") ?? "A";
  const currentIndex = VARIANTS.indexOf(current as (typeof VARIANTS)[number]);

  const goTo = useCallback(
    (variant: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", variant);
      router.replace(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const prev = useCallback(() => {
    const idx = (currentIndex - 1 + VARIANTS.length) % VARIANTS.length;
    goTo(VARIANTS[idx]);
  }, [currentIndex, goTo]);

  const next = useCallback(() => {
    const idx = (currentIndex + 1) % VARIANTS.length;
    goTo(VARIANTS[idx]);
  }, [currentIndex, goTo]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prev, next]);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-popover/95 px-2 py-1 shadow-lg backdrop-blur-sm">
      <button
        onClick={prev}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Previous variant"
      >
        ←
      </button>
      <div className="flex items-center gap-2 px-3">
        {VARIANTS.map((v) => (
          <button
            key={v}
            onClick={() => goTo(v)}
            className={`flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-medium transition-colors ${
              v === current
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <span className="border-l border-border pl-3 pr-2 text-xs text-muted-foreground">
        {VARIANT_NAMES[current] ?? current}
      </span>
      <button
        onClick={next}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Next variant"
      >
        →
      </button>
    </div>
  );
}
