# Theme System Integration

This guide covers how to properly integrate with the CSS variable-based theme system. Read this when adding new components or styling.

---

## Overview

The app uses a **CSS variable-based multi-theme system** where:
- Themes are defined as CSS custom properties (`--theme-*`)
- Variables are wired to Tailwind utilities (`bg-surface`, `text-primary`)
- Components use **semantic class names**, not hard-coded colors
- Dark/light mode switches automatically via theme selection

**Full details:** See `/docs/theming.md`

---

## ✅ Correct Patterns

### Use Semantic Tailwind Classes

**✅ Example to follow:** `src/components/ui/Combobox.tsx:281`

```tsx
<input 
  class="bg-surface-overlay border-border text-text-primary 
         placeholder:text-text-muted focus:border-accent"
/>
```

**Available semantic classes:**
- **Surfaces**: `bg-surface`, `bg-surface-raised`, `bg-surface-overlay`, `bg-surface-inset`
- **Text**: `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-text-on-accent`
- **Borders**: `border-border`, `border-border-muted`
- **Accents**: `bg-accent`, `text-accent`, `border-accent`
- **Gradients**: `from-gradient-from`, `via-gradient-via`, `to-gradient-to`

**Why:** These classes work across ALL themes automatically.

---

### Use Opacity Modifiers for Subtle Backgrounds

**✅ Example to follow:** `src/components/ui/Combobox.tsx:328`

```tsx
classList={{
  "bg-gradient-from/30 text-text-primary": isHighlighted,
}}
```

**Pattern:** Use theme color with opacity (`/30`, `/50`, etc.) for:
- Hover states
- Selection highlights  
- Disabled states

**Why:** Maintains theme color while ensuring text contrast.

---

### Support All Themes Automatically

**✅ Example to follow:** `src/components/ui/Combobox.tsx` (entire file)

The Combobox works with all 6 base themes and both light/dark modes because it:
- Uses only semantic class names (no hard-coded colors)
- Uses theme variables for all colors
- Doesn't make assumptions about specific color values

**Test your component:**
1. Try all 6 base themes (Purple Dream, Forest Depths, etc.)
2. Try light and dark modes
3. Verify text is readable in all combinations

---

## ❌ Common Mistakes

### Don't Hard-Code Colors

**❌ Wrong:**
```tsx
<div class="bg-purple-600 text-white">  // Breaks on non-purple themes!
```

**✅ Right:**
```tsx
<div class="bg-accent text-text-on-accent">  // Works everywhere
```

---

### Don't Use Arbitrary Values for Theme Colors

**❌ Wrong:**
```tsx
<div class="bg-[#9333ea]">  // Hard-coded purple
```

**✅ Right:**
```tsx
<div class="bg-gradient-from">  // Uses theme's gradient color
```

**Exception:** Arbitrary values are OK for **layout** (spacing, sizing), just not colors.

---

### Don't Mix Old and New Patterns

The codebase is migrating from individual class props to Tailwind classes. Follow the new pattern:

**❌ Old pattern:**
```tsx
<div className={styles.card}>  // CSS modules
```

**✅ New pattern:**
```tsx
<div class="rounded-lg border bg-surface-overlay border-border">  // Tailwind + theme vars
```

---

## Theme-Aware Components

### Accept Custom Classes for Flexibility

**✅ Example to follow:** `src/components/ui/Combobox.tsx:31-35`

```typescript
interface ComponentProps {
  class?: string;          // Container class
  inputClass?: string;     // Specific element classes
  dropdownClass?: string;
}
```

This lets consumers:
- Add custom spacing/layout classes
- Override specific parts while keeping theme integration
- Compose with other components

---

## Testing Themes

When you add theme-dependent code, verify:

1. **Run theme linter:** `bun run lint:css`
2. **Check all themes:** Manually test with each base theme
3. **Check both modes:** Test light and dark
4. **Check contrast:** Text should be readable everywhere

---

## Quick Reference

| Need | Use | Example |
|------|-----|---------|
| Background | `bg-surface-*` | `src/components/ui/Combobox.tsx:309` |
| Text color | `text-text-*` | `src/components/ui/Combobox.tsx:346` |
| Borders | `border-border*` | `src/components/ui/Combobox.tsx:309` |
| Accent/brand color | `*-accent` or `*-gradient-*` | `src/components/ui/Combobox.tsx:281` |
| Hover/highlight | `bg-{color}/30` | `src/components/ui/Combobox.tsx:328` |

---

**See also:** `/docs/theming.md` for complete theme system architecture
