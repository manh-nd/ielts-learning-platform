# Verification & Testing Policy

This document defines testing workflows, execution commands, and the risk-based verification lifecycle for the repository.

---

## Verification Lifecycle

```text
iterative development
  → targeted verification (exact test file paths, quiet-success output)

stable candidate
  → complete CI-equivalent gate once

if complete gate fails
  → targeted diagnosis/fix
  → targeted verification
  → new stable candidate
  → complete gate once again
```

The complete gate is run **once per stable candidate**, never repeated after each minor edit.

---

## Quiet-Success / Verbose-Failure Shell Pattern

High-output commands must avoid dumping hundreds of passing lines into agent context. Use this shell pattern for high-output checks:

```bash
if <command> >/tmp/check.log 2>&1; then
  echo "<command-name>: PASS"
else
  cat /tmp/check.log
  exit 1
fi
```

- **PASS**: Exposes only concise confirmation (`test:unit: PASS`, `test:storybook: PASS`, `test:visual: PASS`).
- **FAIL**: Dumps full diagnostic output needed to pinpoint and resolve the issue.

---

## Iterative Development Verification Matrix

> **Resolution Invariant**:
> Resolve exact existing test file paths from the changed code at task time.
> Never invent test paths or runner filters.

| Changed Surface                              | Targeted Verification Intent                         | Example Invocation Shape                                                      |
| :------------------------------------------- | :--------------------------------------------------- | :---------------------------------------------------------------------------- |
| **Domain entity / policy**                   | Run exact affected unit test file(s)                 | `bun test path/to/entity.test.ts`                                             |
| **Application use case**                     | Run exact affected application test file(s)          | `bun test path/to/use-case.test.ts`                                           |
| **Infrastructure adapter / DB**              | Run exact affected integration test file(s)          | `bun test path/to/repo.test.ts`                                               |
| **Audio pipeline / Recording**               | Run exact affected audio test file(s)                | `bun test path/to/audio.test.ts`                                              |
| **React Component / UI Story**               | Run affected story interaction test                  | `bunx vitest --project=storybook --run path/to/Component.stories.tsx`         |
| **Visual snapshot (isolated / local proxy)** | Run affected visual spec targeting component locally | `bunx playwright test -c playwright.visual.config.ts -g "<Pattern>"`          |
| **Architecture / import boundaries**         | Run architecture checker                             | `bun run check:architecture` (only when altering imports or layer boundaries) |
| **Type signatures**                          | Verify TypeScript compiler cleanly                   | `bun run typecheck`                                                           |
| **Lint / Formatting**                        | Verify syntax and formatting rules                   | `bun run lint` or `bun run format:check`                                      |

---

## Specialized Test Suites

### End-to-End Testing (Playwright)

- E2E tests are located in `e2e/` (`landing.spec.ts`, `auth.spec.ts`, `protected-routes.spec.ts`, `error-states.spec.ts`).
- Run unit tests: `bun run test` (excludes `e2e/`).
- In test environments, `ENABLE_E2E_MOCK_AUTH=true` enables mock session cookies (`e2e_mock_session`) so tests execute in ~7s without requiring an active PostgreSQL container.

### Storybook Interaction & Vitest Testing

- Headless execution: `bun run test:storybook` (`vitest --project=storybook --run`).
- Targeting a specific story: `bunx vitest --project=storybook --run path/to/Component.stories.tsx`.

### Visual Regression Testing (Playwright)

- Canonical CI command:
  ```bash
  bun run test:visual
  ```
  Runs Playwright inside the Linux Docker container `mcr.microsoft.com/playwright:v1.62.1-noble` against static Storybook build (`storybook-static`).
- Local proxy execution:
  ```bash
  bun run test:visual:local
  ```
  If Docker is unavailable in the local environment, `test:visual:local` may be run as a local proxy, with GitHub CI remaining authoritative. Local testing does not replace the canonical CI command.
- Updating snapshots:
  - Via Docker (matches CI): `bun run test:visual:update`
  - Locally: `bunx playwright test -c playwright.visual.config.ts --update-snapshots`

---

## Complete CI-Equivalent Final Gate (Mandatory for Stable Candidate)

Before pushing or considering a candidate stable, run the complete CI-equivalent set matching `.github/workflows/ci.yml` (`quality`, `storybook`, and `visual-regression`):

```bash
# 1. Quality Suite
bun run lint
bun run format:check
bun run typecheck
bun run check:architecture
if bun run test:unit >/tmp/unit.log 2>&1; then echo "test:unit: PASS"; else cat /tmp/unit.log; exit 1; fi
if bun run build >/tmp/build.log 2>&1; then echo "build: PASS"; else cat /tmp/build.log; exit 1; fi

# 2. Storybook Suite
if bun run test:storybook >/tmp/storybook.log 2>&1; then echo "test:storybook: PASS"; else cat /tmp/storybook.log; exit 1; fi
if bun run build-storybook >/tmp/storybook-build.log 2>&1; then echo "build-storybook: PASS"; else cat /tmp/storybook-build.log; exit 1; fi

# 3. Canonical CI Visual Regression Suite
if bun run test:visual >/tmp/visual.log 2>&1; then echo "test:visual: PASS"; else cat /tmp/visual.log; exit 1; fi
```
