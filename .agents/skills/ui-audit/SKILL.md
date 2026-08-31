---
name: ui-audit
description: Audit and enforce UI/UX consistency, spacing ratios, typography hierarchy, and layout container patterns. Use whenever creating or modifying React UI components, styling layouts with Tailwind CSS, or before declaring frontend work complete.
---

# UI/UX Consistency & Spacing Audit

This skill guides Agents to inspect, detect, and prevent visual bugs, spacing flaws, double-padding antipatterns, and typography inconsistencies across the application.

## 1. Core Layout Antipatterns to Detect

### A. The "Displaced Header" & Double-Padding Card Antipattern

In this design system, shadcn/Base UI's [`Card`](components/ui/card.tsx) applies default internal padding and gap:

```css
py-(--card-spacing) gap-(--card-spacing) /* Default: 16px (py-4 gap-4) */
```

- **The Bug**: When a `<CardHeader>` has a colored background (e.g. `bg-amber-500/10`), a top border, or a divider line `border-b`, the parent `<Card>`'s `py-4` pushes the header down by 16px. This creates an awkward floating colored box with green padding above it instead of flush-top edges.
- **The Mandatory Rule**:
  Whenever `<Card>` contains a `<CardHeader>` with `border-b`, `bg-*`, or custom inset styling, **`<Card>` MUST explicitly declare `py-0 gap-0`**:
  ```tsx
  // ❌ BAD: CardHeader is pushed down by 16px, leaving an unintended gap at top
  <Card className="border shadow-xs overflow-hidden">
    <CardHeader className="p-4 border-b bg-emerald-500/10">...</CardHeader>
    <CardContent className="p-4">...</CardContent>
  </Card>

  // ✅ GOOD: Header is flush-top with rounded corners, content has proper internal padding
  <Card className="border shadow-xs overflow-hidden py-0 gap-0">
    <CardHeader className="p-4 border-b bg-emerald-500/10">...</CardHeader>
    <CardContent className="p-4">...</CardContent>
  </Card>
  ```

### B. Nested Padding Bloat (Double Gutters)

- Do NOT nest containers that each apply `p-4` or `p-6` without an intentional inset reason.
- If a card body has `CardContent className="p-4"`, children should use `space-y-3` or `gap-3`, not wrap each section in another full-padding wrapper.

### C. Grid Equal Heights & Card Vertical Rhythm

- In multi-column card grids (e.g., `grid grid-cols-1 md:grid-cols-2 gap-4`), cards in the same row often have uneven content lengths.
- Add `h-full flex flex-col justify-between` to cards so sibling cards align cleanly on the bottom border.

---

## 2. Design Tokens Reference

### Spacing Scale (Strict Tailwind 4)

Always stick to the project's standard 4px/8px rhythm scale:

- `0`: 0px
- `1`: 4px (tight inline gaps, badges)
- `1.5`: 6px (icon-to-label gaps)
- `2`: 8px (small element spacing)
- `3`: 12px (badge internal padding, compact card gap)
- `4`: 16px (standard card padding, grid gap)
- `6`: 24px (section padding)
- `8`: 32px (container spacing)
- **BANNED**: Arbitrary pixel spacing like `p-[13px]`, `m-[7px]`, `gap-[18px]`.

### Typography Hierarchy Scale

- **Display / Page Title**: `text-xl font-bold text-foreground` or `text-2xl font-bold`
- **Section Heading**: `text-base font-bold text-foreground`
- **Card Title / Subsection**: `text-sm font-bold text-foreground`
- **Body Content**: `text-xs text-foreground/90 leading-relaxed`
- **Muted Helper / Subtitles**: `text-xs text-muted-foreground`
- **Micro Labels / Badges / Code**: `text-[10px]` or `text-[11px] font-mono font-medium`

### Accessibility Contrast Rules (Axe Core AA)

- Badge text on tinted background: Never use `text-muted-foreground` inside `bg-*-500/5`. Use `text-foreground/80` or `text-*-800 dark:text-*-300`.
- White text on colored pills: Use `700` or `800` shade (`bg-emerald-700`, `bg-blue-700`, `bg-amber-800`, `bg-purple-700`), NOT `600` or `500` which fail 4.5:1 ratio against white.

---

## 3. Agent Verification Checklist

Whenever you modify or generate UI code, complete this checklist before finishing:

1. [ ] **Card Flushness**: Did you check all `<Card>` components that have headers or colored bars for `py-0 gap-0`?
2. [ ] **Equal Heights**: Are cards in grids using `h-full` to prevent staggered card bottoms?
3. [ ] **Standard Spacing**: Are all padding/margins using tokens from the standard scale (2, 3, 4, 6, 8)?
4. [ ] **Automated Script Check**: Run `bun run audit:ui` to scan for layout antipatterns.
5. [ ] **Storybook & A11y Verification**: Run `bun run test:storybook <file>` to verify interaction and 0 Axe violations.
