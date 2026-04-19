# Solid Patterns In Birdhouse

Load this reference when writing SolidJS code in the Birdhouse frontend that involves recursive component trees, document-level event handlers, context Providers around `children` slots, or CSS animations that must survive component recreation.

Ground first on `solidjs-best-practices`. This file documents how Birdhouse applies those rules, with code pointers.

## Recursive Component Trees

Generic rule lives in `solidjs-best-practices` (recursive trees need a component boundary per level).

Birdhouse applications:

- **`AgentModalStackNode`** in `projects/birdhouse/frontend/src/LiveApp.tsx` — renders the agent modal stack by recursion. Each level is a component instance with its own reactive scope. Changing deeper indices does not invalidate shallower ancestors.
- **Regression test:** `projects/birdhouse/frontend/src/components/AgentModal.recursion.test.tsx` isolates the Solid behavior in three cases: plain recursive function (remounts ancestors — bad), sibling `<For>` (preserves — old pattern), recursive component (preserves — new pattern).

When adding a new stacked UI (breadcrumb navigation, nested menu chains, tree views from reactive state), reach for a recursive component, not a recursive function.

## Document-Level Listeners Re-Check Guards At Event Time

Generic rule lives in `solidjs-best-practices` (re-check reactive guards inside event handlers).

Birdhouse applications:

- **`AgentTypeahead`** Escape handler in `projects/birdhouse/frontend/src/components/ui/AgentTypeahead.tsx` — the listener is registered while `shouldShow()` is true, but re-checks `isInteractive()` and `openPopoverIndex()` inside the handler body. This prevents a stale listener firing during the router-driven peek handoff window from calling `preventDefault()` and silently blocking Corvu's dismissal.
- **Regression test:** `AgentTypeahead.test.tsx` covers the stale-listener case explicitly.

When registering a new document-level listener from an effect: always re-check the same reactive guards inside the handler. Any `preventDefault()` call during a stale window has downstream consequences for Corvu (see `references/corvu-patterns.md`).

## `{props.children}` Inside Context Providers

Generic rule lives in `solidjs-best-practices` (place `{props.children}` inside context Providers the component sets up).

Birdhouse application:

- **`AgentModal`** in `projects/birdhouse/frontend/src/components/AgentModal.tsx` wraps `LiveMessages` in `<ZIndexProvider baseZIndex={baseZIndex + 10}>`. `{props.children}` renders **inside** the Provider so nested palette subdialogs inherit the elevated z-index.

The regression: prior to this fix, palette subdialogs rendered behind the agent modal because `{props.children}` was outside the Provider and `useZIndex()` fell back to the default 50.

When writing a wrapper component that accepts `children` and establishes a Provider: always render `{props.children}` inside the Provider unless the outer scope is intentional.

## Animation Timestamps For Component Recreation

CSS animations restart when components recreate. Birdhouse's recursive and keyed rendering patterns (`<Show keyed>`, virtualized lists, tree mutations) can recreate components mid-animation. To survive recreation, store animation start timestamps instead of boolean state and use negative `animation-delay` to skip ahead.

```ts
// ❌ Boolean state — recreation resets animation
const [focused, setFocused] = createSignal<Set<string>>(new Set())
isFocused={focused().has(id)}

// ✅ Timestamp state — recreation preserves the elapsed animation
const [animations, setAnimations] = createSignal<Map<string, number>>(new Map())
animationStart={animations().get(id)}
```

Implementation:

1. Store a timestamp when the animation starts:

```ts
const startAnimation = (id: string) => {
  setAnimations((prev) => {
    const next = new Map(prev)
    next.set(id, Date.now())
    return next
  })
}
```

2. Compute elapsed time in the animated component:

```ts
const animationDelay = createMemo(() => {
  if (props.animationStart == null) return undefined
  const elapsed = Date.now() - props.animationStart
  if (elapsed >= 5000) return undefined // animation complete
  return `-${elapsed}ms` // negative delay skips ahead
})
```

3. Apply the delay to the element:

```tsx
<div
  classList={{ "animate-fade": props.animationStart !== undefined }}
  style={{ "animation-delay": animationDelay() }}
/>
```

Why it works:

- Component recreates, but timestamps live in a separate signal outside the recreated tree
- Negative `animation-delay` tells CSS to start partway through
- The browser continues the animation from the current position — no visible restart

When to use:

- Animations that must survive component recreation
- Virtualized lists with `<Show keyed>` or similar
- Tree or list mutations during animations

Example: `projects/birdhouse/frontend/src/demos/TreeViewDemo.tsx` (focus ring animation).
