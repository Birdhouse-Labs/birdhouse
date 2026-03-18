---
name: animation-timestamps
description: Prevents CSS animations from restarting when SolidJS components recreate by storing timestamps and using negative animation-delay to skip ahead.
trigger_phrases:
  - animation timestamps
  - preserve animations
  - solidjs animation restart
  - component recreation animation
  - css animation survival
---

# Animation Timestamps for Component Recreation

## Problem

CSS animations restart when components recreate. In SolidJS with `<Show keyed>`, tree mutations cause component recreation, restarting all animations.

## Solution

Store animation start timestamps instead of boolean state.

```typescript
// BAD: Boolean state
const [focused, setFocused] = createSignal<Set<string>>(new Set());
isFocused={focused().has(id)}

// GOOD: Timestamp state
const [animations, setAnimations] = createSignal<Map<string, number>>(new Map());
animationStart={animations().get(id)}
```

## Implementation

1. Store timestamp on animation start:

```typescript
const startAnimation = (id: string) => {
  setAnimations(prev => {
    const next = new Map(prev);
    next.set(id, Date.now());
    return next;
  });
};
```

2. Calculate elapsed time in the component:

```typescript
const animationDelay = createMemo(() => {
  if (!props.animationStart) return undefined;
  const elapsed = Date.now() - props.animationStart;
  if (elapsed >= 5000) return undefined; // Animation complete
  return `-${elapsed}ms`; // Negative delay = skip ahead
});
```

3. Apply to the element:

```typescript
<div
  classList={{ "animate-fade": props.animationStart !== undefined }}
  style={{ "animation-delay": animationDelay() }}
>
```

## Why It Works

- Component recreates -> timestamps preserved in separate signal
- Negative `animation-delay` tells CSS to start partway through
- Browser continues animation from the current position
- No visible restart even with DOM recreation

## When To Use

- Animations that must survive component recreation
- Virtualized lists with `keyed` components
- Tree or list mutations during animations
- Any scenario where state mutations cause re-renders

## Example

See `frontend/src/demos/TreeViewDemo.tsx` (focus ring animation)
