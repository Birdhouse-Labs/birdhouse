# Reactivity Pitfalls

Load this reference when rendering nested component hierarchies from reactive state, or when registering document-level event listeners inside effects.

## Recursive JSX Must Use A Component Boundary Per Level

Solid preserves component instances across re-renders only at component boundaries or via keyed list primitives like `<For>`. A plain recursive function that returns JSX inside a reactive render scope is treated as one atomic expression — any state change rebuilds the entire branch from the top.

This matters whenever the tree is reactive and you want ancestors to survive when deeper levels change — stacked modals, nested menu chains, recursive tree views.

Use a real recursive component:

```tsx
// ✅ Ancestors preserved; only new leaves mount when the stack grows
interface StackNodeProps {
  stack: Accessor<Modal[]>;
  index: number;
}

const StackNode: Component<StackNodeProps> = (props) => {
  const modal = createMemo(() => props.stack()[props.index]);

  return (
    <Show when={modal()} keyed>
      {(current) => (
        <AgentModal agentId={current.id} ...>
          <StackNode stack={props.stack} index={props.index + 1} />
        </AgentModal>
      )}
    </Show>
  );
};

// Call site
<StackNode stack={agentModalStack} index={0} />
```

Do not use a plain recursive function:

```tsx
// ❌ Every stack change rebuilds the entire nested branch from the root
const renderStack = (index = 0): JSX.Element => {
  const modal = agentModalStack()[index];
  if (!modal) return null;
  return (
    <AgentModal agentId={modal.id} ...>
      {renderStack(index + 1)}
    </AgentModal>
  );
};

// Call site
{renderStack()}
```

Why:

- `renderStack()` runs inside a reactive expression. When `agentModalStack()` changes, the whole returned branch is recomputed.
- Without component boundaries, Solid has no instance identity to match against — the old `AgentModal` at index 0 gets disposed and a new one constructed, even though the modal at index 0 didn't change.
- Recursing through a component (`<StackNode ... />`) gives each level its own reactive scope. Changes at index 2 don't invalidate the components at indices 0 or 1.

Reference point: `projects/birdhouse/frontend/src/LiveApp.tsx` `AgentModalStackNode`, with a regression test in `projects/birdhouse/frontend/src/components/AgentModal.recursion.test.tsx` that proves plain recursive JSX remounts ancestors and a component boundary preserves them.

**Pass the backing state down as an accessor**, not a plain array. Each recursion level reads only the slot it needs (`props.stack()[props.index]`), so changes at unrelated indices don't re-run the component body.

## Document-Level Listeners Should Re-Check Their Guards At Event Time

When an effect registers a document listener based on a reactive guard, the effect re-runs and re-registers the listener whenever the guard changes — but **re-registration is not instantaneous**, and the old listener can fire one more time against a stale state. This is especially common when the guard depends on router state (`setSearchParams`, `useSearchParams`) that propagates asynchronously.

Re-check the guard inside the handler body:

```tsx
// ✅ Handler re-checks at event time; stale registration can't misfire
createEffect(() => {
  if (!shouldShow()) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (!isInteractive()) return; // re-checked on every key press
    if (openPopoverIndex() !== null) return;
    e.preventDefault();
    props.onClose();
  };

  document.addEventListener("keydown", handleKeyDown);
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
});
```

Do not rely on the effect's registration gate alone:

```tsx
// ❌ Stale listener can fire during the guard-flip window
createEffect(() => {
  if (!shouldShow() || !isInteractive()) return; // guard only at registration

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    // no re-check — trusts that the effect cleaned us up already
    e.preventDefault();
    props.onClose();
  };

  document.addEventListener("keydown", handleKeyDown);
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
});
```

Why the stale path fails:

- A signal change that should make the listener non-interactive is observed by the effect.
- The effect schedules cleanup and re-registration.
- If the triggering signal change was asynchronous (router, microtask), a keystroke landing in the transition window reaches the old listener before cleanup runs.
- The old handler body doesn't know the state has changed, so it acts on stale truth.

Any handler that calls `e.preventDefault()` during that window also has Corvu consequences — see `corvu-best-practices` primitive-gotchas for the `defaultPrevented` gate in `solid-dismissible`.

Reference point: `projects/birdhouse/frontend/src/components/ui/AgentTypeahead.tsx` Escape handler.

## Place `{props.children}` Inside Context Providers The Component Sets Up

A component that establishes a context Provider (z-index, theme, focus) and also accepts a `children` slot should render the slot **inside** the Provider, not as a sibling. Slot content outside the Provider falls back to default context values — which typically means defaults that aren't what the surrounding component intends.

```tsx
// ❌ children see the outer context (default z-index 50)
<ZIndexProvider baseZIndex={baseZIndex + 10}>
  <LiveMessages ... />
</ZIndexProvider>
{props.children}

// ✅ children inherit the elevated z-index
<ZIndexProvider baseZIndex={baseZIndex + 10}>
  <LiveMessages ... />
  {props.children}
</ZIndexProvider>
```

Only place `{props.children}` outside a Provider when the slot is **intentionally** meant to render in the outer scope — document this with a comment if so.

Reference point: `projects/birdhouse/frontend/src/components/AgentModal.tsx` renders `props.children` inside its `ZIndexProvider` so nested palette subdialogs inherit the elevated z-index.
