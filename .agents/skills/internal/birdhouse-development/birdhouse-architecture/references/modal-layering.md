# Modal Layering

Load this reference when working on agent modals, the agent search dialog, command palette subdialogs, the `@@` typeahead, or any composition where one dialog opens above another.

Ground first on:
- `corvu-best-practices` primitive-gotchas Dialog section (nested dialogs, `defaultPrevented`)
- `solidjs-best-practices` recursive components and context Providers

## The Architecture In One Picture

The Birdhouse modal stack is driven by URL state (`useModalRoute`). Agent modals are rendered as a **recursive component tree** — each `AgentModalStackNode` renders an `AgentModal` whose `children` slot contains the next `AgentModalStackNode`. This gives Corvu a true parent-child dialog hierarchy and lets Solid preserve ancestor instances when a new modal is pushed.

Command palette agent-scoped subdialogs (notes, edit-title, archive, unarchive) render **inside** the target agent modal's JSX subtree. They are not rendered at the palette root. The target `agentId` is snapshotted at action time so the subdialog stays bound to the agent it was opened for, even if the modal stack changes.

Code pointers:

- `projects/birdhouse/frontend/src/LiveApp.tsx` — `AgentModalStackNode`, agent modal stack signal, `paletteAgentDialogRequest` state
- `projects/birdhouse/frontend/src/components/AgentModal.tsx` — `Dialog` wrapper, `ZIndexProvider`, `props.children` slot
- `projects/birdhouse/frontend/src/components/PaletteAgentSubdialogs.tsx` — discriminated-union request renderer
- `projects/birdhouse/frontend/src/components/CommandPalette.tsx` — action handlers that snapshot the target `agentId`

## Recursive Agent Modal Stack

Render the agent modal stack via a **component**, not a plain recursive function. This is a direct application of the rule in `solidjs-best-practices` (recursive trees need a component boundary per level). Getting this wrong re-mounts every ancestor modal whenever a new modal pushes, destroying scroll position and local state.

```tsx
interface AgentModalStackNodeProps {
  stack: Accessor<ModalState[]>
  index: number
  // ...
}

const AgentModalStackNode: Component<AgentModalStackNodeProps> = (props) => {
  const modal = createMemo(() => props.stack()[props.index])

  return (
    <Show when={modal()} keyed>
      {(current) => (
        <AgentModal
          agentId={current.id}
          navigationDepth={props.index + 1}
          isTop={props.index === props.stack().length - 1}
          // ...
        >
          <AgentModalStackNode stack={props.stack} index={props.index + 1} ... />
        </AgentModal>
      )}
    </Show>
  )
}
```

Regression test: `projects/birdhouse/frontend/src/components/AgentModal.recursion.test.tsx` proves a plain recursive function rebuilds ancestors and a component boundary preserves them.

## Z-Index And Children

`AgentModal` wraps its content in `<ZIndexProvider baseZIndex={baseZIndex + 10}>`. `{props.children}` **must render inside that Provider**, or child dialogs (palette subdialogs, any consumer of `useZIndex`) fall back to the default base and render behind the parent modal.

```tsx
// ✅ children inherit elevated z-index
<ZIndexProvider baseZIndex={baseZIndex + 10}>
  <LiveMessages ... />
  {props.children}
</ZIndexProvider>
```

This is the Birdhouse application of the generic rule in `solidjs-best-practices` (place `{props.children}` inside context Providers the component sets up).

## Command Palette Subdialog Nesting

Agent-scoped palette actions (Edit Notes, Edit Title, Archive, Unarchive) must render their subdialog inside the target agent modal's JSX tree. Rendering them at the palette root turns them into **sibling dialogs** to the agent modal stack — Corvu's dismissible-layer model then cannot distinguish "close notes" from "close agent modal," and one Escape dismisses both.

The correct architecture has three moving parts:

1. **Palette state lives in `LiveApp`, not `CommandPalette`.** `LiveApp` owns a `paletteAgentDialogRequest` signal. `CommandPalette` emits callbacks when the user picks an agent action; it does not render the subdialog itself.

2. **Subdialogs render inside the matching `AgentModalStackNode`.** When a node's modal `agentId` matches the request's snapshotted `agentId`, the node renders `<PaletteAgentSubdialogs>` inside its `AgentModal` JSX subtree.

3. **Subdialogs render at root when the target is the route agent.** If the target `agentId` is not in the modal stack, `LiveApp` renders `<PaletteAgentSubdialogs>` at root, targeting the route agent. Corvu treats it as the top dialog normally.

```tsx
// LiveApp.tsx
const [paletteAgentDialogRequest, setPaletteAgentDialogRequest] =
  createSignal<PaletteAgentDialogRequest | null>(null)

// ...

<AgentModalStackNode
  stack={agentModalStack}
  index={0}
  paletteAgentDialogRequest={paletteAgentDialogRequest}
  onPaletteAgentDialogRequestChange={setPaletteAgentDialogRequest}
  // ...
/>

<PaletteAgentSubdialogs
  request={routePaletteAgentDialogRequest()}
  workspaceId={workspaceId}
  onRequestChange={setPaletteAgentDialogRequest}
/>
```

## Snapshot The Target Agent ID

Command palette actions target the agent the user invoked them on, **not** a live `topAgentId()`. Snapshot the `agentId` when the action fires:

```tsx
type PaletteAgentDialogRequest =
  | { kind: "edit-title"; agentId: string; currentTitle: string }
  | { kind: "notes"; agentId: string }
  | { kind: "archive"; agentId: string }
  | { kind: "unarchive"; agentId: string }
```

If the modal stack changes while a subdialog is open (for example the user dismisses the agent modal that owned the action), a cleanup effect in `LiveApp` clears the stale request:

```tsx
createEffect(() => {
  const request = paletteAgentDialogRequest()
  if (!request) return

  const targetInModalStack = agentModalStack().some((m) => m.id === request.agentId)
  const targetIsRouteAgent = routeAgentId() === request.agentId

  if (!targetInModalStack && !targetIsRouteAgent) {
    setPaletteAgentDialogRequest(null)
  }
})
```

## AgentTypeahead Is A Corvu Popover, Not A Sibling Overlay

The `@@` typeahead is a `corvu/popover` anchored to the composer textarea in controlled mode. Because it stays mounted while a peek modal opens on top of it (via `modal={false}`, `trapFocus={false}`, `closeOnOutsidePointer={false}`), finder state — query, active index, scroll position, results — survives the peek round-trip naturally. No `createPersistent` required.

See `references/corvu-patterns.md` for the full popover wiring.

## Escape Ownership Across Layers

Corvu owns Escape for dialogs and the Corvu Popover. Any other document-level Escape listener in the layer tree must avoid calling `preventDefault()` unconditionally — `solid-dismissible` gates on `event.defaultPrevented`.

In Birdhouse, `AgentTypeahead` has its own Escape handler (for typeahead-specific dismiss semantics). It re-checks `isInteractive()` inside the handler body to avoid swallowing Escape during the peek handoff window:

```tsx
createEffect(() => {
  if (!shouldShow()) return

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return
    if (!isInteractive()) return // re-check at event time
    if (openPopoverIndex() !== null) return
    e.preventDefault()
    props.onClose()
  }

  document.addEventListener("keydown", handleKeyDown)
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown))
})
```

This is the Birdhouse application of the generic rule in `solidjs-best-practices` (re-check reactive guards inside event handlers).
