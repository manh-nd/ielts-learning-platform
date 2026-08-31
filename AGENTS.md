<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

GitHub issues via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` and `docs/adr/` at repo root). See `docs/agents/domain.md`.

### Rich Text Editor (Tiptap)

We use **Tiptap v3** (`@tiptap/core@^3`, `@tiptap/react@^3`, `@tiptap/starter-kit@^3`).

- React Composable API: Use `useEditor` or `<EditorContent />` with `immediatelyRender: false` in Next.js / SSR.
- Refer to `.agents/skills/tiptap/SKILL.md` before implementing annotations or editor extensions.

### End-to-End Testing (Playwright)

We use **Playwright** (`@playwright/test`) for full user-journey testing:

- E2E tests are located in `e2e/` (`landing.spec.ts`, `auth.spec.ts`, `protected-routes.spec.ts`, `error-states.spec.ts`).
- Run unit tests: `bun run test` (excludes `e2e/`).
- In test environments, `ENABLE_E2E_MOCK_AUTH=true` enables mock session cookies (`e2e_mock_session`) so tests execute in ~7s without requiring an active PostgreSQL container.

### Storybook Interaction & Vitest Testing

We use **Storybook 10** (`@storybook/nextjs-vite` + `@storybook/addon-vitest`):

- Run interaction & a11y tests headlessly: `bun run test:storybook` (`vitest --project=storybook --run`).
- Accessibility validation is strictly enforced with zero violations: `a11y: { test: "error" }`.
- All stories use imports from `storybook/test` (e.g. `expect`, `userEvent`, `within`, `fn`).

### Visual Regression Testing (Playwright)

- Visual regression config: `playwright.visual.config.ts` targeting static Storybook build (`storybook-static`).
- Test suite: `e2e/visual/storybook-visual.spec.ts` capturing 5 core component suites across viewports (1280px Desktop & 375px Mobile) and color schemes (Light & Dark).
- Run visual tests locally: `bun run test:visual:local`.
- Update snapshots locally: `bunx playwright test -c playwright.visual.config.ts --update-snapshots`.
- Run / update snapshots with Linux Docker container: `bun run test:visual` / `bun run test:visual:update`.

### Code Naming Conventions (Google Style for Acronyms)

We follow the Google TypeScript/Java Style Guide rule: **"Treat abbreviations as words"** in code identifiers:

- **PascalCase**: `AiAssessmentProposal` (avoid `AIAssessmentProposal`), `IeltsWritingAssessment`, `SttEngine`, `XmlHttpRequest`.
- **camelCase**: `aiProposalScores`, `aiScore`, `audioUrl`, `userId`, `scorecardJson`.
- **SCREAMING_SNAKE_CASE**: Retain full uppercase with underscores for constants (`IELTS_BAND_DESCRIPTORS`, `IELTS_VERBATIM_STT_PROMPT`).
- **Prose & UI Text**: Standard uppercase (e.g. "AI", "IELTS", "STT", "CEFR") is allowed in Vietnamese/English natural language prose and UI labels.

### UI/UX Consistency, Spacing & Layout Audit

When creating or modifying frontend components (`components/**/*.tsx` or `app/**/*.tsx`):

- **Read the skill**: Refer to `.agents/skills/ui-audit/SKILL.md` before adjusting layout, cards, or typography.
- **Card Flush Header Pattern**: If a `<Card>` contains `<CardHeader>` with `border-b` or a colored background (`bg-*`), **`<Card>` MUST explicitly include `py-0 gap-0`** to prevent the default 16px vertical padding from displacing the header.
- **Strict Spacing Scale**: Use only standard Tailwind tokens (`2`, `3`, `4`, `6`, `8` = 8px, 12px, 16px, 24px, 32px). Never use arbitrary spacing like `p-[13px]`, `m-[7px]`.
- **Card Grid Alignment**: Use `h-full flex flex-col justify-between` on sibling cards within grid layouts to guarantee aligned bottom borders.
- **Automated Verification**: Run `bun run audit:ui` before declaring any UI task complete.

### Component Architecture & Reuse-First Policy

To avoid component duplication, dead code, and visual drift, follow the **3-Tier Component Architecture**:

1. **Tier 1: `components/ui/` (Primitives)**: Pure design system tokens & base UI (shadcn / Base UI: Button, Card, Dialog, Badge, Tabs, Tooltip). Free of business logic.
2. **Tier 2: `components/shared/` (Business Compounds)**: Reusable composite domain blocks across Speaking, Writing, Reading, and Teacher Review (`components/shared/audio/`, `components/shared/assessment/`, `components/shared/transcript/`, `components/shared/feedback/`). Every shared component must have its own Storybook story (`*.stories.tsx`).
3. **Tier 3: `components/[feature]/` (Domain Views)**: Screen-level flows (`speaking/live/`, `speaking/practice/`, `review/`, `landing/`). Feature views compose Tier 1 & Tier 2 components without recreating them.

**Agent Rules for Component Creation:**

- **Discovery First**: NEVER create a new component under a feature directory without first searching `components/shared/`, `components/ui/`, and existing Storybook stories.
- **No Duplicate Components**: If an existing component satisfies $\ge 70\%$ of the needed behavior, reuse or extend it via props/variants. Never copy-paste or write duplicate variants.
- **Promote to Shared**: If authoring a component that can be used across 2 or more features, place it in `components/shared/` and re-export via `components/shared/index.ts`.
- **Dead Code Hygiene**: Run `bun run audit:deadcode` (Knip) and `bun run audit:ui` before finishing any frontend task.
