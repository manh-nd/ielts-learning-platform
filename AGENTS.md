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
