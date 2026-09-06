# Architecture & Dependency Boundaries

This document defines layer responsibilities, dependency rules, and automated boundary enforcement for the repository.

## Dependency Direction

Unambiguous inward dependency direction towards the domain (zero outward dependencies from domain):

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

---

## Layer Responsibilities

### Presentation (`app/`, `components/`)

- **Permitted**: Ephemeral presentation concerns (open/closed dialogs, active tab selection, temporary form input state, animation, visual formatting) and emitting user intent to application use cases or API routes.
- **Forbidden**: Deciding domain lifecycle transitions (e.g. `in_progress` -> `completed`), evaluating retry eligibility, enforcing aggregate invariants, interpreting assessment state semantics, or inspecting raw database fields/strings to infer domain status.
- **Prohibition on Fake Decoupling**: Do not attempt to solve domain leakage by moving domain logic into a React hook or utility that still manipulates React state setters. Domain/application seams must return meaningful domain results for UI to render.

### Route Handlers (`app/api/`)

- **Permitted**: Authenticating sessions, parsing/validating HTTP request payloads, mapping transport data, and delegating to application use cases.
- **Forbidden**: Housing business lifecycle transitions, retry policies, or domain invariants directly inside route handlers. Route handlers must never import React or UI components.

### Application (`modules/*/application/`)

- Orchestrates domain entities and infrastructure adapters to execute application use cases.
- **Anti-Laundering Re-export Rule**: Application modules may import infrastructure internally for use-case orchestration, but must **never re-export** infrastructure implementations (`export { ... } from "../infrastructure/..."`) to serve as proxies for UI or domain.

### Domain (`modules/*/domain/`)

- Pure, framework-agnostic models, invariants, and policy predicates.
- **Strict rule**: Zero imports of React, Next.js, browser APIs, Drizzle, Gemini SDK, AWS/S3 SDK, telemetry, or `fetch`. Domain never depends on Infrastructure.

### Infrastructure (`modules/*/infrastructure/`, `lib/`)

- Implements persistence, storage, AI SDK communication, and external integrations.
- Depends inward on Application and Domain interfaces; must never leak technical ORM or storage mechanics into UI components.

---

## Automated Architecture Guardrails (Issue #86)

Before finishing any architecture-sensitive task, run the canonical boundary checker:

```bash
bun run check:architecture
```

Enforced boundaries in `scripts/check-architecture.ts`:

1. **Domain Purity**: `modules/*/domain/**` must never import React, Next.js, database/ORM (`drizzle-orm`, `lib/db`), storage (`lib/storage`, `@aws-sdk`), AI models (`lib/gemini`, `@google/genai`), UI, or infrastructure adapters.
2. **UI Infrastructure Isolation**: Cleaned UI surfaces (`components/speaking`, `components/homework`, `components/classroom`, and cleaned pilot protected routes in `app/(protected)`) must not import database, storage, Gemini evaluators, or infrastructure repositories. (Single documented exception: `components/speaking/live/live-speaking-examiner-room.tsx` importing `speaking-practice-browser-adapter`).
3. **Application Anti-Laundering Re-export Rule**: Application modules (`modules/*/application/**`) may import infrastructure internally for use-case orchestration, but must **never re-export** infrastructure implementations to bypass UI boundary checks.
4. **Route Handler Hygiene**: API route handlers (`app/api/**`) must not import React, UI components, or application pages/views.
