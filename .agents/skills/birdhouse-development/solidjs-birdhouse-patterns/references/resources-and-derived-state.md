# Resources And Derived State

Load this reference when changing `createResource`, derived values, or signal and prop usage in Birdhouse frontend code.

## Guard `resource.error` Before Reading `resource()`

- Check `resource.error` before calling `resource()` in effects and memos.
- Remember that reading `resource()` while the resource is in an error state throws.
- Use metadata reads such as `resource.loading`, `resource.error`, and `resource.state` freely.

Do this:

```ts
createEffect(() => {
  if (config.error) return
  const value = config()
  if (value) {
    applyConfig(value)
  }
})

const field = createMemo(() => {
  if (config.error) return undefined
  return config()?.field
})
```

Do not do this:

```ts
createEffect(() => {
  const value = config()
  if (value) {
    applyConfig(value)
  }
})
```

Follow the guarded pattern in `projects/birdhouse/frontend/src/workspace-config/components/WorkspaceConfigDialog.tsx`.

## Use `createResource` Storage To Avoid Loading Flash

- Use the `storage` option when keeping the previous successful value visible improves the UX.
- Reach for this when switching inputs would otherwise cause content flicker.
- Prefer this over showing a full loading fallback if the previous data is still useful.

Follow the pattern in `projects/birdhouse/frontend/src/demos/CodeBlockDemo/index.tsx`.

Example shape:

```ts
const [data] = createResource(source, fetcher, {
  storage: (init) => {
    const [value, setValue] = createSignal(init)
    return [value, (next) => next && setValue(next)]
  },
})
```

## Prefer `createMemo` For Reused Derived Values

- Use a memo when a derived value is expensive or reused multiple times in render.
- Leave a plain function when the computation is cheap and single-use.
- Review code that repeatedly recomputes filters, mappings, or selection lookups during render.

Check `projects/birdhouse/frontend/src/components/ui/Combobox.tsx` when judging whether a repeated derived computation should become a memo.

## Be Intentional About Signals Vs Prop Values

- Pass an accessor when the child should stay reactive to the signal itself.
- Pass the current value when the child is controlled by the parent and only needs the current snapshot through normal rerendering semantics.
- Match the receiving component's API instead of following one blanket rule.

## Do Not Create Effects In Loops Or Conditionals By Accident

- Put the loop inside one tracked owner instead of creating many effects ad hoc.
- Create additional owners only when the design truly needs per-item ownership.

Preferred shape:

```ts
createEffect(() => {
  for (const item of items()) {
    process(item)
  }
})
```

## Do Not Mutate Signal-Held Objects Directly

- Write a new object through the setter.
- Use a store when the state shape makes store updates the clearer choice.

Do this:

```ts
setState({ count: state().count + 1 })
```

Do not do this:

```ts
state().count++
```

## Use Codebase Examples First

- `projects/birdhouse/frontend/src/demos/CodeBlockDemo/index.tsx` for resource storage.
- `projects/birdhouse/frontend/src/workspace-config/components/WorkspaceConfigDialog.tsx` for guarded resource reads.
- `projects/birdhouse/frontend/src/components/ui/Combobox.tsx` for component-level reactive patterns and cleanup.

## Notes

- Birdhouse tests are sensitive to unhandled resource errors. Guarded resource access prevents cryptic failures and lets components render error UI normally.
