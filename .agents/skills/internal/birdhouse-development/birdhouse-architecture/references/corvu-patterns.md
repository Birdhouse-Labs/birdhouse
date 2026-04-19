# Corvu Patterns In Birdhouse

Load this reference when adding or modifying Corvu Dialog or Popover usage in the Birdhouse frontend.

Ground first on `corvu-best-practices`. This file only documents how Birdhouse applies those rules, with code pointers.

## Dialogs: Nest In JSX, Never Siblings

Birdhouse enforces the nested-JSX rule from `corvu-best-practices` primitive-gotchas:

- **Agent modal stack** — `AgentModalStackNode` in `projects/birdhouse/frontend/src/LiveApp.tsx` renders each child modal inside the parent's `AgentModal` `children` slot.
- **Palette subdialogs** — `PaletteAgentSubdialogs` renders inside the target `AgentModalStackNode`, not at the palette root. See `references/modal-layering.md`.

Do not render a new `<Dialog>` at LiveApp root expecting it to coexist with the agent modal stack. It will not share Corvu's layer context with the stack, and Escape will over-dismiss.

## AgentTypeahead Is A Corvu Popover

The `@@` typeahead is **not** a bespoke `@floating-ui/dom` wrapper. It is a `corvu/popover` with controlled open state, anchored around the textarea.

```tsx
// projects/birdhouse/frontend/src/components/ui/AgentTypeahead.tsx
<Popover
  open={shouldShow()}
  onOpenChange={(open) => { if (!open) props.onClose() }}
  modal={false}
  trapFocus={false}
  closeOnOutsidePointer={false}
  strategy="fixed"
  placement="top-start"
  floatingOptions={TYPEAHEAD_POPOVER_FLOATING_OPTIONS}
>
  <Popover.Anchor class="w-full">{props.children}</Popover.Anchor>

  <Popover.Portal>
    <Popover.Content ...>
      <AgentFinder ... />
    </Popover.Content>
  </Popover.Portal>
</Popover>
```

Why each option is set:

- `modal={false}` — the composer stays interactive under the popover
- `trapFocus={false}` — focus stays in the textarea; a peek dialog opening above doesn't dismiss the popover via `closeOnOutsideFocus`
- `closeOnOutsidePointer={false}` — clicking agent modal chrome doesn't close the typeahead
- Controlled `open` — `AutoGrowTextarea` decides visibility based on `@@` trigger detection and `showAgentTypeahead`
- `Popover.Anchor` wraps the textarea (as `props.children`) — the anchor cannot be an external `referenceElement`, so the typeahead component accepts the textarea as a JSX child

The combination makes the popover stay mounted when a peek dialog opens on top of it, which is what preserves `AgentFinder` state across peek round-trips. Regression test: `AgentTypeahead.layer.test.tsx` verifies the same `AgentFinder` instance survives a peek open/close.

## Matches Popover Inside AgentFinder

Each search result row can open a match-detail Corvu Popover. This is Popover-inside-Popover:

- Outer: `AgentTypeahead`'s popover
- Inner: per-row match popover in `AgentFinder`

No `contextId` is currently used — nothing in the tree calls `useContext()` across the boundary, so disambiguation is not required. If a future component needs to `useContext(Popover)` from inside the match popover body and tell it apart from the outer typeahead, add `contextId` at that point.

## Escape And `solid-dismissible`'s `defaultPrevented` Gate

`solid-dismissible` (Corvu's dismissible-layer implementation) only calls `onDismiss("escapeKey")` when `event.defaultPrevented` is false. Any other document-level Escape listener that calls `preventDefault()` silently blocks Corvu's dismissal.

Birdhouse hits this in two shapes in practice:

1. `AgentFinder` used to own a document-level Escape listener that called `preventDefault()`. This swallowed Corvu's dismiss for any dialog layer. Fix: `AgentFinder` no longer owns Escape — Corvu-wrapped hosts (agent modals, search dialog) own dismissal, and `AgentTypeahead` owns its own Escape scoped to its own state with the guard-at-event-time pattern in `references/solid-patterns.md`.

2. `AgentFinder`'s `ShiftRight`/`MetaRight`/`ControlRight` shortcut ownership **is** allowed to call `preventDefault()` — Escape is not affected. The capture-phase claim is scoped to keys Corvu does not own.

The generic rule is in `corvu-best-practices` primitive-gotchas. The Birdhouse-specific point: never add `preventDefault()` on Escape in any document listener inside the Birdhouse modal tree.

## Controlled Open State

Birdhouse uses controlled open state on both dialogs and popovers because the modal stack is URL-driven.

- `AgentModal` — `open={true}` always (the stack decides whether this instance exists), `onOpenChange` calls `onClose` only when `isTop`
- `AgentSearchDialog` — `open={isOpen()}` from URL modal stack, `onOpenChange` calls `closeSearch` when top
- `AgentTypeahead` — `open={shouldShow()}` from `visible && triggerMatch()`, `onOpenChange` calls `props.onClose` to flip `showAgentTypeahead`

When working on a new dialog: match this pattern. Do not reach for uncontrolled state unless the dialog truly has no external lifecycle.

## Close Props: What Birdhouse Sets Explicitly

| Prop | AgentModal | AgentSearchDialog | AgentTypeahead |
|---|---|---|---|
| `closeOnEscapeKeyDown` | `props.isTop` | `isTopMostSearchDialog()` | default |
| `closeOnOutsidePointer` | `false` | `false` | `false` |
| `closeOnOutsideFocus` | `false` | `false` | not set (`trapFocus={false}` implies no outside-focus-close) |
| `modal` | default (true) | default (true) | `false` |
| `trapFocus` | default (true) | default (true) | `false` |

Treat these as the reference configurations. If a new Birdhouse dialog needs different values, document why.
