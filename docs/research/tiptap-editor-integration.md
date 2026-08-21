# Research: TipTap Editor Integration for IELTS Writing & Teacher Error Markup

**Ticket:** #11  
**Status:** Approved Specification  
**Target Module:** IELTS Writing (Student Homework & Mock Test Workspace, Teacher Review & Error Annotation)  
**Primary Dependencies:** `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-character-count`, `@tiptap/extension-placeholder`, `@tiptap/extension-highlight`, `@tiptap/core`

---

## 1. Overview & System Architecture

The IELTS Writing module requires two specialized editing environments:

1. **Student Writing Workspace:** A distraction-free, exam-disciplined editor that tracks real-time word count against IELTS thresholds (150 words for Task 1, 250 words for Task 2), auto-saves drafts locally, enforces exam mode (paste prevention, timer countdown, full-screen lockdown), and exports clean plain text for AI evaluation.
2. **Teacher Review & Error Markup Workspace:** An interactive evaluation interface that highlights errors across the 4 IELTS criteria (Grammar, Lexicon, Cohesion, Task Fulfillment), links to the AI assessment schema, and provides popovers with error diagnostics and one-click correction application.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         STUDENT WRITING WORKSPACE                        │
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
│                   AI EVALUATION ENGINE (Ticket #10 Schema)               │
│  • Task Achievement / Task Response (TA/TR)                              │
│  • Coherence & Cohesion (CC)                                             │
│  • Lexical Resource (LR)                                                 │
│  • Grammatical Range & Accuracy (GRA)                                    │
│  • Detected Errors Array (Verbatim original_quote + suggested_correction)│
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ JSON Output
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    TEACHER REVIEW & ANNOTATION WORKSPACE                 │
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

## 2. Package Ecosystem & Next.js App Router Integration

### 2.1 Required NPM Dependencies

```bash
bun add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-character-count @tiptap/extension-placeholder @tiptap/extension-highlight @tiptap/core
```

### 2.2 Next.js App Router (React 19) SSR Considerations

TipTap relies heavily on browser DOM primitives (`window`, `document`, `DOMParser`). When used within the Next.js App Router:

1. **`immediatelyRender: false`**: React 19's stricter hydration checks will throw a hydration mismatch error if the editor initializes during the server render phase. Setting `immediatelyRender: false` in `useEditor()` delays editor DOM attachment until client hydration is complete.
2. **Client Directive (`'use client'`):** All components invoking `useEditor` must be marked with `'use client'`.

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

## 5. Complete Production-Ready TypeScript Source Code

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

### 5.2 Custom TipTap Mark Extension (`extensions/IeltsAnnotationMark.ts`)

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
  initialContent = "",
}: UseWritingDraftOptions) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<WritingDraft | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft on mount
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

  // Debounced save
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

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  Sparkles,
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

  // Restore draft content once editor is ready
  useEffect(() => {
    if (editor && restoredDraft?.contentHtml && editor.isEmpty) {
      editor.commands.setContent(restoredDraft.contentHtml);
      setWordCount(restoredDraft.wordCount);
    }
  }, [editor, restoredDraft]);

  // Exam Countdown Timer
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
            {/* Timer */}
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

            {/* Fullscreen Toggle */}
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

        {/* Prompt Body */}
        <div className="pt-4">
          <h2 className="text-base font-semibold text-foreground mb-1">
            {promptTitle}
          </h2>
          <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
            {promptBody}
          </div>
        </div>
      </div>

      {/* Paste Block Alert Notification */}
      {pasteAttemptBlocked && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-medium animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            Copy-pasting is strictly disabled in Exam Mode to ensure genuine
            test practice.
          </span>
        </div>
      )}

      {/* Editor Main Container */}
      <div className="rounded-xl border bg-background shadow-sm overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-primary/20">
        <EditorContent editor={editor} />

        {/* Editor Bottom Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t bg-muted/20 text-xs">
          {/* Word Count Indicator */}
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

          {/* Auto-Save Status */}
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

            {/* Submit Action */}
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

### 5.5 Teacher Review & Error Annotator Component (`components/TeacherReviewAnnotator.tsx`)

```tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { IeltsAnnotationMark } from "../extensions/IeltsAnnotationMark";
import { Button } from "@/components/ui/button";
import {
  IeltsAnnotationData,
  IeltsCriterion,
  ErrorSeverity,
} from "../types/ielts-writing";
import {
  CheckCircle2,
  Trash2,
  PlusCircle,
  Sparkles,
  BookOpen,
  HelpCircle,
  X,
  Highlighter,
} from "lucide-react";

interface DetectedError {
  id: string;
  criterion: IeltsCriterion;
  category: string;
  severity: ErrorSeverity;
  original_quote: string;
  context_sentence?: string;
  explanation: string;
  suggested_correction: string;
}

interface TeacherReviewAnnotatorProps {
  initialContent: string;
  initialErrors?: DetectedError[];
  onSaveAnnotations?: (annotations: IeltsAnnotationData[]) => void;
}

export function TeacherReviewAnnotator({
  initialContent,
  initialErrors = [],
  onSaveAnnotations,
}: TeacherReviewAnnotatorProps) {
  const [activeAnnotation, setActiveAnnotation] =
    useState<IeltsAnnotationData | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [selectionRange, setSelectionRange] = useState<{
    from: number;
    to: number;
    text: string;
  } | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // New annotation draft form state
  const [newCriterion, setNewCriterion] = useState<IeltsCriterion>(
    "GRAMMATICAL_RANGE_ACCURACY"
  );
  const [newCategory, setNewCategory] = useState("subject_verb_agreement");
  const [newSeverity, setNewSeverity] = useState<ErrorSeverity>("minor_slip");
  const [newExplanation, setNewExplanation] = useState("");
  const [newSuggestion, setNewSuggestion] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, IeltsAnnotationMark],
    content: initialContent,
    editable: true,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none min-h-[480px] p-6 focus:outline-none text-base leading-relaxed selection:bg-primary/20",
      },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, " ");
        setSelectionRange({ from, to, text });
      } else {
        setSelectionRange(null);
        setShowAddMenu(false);
      }
    },
  });

  // Apply initial errors from AI grading
  useEffect(() => {
    if (!editor || initialErrors.length === 0) return;

    // Convert plain text to search matches and apply marks
    const doc = editor.state.doc;
    const docText = editor.getText();

    editor.chain().focus();
    initialErrors.forEach((err) => {
      let startIndex = 0;
      while (
        (startIndex = docText.indexOf(err.original_quote, startIndex)) !== -1
      ) {
        const from = startIndex + 1; // 1-based ProseMirror index
        const to = from + err.original_quote.length;

        editor.commands.setTextSelection({ from, to });
        editor.commands.setIeltsAnnotation({
          errorId: err.id,
          criterion: err.criterion,
          category: err.category,
          severity: err.severity,
          explanation: err.explanation,
          suggestedCorrection: err.suggested_correction,
          originalQuote: err.original_quote,
        });

        startIndex += err.original_quote.length;
      }
    });
  }, [editor, initialErrors]);

  // Handle clicking on an annotated mark in DOM
  const handleEditorClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const markElement = target.closest("mark[data-error-id]") as HTMLElement;

      if (markElement) {
        const rect = markElement.getBoundingClientRect();
        setPopoverPosition({
          top: rect.bottom + window.scrollY + 8,
          left: Math.max(16, rect.left + window.scrollX - 100),
        });

        setActiveAnnotation({
          errorId: markElement.getAttribute("data-error-id") || "",
          criterion:
            (markElement.getAttribute("data-criterion") as IeltsCriterion) ||
            "GRAMMATICAL_RANGE_ACCURACY",
          category: markElement.getAttribute("data-category") || "",
          severity:
            (markElement.getAttribute("data-severity") as ErrorSeverity) ||
            "minor_slip",
          explanation: markElement.getAttribute("data-explanation") || "",
          suggestedCorrection:
            markElement.getAttribute("data-suggested-correction") || "",
          originalQuote: markElement.textContent || "",
        });
      } else {
        setActiveAnnotation(null);
        setPopoverPosition(null);
      }
    },
    []
  );

  // Add Teacher Custom Annotation
  const handleCreateAnnotation = () => {
    if (!editor || !selectionRange) return;

    const errorId = `teacher_err_${Date.now()}`;
    editor.commands.setIeltsAnnotation({
      errorId,
      criterion: newCriterion,
      category: newCategory,
      severity: newSeverity,
      explanation: newExplanation,
      suggestedCorrection: newSuggestion,
      originalQuote: selectionRange.text,
    });

    setShowAddMenu(false);
    setNewExplanation("");
    setNewSuggestion("");
  };

  // Apply suggested correction
  const handleApplyCorrection = () => {
    if (!editor || !activeAnnotation) return;

    // Find and replace the marked text with the suggested correction
    const doc = editor.state.doc;
    doc.descendants((node, pos) => {
      if (
        node.isText &&
        node.marks.some(
          (m) =>
            m.type.name === "ieltsAnnotation" &&
            m.attrs.errorId === activeAnnotation.errorId
        )
      ) {
        const from = pos;
        const to = pos + node.nodeSize;
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContentAt(from, activeAnnotation.suggestedCorrection)
          .run();
      }
    });

    setActiveAnnotation(null);
    setPopoverPosition(null);
  };

  // Remove annotation mark
  const handleRemoveAnnotation = () => {
    if (!editor || !activeAnnotation) return;

    const doc = editor.state.doc;
    doc.descendants((node, pos) => {
      if (
        node.isText &&
        node.marks.some(
          (m) =>
            m.type.name === "ieltsAnnotation" &&
            m.attrs.errorId === activeAnnotation.errorId
        )
      ) {
        const from = pos;
        const to = pos + node.nodeSize;
        editor.commands.setTextSelection({ from, to });
        editor.commands.unsetIeltsAnnotation();
      }
    });

    setActiveAnnotation(null);
    setPopoverPosition(null);
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto flex flex-col gap-4">
      {/* Teacher Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <Highlighter className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Teacher Evaluation & Error Markup
          </h2>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-100 text-red-950 font-medium">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            GRA (Grammar)
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-100 text-blue-950 font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            LR (Vocabulary)
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-100 text-amber-950 font-medium">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            CC (Cohesion)
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-100 text-emerald-950 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            TA/TR (Fulfillment)
          </span>
        </div>
      </div>

      {/* Floating Selection Toolbar for adding new annotations */}
      {selectionRange && !showAddMenu && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-popover border shadow-lg animate-in fade-in">
          <span className="text-xs text-muted-foreground font-medium">
            "{selectionRange.text.slice(0, 25)}..."
          </span>
          <Button
            size="xs"
            onClick={() => setShowAddMenu(true)}
            className="gap-1"
          >
            <PlusCircle className="h-3 w-3" />
            Add Error Annotation
          </Button>
        </div>
      )}

      {/* Modal / Card to create new teacher annotation */}
      {showAddMenu && selectionRange && (
        <div className="p-4 rounded-xl border bg-card shadow-lg flex flex-col gap-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xs font-semibold text-foreground">
              Annotate Selected Phrase:{" "}
              <span className="text-primary italic">
                "{selectionRange.text}"
              </span>
            </h3>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowAddMenu(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Criterion
              </label>
              <select
                value={newCriterion}
                onChange={(e) =>
                  setNewCriterion(e.target.value as IeltsCriterion)
                }
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground mt-1"
              >
                <option value="GRAMMATICAL_RANGE_ACCURACY">
                  GRA - Grammar
                </option>
                <option value="LEXICAL_RESOURCE">LR - Vocabulary</option>
                <option value="COHERENCE_COHESION">
                  CC - Coherence & Cohesion
                </option>
                <option value="TASK_RESPONSE">TR - Task Response</option>
                <option value="TASK_ACHIEVEMENT">TA - Task Achievement</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Category
              </label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. subject_verb_agreement"
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Severity
              </label>
              <select
                value={newSeverity}
                onChange={(e) =>
                  setNewSeverity(e.target.value as ErrorSeverity)
                }
                className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground mt-1"
              >
                <option value="minor_slip">Minor Slip</option>
                <option value="systematic_error">Systematic Error</option>
                <option value="impedes_communication">
                  Impedes Communication
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Diagnostic Explanation
              </label>
              <textarea
                rows={2}
                value={newExplanation}
                onChange={(e) => setNewExplanation(e.target.value)}
                placeholder="Explain why this usage is problematic under IELTS band descriptors..."
                className="w-full rounded-md border bg-background p-2 text-xs text-foreground mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Suggested Correction
              </label>
              <textarea
                rows={2}
                value={newSuggestion}
                onChange={(e) => setNewSuggestion(e.target.value)}
                placeholder="High-band replacement phrase..."
                className="w-full rounded-md border bg-background p-2 text-xs text-foreground mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowAddMenu(false)}
            >
              Cancel
            </Button>
            <Button size="xs" onClick={handleCreateAnnotation}>
              Save Annotation
            </Button>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div
        className="rounded-xl border bg-background shadow-sm overflow-hidden"
        onClick={handleEditorClick}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Interactive Popover Card for Clicked Annotation */}
      {activeAnnotation && popoverPosition && (
        <div
          className="absolute z-50 w-80 rounded-xl border bg-popover text-popover-foreground p-4 shadow-xl animate-in fade-in zoom-in-95"
          style={{
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
          }}
        >
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                activeAnnotation.criterion === "GRAMMATICAL_RANGE_ACCURACY"
                  ? "bg-red-100 text-red-950"
                  : activeAnnotation.criterion === "LEXICAL_RESOURCE"
                    ? "bg-blue-100 text-blue-950"
                    : activeAnnotation.criterion === "COHERENCE_COHESION"
                      ? "bg-amber-100 text-amber-950"
                      : "bg-emerald-100 text-emerald-950"
              }`}
            >
              {activeAnnotation.criterion.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono uppercase">
              {activeAnnotation.severity.replace(/_/g, " ")}
            </span>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Original Text:
              </span>
              <p className="line-through text-destructive font-medium mt-0.5">
                "{activeAnnotation.originalQuote}"
              </p>
            </div>

            {activeAnnotation.suggestedCorrection && (
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Suggested Correction:
                </span>
                <p className="text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  "{activeAnnotation.suggestedCorrection}"
                </p>
              </div>
            )}

            {activeAnnotation.explanation && (
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Examiner Note:
                </span>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  {activeAnnotation.explanation}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3 mt-3">
            <Button
              variant="destructive"
              size="xs"
              onClick={handleRemoveAnnotation}
              className="gap-1 text-[11px]"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </Button>

            {activeAnnotation.suggestedCorrection && (
              <Button
                variant="default"
                size="xs"
                onClick={handleApplyCorrection}
                className="gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-3 w-3" />
                Apply Correction
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```
