<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Routing Table

Do not pre-read unrelated agent documentation. Load focused guidance only when relevant:

- **Domain / DDD / Ubiquitous Language**: `docs/agents/domain.md` (plus `CONTEXT.md` and `docs/adr/`)
- **Architecture / Layer Boundaries**: `docs/agents/architecture.md`
- **Verification / Testing Matrix / CI Gate**: `docs/agents/testing.md`
- **React / UI Checklist / Storybook Authoring**: `docs/agents/frontend.md`
- **Tiptap Rich Text Editor**: `.agents/skills/tiptap/SKILL.md`
- **GitHub Issues & PRs**: `docs/agents/issue-tracker.md`
- **Triage Labels**: `docs/agents/triage-labels.md`

## Precedence Order

When requirements, documentation, or code comments conflict, resolve ambiguity in this order:

1. **Latest Accepted ADR** (`docs/adr/`)
2. **`CONTEXT.md`** (ubiquitous language and aggregates)
3. **Current Implementation Contracts & Tests** (runtime behavior only)
4. **`PRD.md`** (vision only)

_(Details: `docs/agents/domain.md`)_

## Core Architecture Invariants

- **Dependency Direction**: UI (`app/`, `components/`) -> Application (`modules/*/application/`) -> Domain (`modules/*/domain/` [PURE CORE]). Infrastructure adapters (`modules/*/infrastructure/`, `lib/*`) depend inward on Application and Domain.
- **Domain Purity**: Zero imports of React, Next.js, database/ORM, storage, AI SDK, telemetry, or `fetch`. Domain never depends on Infrastructure.
- **Presentation State**: UI renders state and emits intent; never owns domain lifecycle transitions or evaluation policies.
- **Anti-Laundering**: Application modules orchestrate infrastructure internally, but must never re-export infrastructure implementations to bypass UI boundary checks.
- **Automated Check**: `bun run check:architecture` validates these boundaries (see `docs/agents/architecture.md`).

## Critical Domain Distinctions

Preserve canonical domain language and boundaries across all tasks (definitions in `CONTEXT.md`):

- `SpeakingPractice != MockTest`
- `SpeakingPractice != HomeworkSubmission`
- `PracticeFeedback != AiAssessmentProposal`
- `AiAssessmentProposal != TeacherAssessment`
- `TeacherAssessment != PublishedAssessment`
- `PracticeEvaluation != HomeworkEvaluation`
- `PracticeEnded != PracticeEvaluated`
- `OriginalAudio` is authoritative evidence; transcript and `ConversationReplay` are derived.
- **Atomic Publish**: MVP Homework publish is a single atomic action: finalizing `TeacherAssessment` and creating official `PublishedAssessment` happen together (`Publish = Finalize + MakeOfficial`).
- **No Generic Abstractions**: Do not introduce generic `Session`, `Assessment`, or `EvaluationResult` base classes.

## Naming Conventions

We follow the Google Style Guide rule: **"Treat abbreviations as words in identifiers"**:

- **PascalCase**: `AiAssessmentProposal`, `IeltsRubric`, `SttEngine`
- **camelCase**: `aiProposalScores`, `aiScore`, `audioUrl`
  _(Mechanical formatting and linting are enforced via `bun run lint` and `bun run format:check`)._

## Path Hygiene

Never expose machine-local absolute paths in committed docs, issues/PRs, or shareable artifacts. Use repository-relative paths.

## Verification Policy

- **Iterative development**: Run targeted test files only (exact test paths, quiet-success execution).
- **Stable candidate**: Run the complete CI-equivalent quality gate once before push (see `docs/agents/testing.md`).
