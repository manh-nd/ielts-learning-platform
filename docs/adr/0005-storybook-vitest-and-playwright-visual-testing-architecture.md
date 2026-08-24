# ADR-0005: Storybook 10, @storybook/addon-vitest Native Testing, Strict A11y, and Playwright Visual Regression Architecture

**Status:** Accepted  
**Date:** 2026-08-24  
**Target Module:** UI Component Catalog, Interaction Testing, Accessibility (A11y), and Visual Regression Pipeline

---

## Context & Problem

The IELTS Learning Platform relies heavily on complex, interactive UI components:

- TipTap rich text annotator with floating diagnostic popovers (`TeacherReviewAnnotator`).
- Real-time IELTS Speaking exam room with Gemini 3.1 Flash Live WebSockets & audio visualizers (`LiveSpeakingExaminerRoom`).
- Multi-step speaking test practice suites with cue cards, countdown timers, and recording flows (`SpeakingPracticeSuite`).
- Criteria scorecard with AI comparison deltas and band score rounding algorithms (`AssessmentScorecard`).

Previously, our testing architecture suffered from three key challenges:

1. **Slow & Fragile Interaction Testing**: Component interaction tests relied on `@storybook/test-runner`, which required launching a separate Storybook development server (`storybook dev`), causing 15–25s cold starts, port conflicts, and flaky WebSocket test connections in CI.
2. **Ignored Accessibility Violations**: Storybook a11y checks were set to `todo` status or blanket-disabled, allowing WCAG 2.1 AA color contrast and semantic markup issues to slip through.
3. **Cross-Platform Visual Drift**: Screenshot testing between macOS local machines and Linux CI runners produced false-positive diffs due to font anti-aliasing and rendering engine discrepancies.

---

## Decisions

### 1. Storybook 10 & Native `@storybook/addon-vitest` Browser Runner

We standardized on **Storybook 10** (`@storybook/nextjs-vite`) coupled with **`@storybook/addon-vitest`**:

- **Headless Execution**: Interaction tests execute via `bun run test:storybook` (`vitest --project=storybook --run`) using `@vitest/browser` and Playwright Chromium headless runner. No standalone Storybook server is required.
- **Core Package Consolidation**: All `.stories.tsx` files import test utilities directly from `storybook/test` (`expect`, `userEvent`, `within`, `fn`), eliminating separate legacy `@storybook/test` / `@storybook/testing-library` packages and version mismatches.
- **Offline Font Shims**: Replaced remote Google Fonts network fetches in `.storybook/preview.tsx` with offline CSS variable placeholders to ensure zero network-dependent flakes during automated test execution.

### 2. Strict Accessibility Zero-Violation Policy (`a11y: { test: "error" }`)

We activated strict a11y enforcement across all component stories:

- Configured `.storybook/preview.tsx` with `a11y: { test: "error" }`.
- **Zero Blanket Disabling**: Banned disabling Axe core rules at the story or component level.
- **Remediated Real Violations**:
  - **Color Contrast**: Upgraded all low-contrast greens, ambers, and blues on tinted backgrounds to high-contrast palettes (`text-*-800`, `text-*-900`, `bg-*-700`, `dark:text-*-300`), ensuring minimum 4.5:1 contrast ratios.
  - **Aria Attribute Compliance**: Strictly bound `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` to elements with explicit slider roles (`role="slider"`).
  - **Accessible Names**: Provided explicit `aria-label` attributes on icon-only buttons, triggers (`SelectTrigger`, `SliderThumb`), and scratchpad controls.
  - **Heading Hierarchy**: Preserved semantic heading order (`h1` -> `h2` -> `h3`) without skipping levels.

### 3. Playwright Visual Regression Pipeline (`playwright.visual.config.ts`)

We implemented an automated visual regression testing suite targeting static Storybook builds:

- **Static Target**: Tests execute against `storybook-static` served via a lightweight HTTP server (`playwright.visual.config.ts`).
- **Matrix Coverage**: Captures 5 core component suites across 4 configurations:
  - Viewports: **Desktop 1280px** & **Mobile 375px**
  - Color Schemes: **Light Mode** & **Dark Mode**
- **Flake-Free Snapshot Determinism**:
  - Injected universal CSS to freeze animations and transitions (`animation-duration: 0.001s !important; transition-duration: 0.001s !important;`).
  - Disabled blinking carets (`caret-color: transparent !important;`).
  - Fixed page clocks and mock timestamps to avoid dynamic time-drift.
- **Linux Docker Consistency**: Standardized visual snapshot generation and CI verification using the official Playwright Docker image (`mcr.microsoft.com/playwright:v1.62.1-noble`) via `bun run test:visual` / `bun run test:visual:update` to guarantee identical font rendering across developers and CI runners.

### 4. Fast Pre-commit Hook (<2s Execution)

We configured `.husky/pre-commit` to execute:

```bash
bunx lint-staged && bun run typecheck && bun run test:unit
```

This guarantees that unformatted code, TypeScript errors, and broken unit tests cannot be committed to the repository, while completing in under 2 seconds.

---

## Consequences & Trade-offs

### Positive

- **Fast Local Feedback**: 163 interaction tests run across 39 story files in ~16 seconds; 84 unit tests run in ~250ms.
- **Inclusive & Compliant UI**: Guaranteed WCAG 2.1 AA compliance across all design system components.
- **Zero Visual Regressions**: Intentional or accidental visual regressions in complex review workspaces and scoring components are caught immediately.
- **Unified Testing Stack**: Vitest and Playwright form a cohesive, browser-accurate testing platform across unit, interaction, E2E, and visual testing.

### Considerations / Operational Rules

- When intentionally updating component UI layouts, snapshots must be updated using `bun run test:visual:local` (macOS local) or `bun run test:visual:update` (Docker for CI alignment).
- All new Storybook stories must include `play` functions for interactive states and must pass `a11y: { test: "error" }` without exceptions.
