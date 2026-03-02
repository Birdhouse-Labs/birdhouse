# Container Styles Usage Examples

This document shows how to use the minimal shared styling tokens.

## Philosophy

**Only share what changes for the same reasons.**

These are **styling tokens**, not layout abstractions. They capture:
- What makes a card visually feel like a card (surface identity)
- NOT layout concerns (padding, flex direction, spacing)

The litmus test: "If rebranding tomorrow, what would you search-and-replace?"

## The Tokens

```typescript
// The card surface identity - background, border, shadow
export const cardSurface = "bg-surface-raised border border-border shadow-lg";
export const cardSurfaceFlat = "bg-surface-raised border border-border";

// Just the border color for dividers
export const borderColor = "border-border";
```

## Usage Examples

### Before (hardcoded):
```tsx
// CheckboxDemo.tsx
<div class="px-4 py-3 border-b bg-surface-raised border-border flex items-center justify-between">

// MessageBubble.tsx  
<div class="rounded-2xl shadow-lg bg-surface-raised border border-border">

// TreeView section
<div class="py-2 px-3 bg-surface-overlay border-b border-border-muted">
```

### After (minimal tokens):
```tsx
import { cardSurface, cardSurfaceFlat, borderColor } from "../styles/containerStyles";

// CheckboxDemo.tsx - controls its own padding and layout
<div class={`px-4 py-3 border-b ${borderColor} ${cardSurfaceFlat} flex items-center justify-between`}>

// MessageBubble.tsx - controls its own border radius
<div class={`rounded-2xl ${cardSurface}`}>

// TreeView section - different surface, shares border color
<div class={`py-2 px-3 border-b border-border-muted bg-surface-overlay`}>
```

## Why This Is Minimal

1. ✅ **Only 3 exports** - Not 20 variants
2. ✅ **Each is atomic** - Represents ONE concern (surface identity)
3. ✅ **Components control layout** - Padding, flex, spacing stays local
4. ✅ **Clear what changes together** - Rebrand? Update these 3 tokens
5. ✅ **No over-abstraction** - `bg-surface` stays as-is (no wrapper variable)

## Migration Strategy (Optional)

This is not a migration requirement - these tokens are available if/when you want to use them:

1. When touching a component, consider if it uses card surfaces
2. Replace hardcoded surface identity with tokens
3. Keep all layout concerns (padding, flex, etc.) as-is

No need to migrate everything at once. Let usage drive adoption.

## Real-World Examples

### Demo Pages (when migrated)

**Before:**
```tsx
<div class="flex flex-col h-full bg-surface">
  <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
    <h2>Checkbox</h2>
  </div>
  <div class="flex-1 overflow-y-auto p-8">
```

**After:**
```tsx
import { cardSurfaceFlat, borderColor } from "../styles/containerStyles";

<div class="flex flex-col h-full bg-surface">
  <div class={`px-4 py-3 border-b ${borderColor} ${cardSurfaceFlat} flex items-center justify-between`}>
    <h2>Checkbox</h2>
  </div>
  <div class="flex-1 overflow-y-auto p-8">
```

**What changed:** Only the surface identity. Layout stays in component control.

### Message Bubbles (when migrated)

**Before:**
```tsx
<div class="rounded-2xl shadow-lg bg-surface-raised border border-border p-4">
```

**After:**
```tsx
import { cardSurface } from "../styles/containerStyles";

<div class={`rounded-2xl ${cardSurface} p-4`}>
```

### TreeView Sections (when migrated)

**Before:**
```tsx
<div class="py-2 px-3 bg-surface-overlay border-b border-border-muted text-sm">
```

**After:**
```tsx
import { borderColor } from "../styles/containerStyles";

// TreeView uses different surface (bg-surface-overlay), but could share border color
<div class={`py-2 px-3 bg-surface-overlay border-b border-border-muted text-sm`}>
// OR if we want to share border-muted:
<div class="py-2 px-3 bg-surface-overlay border-b border-border-muted text-sm">
```

**Note:** TreeView sections might not need these tokens - they use a different surface color (overlay vs raised).

## When to Use / Not Use

**DO use when:**
- Styling a card-like surface (panels, dialogs, messages)
- Adding dividers that should match the design system
- Want rebrand changes to propagate automatically

**DON'T use when:**
- Component uses different backgrounds (not card surfaces)
- One-off special styling
- Not worth the import for a single usage

**Key insight:** These are opt-in convenience tokens, not mandatory abstractions.
