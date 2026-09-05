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

### Domain docs & source of truth precedence

Single-context layout (`CONTEXT.md` and `docs/adr/` at repo root). See `docs/agents/domain.md`.

When requirements, documentation, or code comments conflict, resolve ambiguity using this strict precedence order:

1. **Latest Accepted ADR** (`docs/adr/`): Authoritative for system architecture, aggregate boundaries, and data governance decisions (e.g. ADR-0009, ADR-0010).
2. **`CONTEXT.md`**: Ubiquitous language definitions, core aggregates, entity ownership, and naming conventions.
3. **Current Implementation Contracts & Tests**: Authoritative for **current runtime behavior and backwards-compatibility contracts only**. Passing tests and existing code do **NOT** redefine canonical domain truth or justify architectural violations when they conflict with an accepted ADR or `CONTEXT.md` (existing code may contain legacy pilot debt actively targeted for refactoring).
4. **`PRD.md`**: Initial product vision, background, and feature context only. Yields whenever it conflicts with an accepted ADR, `CONTEXT.md`, or canonical domain rules.

### Architecture & Domain Boundaries (UI Must NOT Own Domain Logic)

UI renders state and emits user intent. Domain invariants, lifecycle decisions, and evaluation policies must NEVER live in React components, Next.js pages, or HTTP route handlers.

Unambiguous dependency direction (inward towards domain, zero outward dependencies from domain):

```text
UI (app / components)
       │
       ▼ renders presentation state + emits user intent
Application (modules/*/application) ───► Domain (modules/*/domain) [PURE CORE]
       ▲                                      ▲
       │ implements outbound ports            │ defines domain contracts
       │                                      │
Infrastructure adapters (modules/*/infrastructure, lib/*)
(persistence / Drizzle, Gemini, storage / S3 / SeaweedFS, external services)
```

- **UI depends on Application**: renders presentation state and forwards user intent.
- **Application depends on Domain**: orchestrates use cases, invokes pure domain policies, and coordinates external adapters.
- **Infrastructure depends inward on Application and Domain**: implements ports, persistence, and external services.
- **Domain is pure and depends on NOTHING**: zero imports of React, Next.js, browser APIs, Drizzle, Gemini SDK, AWS/S3 SDK, telemetry, or `fetch`. **Domain must never depend on Infrastructure.**

#### Layer Responsibilities

- **Presentation (`app/`, `components/`)**:
  - **Permitted**: Ephemeral presentation concerns (open/closed dialogs, active tab selection, temporary form input state, animation, visual formatting) and emitting user intent to application use cases or API routes.
  - **Forbidden**: Deciding domain lifecycle transitions (e.g. `in_progress` -> `completed`), evaluating retry eligibility, enforcing aggregate invariants, interpreting assessment state semantics, or inspecting raw database fields/strings to infer domain status.
  - **Prohibition on Fake Decoupling**: Do not attempt to solve domain leakage by moving domain logic into a React hook or utility that still manipulates React state setters. Domain/application seams must return meaningful domain results for UI to render.
- **Route Handlers (`app/api/`)**:
  - **Permitted**: Authenticating sessions, parsing/validating HTTP request payloads, mapping transport data, and delegating to application use cases.
  - **Forbidden**: Housing business lifecycle transitions, retry policies, or domain invariants directly inside route handlers.
- **Application (`modules/*/application/`)**:
  - Orchestrates domain entities and infrastructure adapters to execute application use cases.
- **Domain (`modules/*/domain/`)**:
  - Pure, framework-agnostic models, invariants, and policy predicates.
  - **Strict rule**: Zero imports of React, Next.js, browser APIs, Drizzle, Gemini SDK, AWS/S3 SDK, telemetry, or `fetch`. Domain never depends on Infrastructure.
- **Infrastructure (`modules/*/infrastructure/`, `lib/`)**:
  - Implements persistence, storage, AI SDK communication, and external integrations.
  - Depends inward on Application and Domain interfaces; must never leak technical ORM or storage mechanics into UI components.

### Automated Architecture Guardrails (Issue #86)

Before finishing any architecture-sensitive task, run the canonical boundary checker:

```bash
bun run check:architecture
```

Enforced boundaries:

- **Domain Purity**: `modules/*/domain/**` must never import React, Next.js, database/ORM (`drizzle-orm`, `lib/db`), storage (`lib/storage`, `@aws-sdk`), AI models (`lib/gemini`, `@google/genai`), UI, or infrastructure adapters.
- **UI Infrastructure Isolation**: Cleaned UI surfaces (`components/speaking`, `components/homework`, `components/classroom`, and cleaned pilot protected routes in `app/(protected)`) must not import database, storage, Gemini evaluators, or infrastructure repositories. (Single documented exception: `components/speaking/live/live-speaking-examiner-room.tsx` importing `speaking-practice-browser-adapter`).
- **Anti-Laundering Re-export Rule**: Application modules (`modules/*/application/**`) may import infrastructure internally for use-case orchestration, but must **never re-export** infrastructure implementations (`export { ... } from "../infrastructure/..."`) to serve as proxies for UI or domain.
- **Route Handler Hygiene**: API route handlers (`app/api/**`) must not import React or UI components.

### Canonical Domain Vocabulary & Invariants

Preserve canonical domain language and distinctions across all tasks:

- **Spelling**: Always use `IeltsRubric`, never `IELTSRubric`.
- **Domain Distinctions**:
  - `SpeakingPractice != MockTest`: Practice is learner-initiated coaching; MockTest is timed exam simulation.
  - `SpeakingPractice != HomeworkSubmission`: Practice is private learner activity; HomeworkSubmission is assigned work evaluated under teacher review.
  - `PracticeFeedback != AiAssessmentProposal`: PracticeFeedback is learner-facing unofficial coaching; AiAssessmentProposal is non-authoritative suggestion strictly for teacher review.
  - `AiAssessmentProposal != TeacherAssessment`: AI suggestions vs authoritative teacher evaluations.
  - `TeacherAssessment != PublishedAssessment`: Teacher evaluation draft vs official published grade visible to learner.
  - `PracticeEvaluation != HomeworkEvaluation`: Separate evaluation aggregate roots.
  - `PracticeEnded != PracticeEvaluated`: Practice ending successfully is decoupled from AI evaluation completion. Evaluation failure never invalidates an ended `SpeakingPractice`.
  - `OriginalAudio` is authoritative evidence; transcript is derived evidence.
  - **Atomic Publish**: MVP Homework publish is a single atomic action: finalizing `TeacherAssessment` and creating official `PublishedAssessment` happen together (`Publish = Finalize + MakeOfficial`).
  - **No Generic Abstractions**: Do not introduce generic `Session`, `Assessment`, `EvaluationResult`, or generic service/repository base classes that erase these distinctions.

### Pre-Change UI Component Checklist

Before modifying or creating any React component handling Speaking or Homework state, verify:

1. [ ] Does this component only render presentation state and forward user intent?
2. [ ] Are lifecycle transitions, retry eligibility, and business validity computed by pure domain/application modules?
3. [ ] Does the UI avoid inspecting raw database fields/strings to infer domain status?
4. [ ] Does the code use canonical terms (`SpeakingPractice`, `PracticeFeedback`, `IeltsRubric`) without generic abstractions?
5. [ ] Is the component free of backend ORM, storage, AI SDK, or database mechanics?

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
