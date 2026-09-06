# Frontend & UI Component Guidelines

This document defines authoring guidelines, pre-change component validation, and UI tooling standards.

---

## Pre-Change UI Component Checklist

Before modifying or creating any React component handling Speaking or Homework state, verify:

1. [ ] Does this component only render presentation state and forward user intent?
2. [ ] Are lifecycle transitions, retry eligibility, and business validity computed by pure domain/application modules?
3. [ ] Does the UI avoid inspecting raw database fields/strings to infer domain status?
4. [ ] Does the code use canonical terms (`SpeakingPractice`, `PracticeFeedback`, `IeltsRubric`) without generic abstractions?
5. [ ] Is the component free of backend ORM, storage, AI SDK, or database mechanics?

---

## Storybook Component Authoring & Accessibility

We use **Storybook 10** (`@storybook/nextjs-vite` + `@storybook/addon-vitest`):

- **Story authoring**: Use imports from `storybook/test` (e.g. `expect`, `userEvent`, `within`, `fn`).
- **Accessibility validation**: Strictly enforced with zero violations:
  ```ts
  a11y: {
    test: "error";
  }
  ```
- **Story locations**: Colocate stories alongside components as `<ComponentName>.stories.tsx`.

_(For Storybook test execution commands and CI gates, see `docs/agents/testing.md`)_.

---

## Rich Text Editor (Tiptap)

For Tiptap work, read [`.agents/skills/tiptap/SKILL.md`](file:///Users/manh/workspace/ielts-learning-platform/.agents/skills/tiptap/SKILL.md).
Do not duplicate Tiptap implementation guidance here.
