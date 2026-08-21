# Research: TipTap v3 Editor Integration for IELTS Writing & Teacher Error Markup

**Ticket:** #11  
**Status:** Approved Architectural Specification (Cập nhật chuẩn TipTap v3 & React Composable API)  
**Target Module:** IELTS Writing (Student Homework & Mock Test Workspace, Teacher Review & Error Annotation)  
**Primary Dependencies:** `@tiptap/react` (v3.x), `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-character-count`, `@tiptap/extension-placeholder`, `@tiptap/extension-highlight`, `@tiptap/core`

---

## 1. Overview & System Architecture (TipTap v3)

The IELTS Writing module leverages **TipTap v3** built on ProseMirror for both the student test-taking environment and the teacher review/calibration interface:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    STUDENT WRITING WORKSPACE (TipTap v3)                 │
│  ┌────────────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │
│  │ Real-time Word Counter │  │ Auto-Save Hook    │  │ Strict Mock Test│  │
│  │ (150w / 250w targets)  │  │ (Debounced Local) │  │ (Paste Disabled)│  │
│  └────────────────────────┘  └───────────────────┘  └─────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│                     editor.getText({ blockSeparator: '\n\n' })           │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ Plain Text Submission
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   AI EVALUATION ENGINE (Ticket #2 & #10 Schema)          │
│  • Task Achievement / Task Response (TA/TR)                              │
│  • Coherence & Cohesion (CC)                                             │
│  • Lexical Resource (LR)                                                 │
│  • Grammatical Range & Accuracy (GRA)                                    │
│  • Detected Errors Array (Verbatim original_quote + suggested_correction)│
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ JSON Output
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│             TEACHER REVIEW & ANNOTATION WORKSPACE (TipTap v3)            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Custom ProseMirror Mark: IeltsAnnotationMark                       │  │
│  │ • GRA (Red) • LR (Blue) • CC (Amber) • TA/TR & Upgrades (Emerald)   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Interactive Error Popover / HoverCard                              │  │
│  │ • Diagnostic Explanation • Suggestion • "Apply Correction" Action   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. TipTap v3 Installation & Next.js App Router (React 19) Best Practices

### 2.1 Package Dependencies

```bash
bun add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-character-count @tiptap/extension-placeholder @tiptap/extension-highlight @tiptap/core
```

> [!IMPORTANT]
> **Quy tắc đồng bộ phiên bản TipTap v3:**
> Tất cả các gói `@tiptap/*` phải sử dụng cùng một phiên bản (v3.x). Không được mix các major version (v2 và v3) để tránh xung đột ProseMirror state.

### 2.2 Next.js App Router SSR Guard (`immediatelyRender: false`)

Khi khởi tạo editor trong Next.js App Router / Server Components, TipTap v3 yêu cầu thiết lập **`immediatelyRender: false`** để tránh lỗi Hydration Mismatch:

```typescript
const editor = useEditor({
  immediatelyRender: false, // Bắt buộc cho Next.js App Router SSR
  extensions: [
    StarterKit,
    CharacterCount.configure(),
    Placeholder.configure({ placeholder: "Start writing your IELTS essay..." }),
  ],
});
```

---

## 3. Student Writing Workspace Specification

### 3.1 IELTS Word Count Thresholds

IELTS examiners deduct band score points under Task Achievement / Task Response if essays fail to reach the official minimum length:

| Task Type                  | Official Minimum | Recommended Target | Overlength Warning Threshold            |
| :------------------------- | :--------------- | :----------------- | :-------------------------------------- |
| **Task 1 (Report/Letter)** | **150 words**    | 160 – 200 words    | > 240 words (Time inefficiency warning) |
| **Task 2 (Essay)**         | **250 words**    | 260 – 320 words    | > 380 words (Quality dilution warning)  |

### 3.2 Strict Mock Test Mode Requirements

In exam conditions:

- **Paste Prevention:** `editorProps.handlePaste` intercepts paste events and blocks external text input.
- **Drag-and-Drop Prevention:** `editorProps.handleDrop` intercepts drop events.
- **Exam Timer:** Integrated countdown timer (20m for Task 1, 40m for Task 2, 60m overall) with a 5-minute warning alert and auto-locking on time expiry.
- **Full-Screen Lockdown:** Toggles browser fullscreen mode (`document.documentElement.requestFullscreen()`) with tab switch warnings.

### 3.3 Plain-Text Extraction vs HTML Noise

```typescript
// ✅ RECOMMENDED: Clean plain text with double newlines
const cleanSubmissionText = editor.getText({ blockSeparator: "\n\n" });

// ❌ AVOID: HTML markup burns LLM context tokens and disrupts verbatim quote substring searches
const htmlNoise = editor.getHTML();
```

---

## 4. Teacher Review & Error Markup Specification

### 4.1 4-Criterion Taxonomy & Color Palette

| Criterion                        | Key                                            | Highlight Theme | Tailwind CSS Class                                                                                                                                        |
| :------------------------------- | :--------------------------------------------- | :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Grammatical Range & Accuracy** | `GRA` / `GRAMMATICAL_RANGE_ACCURACY`           | Crimson Red     | `bg-red-100 text-red-900 border-b-2 border-red-500 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-400`                             |
| **Lexical Resource**             | `LR` / `LEXICAL_RESOURCE`                      | Royal Blue      | `bg-blue-100 text-blue-900 border-b-2 border-blue-500 hover:bg-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-400`                      |
| **Coherence & Cohesion**         | `CC` / `COHERENCE_COHESION`                    | Amber / Orange  | `bg-amber-100 text-amber-900 border-b-2 border-amber-500 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-400`               |
| **Task Achievement & Upgrades**  | `TA_TR` / `TASK_ACHIEVEMENT` / `TASK_RESPONSE` | Emerald Green   | `bg-emerald-100 text-emerald-900 border-b-2 border-emerald-500 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-400` |

---

## 5. Complete Production-Ready TypeScript Source Code (TipTap v3)

### 5.1 Type Definitions (`types/ielts-writing.ts`)

```typescript
export type IeltsTaskType = "TASK_1_ACADEMIC" | "TASK_1_GENERAL" | "TASK_2";

export type IeltsCriterion =
  | "TASK_ACHIEVEMENT"
  | "TASK_RESPONSE"
  | "COHERENCE_COHESION"
  | "LEXICAL_RESOURCE"
  | "GRAMMATICAL_RANGE_ACCURACY";

export type ErrorSeverity =
  "minor_slip" | "systematic_error" | "impedes_communication";

export interface IeltsAnnotationData {
  errorId: string;
  criterion: IeltsCriterion;
  category: string;
  severity: ErrorSeverity;
  explanation: string;
  suggestedCorrection: string;
  originalQuote?: string;
}

export interface WritingDraft {
  contentHtml: string;
  contentText: string;
  wordCount: number;
  lastSavedAt: string;
  timeRemainingSeconds?: number;
}
```

### 5.2 TipTap v3 Custom Mark Extension (`extensions/IeltsAnnotationMark.ts`)

```typescript
import { Mark, mergeAttributes } from "@tiptap/core";
import {
  IeltsAnnotationData,
  IeltsCriterion,
  ErrorSeverity,
} from "../types/ielts-writing";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ieltsAnnotation: {
      setIeltsAnnotation: (attributes: IeltsAnnotationData) => ReturnType;
      unsetIeltsAnnotation: () => ReturnType;
    };
  }
}

export const IeltsAnnotationMark = Mark.create<Record<string, never>>({
  name: "ieltsAnnotation",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      errorId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-error-id"),
        renderHTML: (attrs) => ({ "data-error-id": attrs.errorId }),
      },
      criterion: {
        default: "GRAMMATICAL_RANGE_ACCURACY",
        parseHTML: (el) => el.getAttribute("data-criterion") as IeltsCriterion,
        renderHTML: (attrs) => ({ "data-criterion": attrs.criterion }),
      },
      category: {
        default: "general_error",
        parseHTML: (el) => el.getAttribute("data-category"),
        renderHTML: (attrs) => ({ "data-category": attrs.category }),
      },
      severity: {
        default: "minor_slip",
        parseHTML: (el) => el.getAttribute("data-severity") as ErrorSeverity,
        renderHTML: (attrs) => ({ "data-severity": attrs.severity }),
      },
      explanation: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-explanation"),
        renderHTML: (attrs) => ({ "data-explanation": attrs.explanation }),
      },
      suggestedCorrection: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-suggested-correction"),
        renderHTML: (attrs) => ({
          "data-suggested-correction": attrs.suggestedCorrection,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "mark[data-error-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const criterion = HTMLAttributes["data-criterion"] as IeltsCriterion;

    let colorClasses =
      "bg-red-100 text-red-950 border-b-2 border-red-500 dark:bg-red-950/50 dark:text-red-200 dark:border-red-400";
    if (criterion === "LEXICAL_RESOURCE") {
      colorClasses =
        "bg-blue-100 text-blue-950 border-b-2 border-blue-500 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-400";
    } else if (criterion === "COHERENCE_COHESION") {
      colorClasses =
        "bg-amber-100 text-amber-950 border-b-2 border-amber-500 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-400";
    } else if (
      criterion === "TASK_ACHIEVEMENT" ||
      criterion === "TASK_RESPONSE"
    ) {
      colorClasses =
        "bg-emerald-100 text-emerald-950 border-b-2 border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-400";
    }

    return [
      "mark",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `ielts-error-annotation cursor-pointer rounded-sm px-1 py-0.5 transition-colors font-medium ${colorClasses}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setIeltsAnnotation:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetIeltsAnnotation:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
```

### 5.3 Auto-Save Draft Hook (`hooks/useWritingDraft.ts`)

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WritingDraft } from "../types/ielts-writing";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseWritingDraftOptions {
  storageKey: string;
  debounceMs?: number;
  initialContent?: string;
}

export function useWritingDraft({
  storageKey,
  debounceMs = 1000,
}: UseWritingDraftOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<WritingDraft | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed: WritingDraft = JSON.parse(cached);
        setRestoredDraft(parsed);
        setLastSaved(new Date(parsed.lastSavedAt));
      }
    } catch (err) {
      console.warn("Failed to restore draft from localStorage:", err);
    }
  }, [storageKey]);

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
          localStorage.setItem(storageKey, JSON.stringify(payload));
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
      localStorage.removeItem(storageKey);
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
```

### 5.4 Student Writing Workspace Component (`components/IeltsWritingEditor.tsx`)

```tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { useWritingDraft } from "../hooks/useWritingDraft";
import { IeltsTaskType } from "../types/ielts-writing";
import {
  Clock,
  Maximize2,
  Minimize2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Send,
  ShieldAlert,
} from "lucide-react";

interface IeltsWritingEditorProps {
  taskType: IeltsTaskType;
  promptTitle: string;
  promptBody: string;
  submissionId: string;
  userId: string;
  isMockTest?: boolean;
  timeLimitMinutes?: number;
  onSubmit: (submission: {
    plainText: string;
    wordCount: number;
    durationSeconds: number;
  }) => void;
}

export function IeltsWritingEditor({
  taskType,
  promptTitle,
  promptBody,
  submissionId,
  userId,
  isMockTest = false,
  timeLimitMinutes = taskType === "TASK_2" ? 40 : 20,
  onSubmit,
}: IeltsWritingEditorProps) {
  const minWords = taskType === "TASK_2" ? 250 : 150;
  const targetWordsMax = taskType === "TASK_2" ? 350 : 220;

  const storageKey = `ielts_draft_${userId}_${submissionId}_${taskType}`;
  const { saveStatus, lastSaved, restoredDraft, saveDraft, clearDraft } =
    useWritingDraft({
      storageKey,
    });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pasteAttemptBlocked, setPasteAttemptBlocked] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(
    timeLimitMinutes * 60
  );
  const [timerActive, setTimerActive] = useState(isMockTest);
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      CharacterCount.configure(),
      Placeholder.configure({
        placeholder: isMockTest
          ? "Exam Mode Active: Write your IELTS essay here. Paste is disabled."
          : "Start typing your IELTS essay response here...",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none min-h-[420px] p-6 focus:outline-none text-base leading-relaxed selection:bg-primary/20",
      },
      handlePaste: (view, event) => {
        if (isMockTest) {
          event.preventDefault();
          setPasteAttemptBlocked(true);
          setTimeout(() => setPasteAttemptBlocked(false), 3000);
          return true;
        }
        return false;
      },
      handleDrop: (view, event) => {
        if (isMockTest) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const words = editor.storage.characterCount.words();
      setWordCount(words);
      const text = editor.getText({ blockSeparator: "\n\n" });
      const html = editor.getHTML();
      saveDraft({ contentHtml: html, contentText: text, wordCount: words });
    },
  });

  useEffect(() => {
    if (editor && restoredDraft?.contentHtml && editor.isEmpty) {
      editor.commands.setContent(restoredDraft.contentHtml);
      setWordCount(restoredDraft.wordCount);
    }
  }, [editor, restoredDraft]);

  useEffect(() => {
    if (!timerActive || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, secondsRemaining]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const formattedTime = useMemo(() => {
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [secondsRemaining]);

  const wordProgressPercent = Math.min(
    100,
    Math.round((wordCount / minWords) * 100)
  );

  const wordCountBadge = useMemo(() => {
    if (wordCount === 0) {
      return {
        label: `Target: ${minWords} words`,
        color: "bg-muted text-muted-foreground",
      };
    }
    if (wordCount < minWords) {
      return {
        label: `${wordCount} / ${minWords} words (${minWords - wordCount} words to reach minimum)`,
        color:
          "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300",
      };
    }
    if (wordCount <= targetWordsMax) {
      return {
        label: `${wordCount} words (Optimal Length)`,
        color:
          "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300",
      };
    }
    return {
      label: `${wordCount} words (Extended Length)`,
      color:
        "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300",
    };
  }, [wordCount, minWords, targetWordsMax]);

  const handleSubmit = () => {
    if (!editor) return;
    const plainText = editor.getText({ blockSeparator: "\n\n" });
    const duration = timeLimitMinutes * 60 - secondsRemaining;
    clearDraft();
    onSubmit({ plainText, wordCount, durationSeconds: Math.max(1, duration) });
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      {/* Header & Prompt Section */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {taskType === "TASK_2"
                ? "IELTS Writing Task 2 (Essay)"
                : "IELTS Writing Task 1 (Report)"}
            </span>
            {isMockTest && (
              <span className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                <ShieldAlert className="h-3.5 w-3.5" />
                Strict Exam Mode
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-sm font-semibold border ${
                secondsRemaining < 300
                  ? "bg-destructive/10 text-destructive border-destructive/30 animate-pulse"
                  : "bg-muted/60 text-foreground border-border"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{formattedTime}</span>
            </div>

            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="pt-4">
          <h2 className="text-base font-semibold text-foreground mb-1">
            {promptTitle}
          </h2>
          <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
            {promptBody}
          </div>
        </div>
      </div>

      {pasteAttemptBlocked && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-medium animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            Copy-pasting is strictly disabled in Exam Mode to ensure genuine
            test practice.
          </span>
        </div>
      )}

      <div className="rounded-xl border bg-background shadow-sm overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-primary/20">
        <EditorContent editor={editor} />

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t bg-muted/20 text-xs">
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded-md border font-medium text-xs ${wordCountBadge.color}`}
            >
              {wordCountBadge.label}
            </span>
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
              <div
                className={`h-full transition-all duration-300 ${
                  wordCount >= minWords ? "bg-emerald-500" : "bg-amber-500"
                }`}
                style={{ width: `${wordProgressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-1.5">
              {saveStatus === "saving" && (
                <>
                  <Save className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Saving draft...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>
                    Draft saved{" "}
                    {lastSaved ? lastSaved.toLocaleTimeString() : ""}
                  </span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span>Save failed</span>
                </>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={wordCount < 10}
              className="gap-1.5 h-8 px-4 font-semibold shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
              Submit for AI Evaluation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Implementation Checklist & Verification Matrix

- [x] TipTap v3 Ecosystem configured with React 19 / App Router (`immediatelyRender: false`).
- [x] Real-time word counting threshold tracking via `@tiptap/extension-character-count`.
- [x] `useWritingDraft` auto-saving debounced hook with `localStorage` crash recovery.
- [x] Strict Exam Mock Test mode blocking `handlePaste` and `handleDrop`.
- [x] Plain-text extraction via `editor.getText({ blockSeparator: '\n\n' })` for Gemini AI grading.
- [x] TipTap v3 Custom Mark extension `IeltsAnnotationMark` for the 4 IELTS criteria (GRA, LR, CC, TA/TR).
- [x] Interactive error diagnostics popover and one-click text replacement transaction.
