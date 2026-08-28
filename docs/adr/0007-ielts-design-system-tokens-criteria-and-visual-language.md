# ADR-0007: IELTS Design System Tokens, Criteria Colors, and Visual Language Specification

**Status:** Accepted  
**Date:** 2026-08-28  
**Target Module:** Design System, Tailwind v4 Tokens (`app/globals.css`), UI Primitives (`components/ui`), Assessment & Review Workspaces

---

## Context & Problem

The IELTS Learning Platform requires an unambiguous visual language across both Writing and Speaking workflows. Prior implementations had arbitrary hex colors for criteria in scattered files, lack of standardized severity underlines in text annotations, and no unified component for rendering IELTS band scores across candidate levels.

---

## Decisions

### 1. First-Class 5-Criteria Semantic Color Tokens in Tailwind v4

We register 5 semantic criterion color palettes directly into `@theme inline` and `:root` / `.dark` in `app/globals.css`:

| Criterion                        | Semantic Token          | Color Family      | Permitted Scope                                          |
| :------------------------------- | :---------------------- | :---------------- | :------------------------------------------------------- |
| **Task Achievement / Response**  | `--color-criterion-ta`  | Emerald (`oklch`) | Writing TA/TR sub-scores, badges, evidence highlights    |
| **Coherence & Cohesion**         | `--color-criterion-cc`  | Amber (`oklch`)   | CC linking device markers, flow diagnostic notes         |
| **Lexical Resource**             | `--color-criterion-lr`  | Blue (`oklch`)    | LR vocabulary upgrades, collocation corrections          |
| **Grammatical Range & Accuracy** | `--color-criterion-gra` | Rose (`oklch`)    | GRA grammar slips, sentence structure callouts           |
| **Pronunciation (Speaking)**     | `--color-criterion-pr`  | Violet (`oklch`)  | Speaking phonetic notes, intonation markers, audio clips |

Each token includes a base color, a background highlight (`--color-criterion-*-bg`: 16% light / 28% dark), and a subtle border token (`--color-criterion-*-subtle`).

### 2. 3-Tier Error Annotation Visual Encoding

Editor text annotations and audio markers follow a standardized 3-tier severity scale:

- `minor_slip`: Dotted underline (`border-b-2 border-dotted`) with criterion color.
- `systematic_error`: Solid underline (`border-b-2 border-solid`) with 15% criterion background tint.
- `impedes_communication`: Wavy underline (`border-b-2 border-wavy`) with destructive badge alert.

### 3. Standardized `<BandScoreBadge />` Component

We introduce `<BandScoreBadge score={...} size="sm"|"md"|"lg" />` mapping to 4 official IELTS band performance tiers:

- **Band 8.0 – 9.0 (Expert / Very Good)**: Emerald theme (`bg-emerald-500/10 text-emerald-600 border-emerald-500/30`)
- **Band 6.5 – 7.5 (Competent / Good)**: Blue theme (`bg-blue-500/10 text-blue-600 border-blue-500/30`)
- **Band 5.0 – 6.0 (Modest)**: Amber theme (`bg-amber-500/10 text-amber-600 border-amber-500/30`)
- **Band < 5.0 (Limited)**: Rose/Destructive theme (`bg-rose-500/10 text-rose-600 border-rose-500/30`)

### 4. Typography Measure & Editorial Essay Preset

For TipTap and long-form proofreading, the `.prose-essay` class enforces an optimal reading measure ($68\text{ch}$ max-width), $1.8$ line-height, and $0.75\text{rem}$ paragraph separation to eliminate teacher visual fatigue during grading.

---

## Consequences

- **Single Source of Truth**: All UI elements, graphs, and TipTap marks pull from CSS theme variables.
- **Accessibility Guarantee**: Color pairings strictly adhere to WCAG 2.1 AA contrast standards ($\ge 4.5:1$).
- **Storybook Coverage**: All token states and badge variants are verified via headless interaction tests.
