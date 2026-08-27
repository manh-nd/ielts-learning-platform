# ADR-0006: Design System Spacing Tokens, 4px Density Scale, and Shadcn Primitives Standardization

**Status:** Accepted  
**Date:** 2026-08-26  
**Target Module:** Design System, Tailwind Tokens, UI Primitives (`components/ui`), Business Module Layouts

---

## Context & Problem

As the IELTS Learning Platform expanded across multiple domains (Assessment, Teacher Review, Real-time Speaking, Writing Suite), frontend layout spacing and primitive usage became fragmented:

1. **Inconsistent & Arbitrary Spacing**: Arbitrary padding values such as `p-3.5` (14px) and `p-5` (20px) were scattered alongside standard `p-3` (12px), `p-4` (16px), and `p-6` (24px).
2. **Card Slot Spacing Overrides**: Multiple components directly overrode padding on `<CardHeader>` and `<CardContent>` (e.g., `<CardHeader className="p-3.5">`, `<CardContent className="p-5">`), bypassing shadcn Base UI's native symmetrical slot spacing tokens (`--card-spacing`).
3. **Ad-Hoc Callout Boxes**: Business modules (Writing, Speaking, Review) implemented custom alert containers using hardcoded utility classes (`bg-amber-50 border-amber-200`, `bg-rose-50 border-rose-200`, `bg-purple-50`) instead of a shared semantic `Alert` primitive.
4. **Missing Chat Component Stories**: Newly installed chat primitives (`message`, `bubble`, `marker`, `message-scroller`) lacked Storybook stories, interaction tests, and visual regression snapshot coverage.

---

## Decisions

### 1. Strict 4px Spacing Grid & 3 Density Tiers

We standardize all spacing across the platform to a strict **4px Tailwind grid**, categorizing layout components into three clear density tiers:

| Density Tier | Spacing Tokens              | Value | Permitted Scope                                                         |
| :----------- | :-------------------------- | :---- | :---------------------------------------------------------------------- |
| **Compact**  | `p-3`, `gap-3`, `space-y-3` | 12px  | Popover menus, tooltips, compact badge collections, nested mini cards   |
| **Standard** | `p-4`, `gap-4`, `space-y-4` | 16px  | Modal bodies, standard `CardContent`, form layouts, sidebar navigations |
| **Spacious** | `p-6`, `gap-6`, `space-y-6` | 24px  | Outer page containers, workspace grid splits, article prose padding     |

- **Banned Values**: All occurrences of `p-3.5`, `gap-3.5`, `px-3.5`, `py-3.5` (14px) are strictly forbidden.
- **Normalization of `p-5`**: All `p-5` (20px) instances must be normalized to `p-4` (standard card interior) or `p-6` (container padding).

### 2. Preservation of Shadcn Base UI Card Slot System

`Card` components manage layout spacing through CSS variables:

- Default: `[--card-spacing:--spacing(4)]` (16px standard).
- Small variant (`size="sm"`): `[--card-spacing:--spacing(3)]` (12px compact).

Developers and agents **must not** apply direct padding overrides (`p-*`, `px-*`, `py-*`) to `CardHeader`, `CardContent`, or `CardFooter`. Card padding must remain governed by `--card-spacing` to maintain visual symmetry across headers, bodies, and footers.

### 3. Shared Semantic `Alert` Primitive

All alert, callout, and diagnostic boxes must utilize the shared `<Alert>` primitive from `@/components/ui/alert` using semantic variants:

- `variant="default"` / `info`: Neutral context and informational notices.
- `variant="destructive"`: Form errors, submission failures, recording errors.
- `variant="warning"`: Practice test reminders, word count warnings, exam pacing alerts.
- `variant="success"`: Submission confirmations, score achievements.

Raw ad-hoc background colors (`bg-rose-50`, `bg-amber-50`, `bg-purple-50`) in business modules are replaced by semantic alert tokens.

### 4. Integration of Missing Core Primitives

We officially register and maintain the following primitives in `components/ui/`:

- `@shadcn/alert`: Semantic callout notifications.
- `@shadcn/scroll-area`: Accessible custom scrollable containers.
- `@shadcn/toggle-group`: Grouped multi-state selection buttons.
- `@shadcn/field` & `@shadcn/input-group`: Form field labeling and input addons.

### 5. Comprehensive Storybook & Visual Testing Coverage (#34)

All primitives in `components/ui/` must have:

1. Complete Storybook stories (`.stories.tsx`) covering primary states and variants.
2. Interaction tests utilizing `play` functions with `userEvent` and `expect` from `storybook/test`.
3. 100% strict accessibility compliance with zero Axe violations (`bun run test:storybook`).
4. Light and Dark mode visual regression snapshots (`playwright.visual.config.ts`).

---

## Consequences & Trade-offs

### Positive

- **Visual Harmony**: Consistent rhythm and predictable padding across all application workspaces and dialogs.
- **Design System Integrity**: Single source of truth for alerts, spacing tokens, and card compositions.
- **Agent Predictability**: AI agents generating or modifying UI components have explicit rules and no ambiguity on spacing scales.
- **Regression Resilience**: Automated visual tests and a11y tests immediately flag deviations from design standards.

### Operational Guidelines

- Any new component or pull request introducing `p-3.5` or non-standard padding will fail code review.
- Always use `bunx --bun shadcn@latest add <component>` to scaffold new primitives.
