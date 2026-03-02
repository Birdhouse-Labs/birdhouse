# Animations in SolidJS

## TL;DR

For enter/exit animations on conditional rendering: **Use `solid-transition-group`**

## The Problem

SolidJS's `<Show>` immediately removes elements from the DOM when the condition becomes false. This makes exit animations impossible with CSS alone.

```tsx
// This can't animate out - element vanishes instantly
<Show when={isVisible()}>
  <div class="fade">Content</div>
</Show>
```

## The Solution

Use `solid-transition-group` to delay DOM removal until animations complete:

```tsx
import { Transition } from "solid-transition-group";

<Transition name="fade">
  <Show when={isVisible()}>
    <div>Content</div>
  </Show>
</Transition>
```

```css
/* CSS handles the actual animation */
.fade-enter-active, .fade-exit-active {
  transition: opacity 200ms ease-out;
}

.fade-enter, .fade-exit-to {
  opacity: 0;
}
```

## Example Implementation

See: `frontend/src/components/ConnectionStatusBanner.tsx`

The banner fades in/out smoothly when connection status changes, preventing jarring flashes during tab switches.

## Why This Library?

**Complexity:** Only 183 lines - it's a thin wrapper around `@solid-primitives/transition-group` that manages CSS class timing.

**Alternative would be worse:** Manual signal + effect timing is ~20 lines of imperative code with edge cases (race conditions, cleanup, etc).

**Standard solution:** This is the recommended approach in the SolidJS ecosystem.

## How It Works

1. When element appears: Adds enter classes → DOM renders → Transitions opacity → Removes enter classes
2. When element disappears: Adds exit classes → Transitions opacity → Removes from DOM

The timing is handled automatically by listening for `transitionend` and `animationend` events.

## References

- [solid-transition-group GitHub](https://github.com/solidjs-community/solid-transition-group)
- Package already in dependencies: `package.json`
