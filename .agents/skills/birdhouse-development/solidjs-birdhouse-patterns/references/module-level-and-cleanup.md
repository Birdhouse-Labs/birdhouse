# Module-Level And Cleanup Patterns

Load this reference when work touches module-level reactive state, event listeners, subscriptions, or cleanup logic in Birdhouse SolidJS code.

## Wrap Module-Level Reactivity In One `createRoot`

- Use a single `createRoot` when a module needs signals, memos, or effects outside a component.
- Export the values created inside that root.
- Export the disposer returned by `createRoot` when the module needs explicit teardown.
- Group related module-level computations under the same root.

Follow the pattern in `projects/birdhouse/frontend/src/theme/context.ts`.

Use this shape:

```ts
let derivedValue: ReturnType<typeof createMemo<string>>

export const disposeSomething = createRoot((dispose) => {
  derivedValue = createMemo(() => {
    return computeSomething()
  })

  createEffect(() => {
    syncSomething(derivedValue())
  })

  onCleanup(() => {
    teardownSomething()
  })

  return dispose
})

export { derivedValue }
```

Why this matters:

- Avoids "computations created outside a createRoot" warnings.
- Prevents leaking subscriptions or listeners.
- Makes module lifecycle explicit.

## Keep Cleanup Beside Setup

- Register cleanup in the same owner that created the resource.
- Add `onCleanup` right next to the listener, timer, observer, or subscription.
- Do not leave teardown to distant code unless ownership is intentionally centralized.

Follow these code examples:

- `projects/birdhouse/frontend/src/theme/context.ts`
- `projects/birdhouse/frontend/src/components/ui/Combobox.tsx`

Example shape:

```ts
createEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  const handleChange = () => {
    // sync theme
  }

  mediaQuery.addEventListener('change', handleChange)

  onCleanup(() => {
    mediaQuery.removeEventListener('change', handleChange)
  })
})
```

## Avoid Scattered Ownership

- Do not create several unrelated module-level roots when one root owns the same concern.
- Do not create listeners at module scope without a matching cleanup path.
- Do not split setup and cleanup across separate files unless the abstraction is already established and clear.

## Effects In Birdhouse Frontend

- Use effects to synchronize with browser APIs and imperative integrations.
- Keep pure derivation out of effects.
- Move repeated derived calculations into memos when they are used in several places.

## Use Nearby Examples Before Inventing New Structure

- For module-level reactivity, check `projects/birdhouse/frontend/src/theme/context.ts` first.
- For event-listener cleanup inside components, check `projects/birdhouse/frontend/src/components/ui/Combobox.tsx` first.

## Notes

- This repo already has working patterns for long-lived theme state and component-level teardown. Match them before introducing new ownership models.
