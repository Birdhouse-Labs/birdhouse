---
name: birdhouse-architecture
description: Birdhouse frontend architecture patterns for SolidJS and Corvu. Load when working on modals, dialogs, popovers, typeaheads, reactive component trees, buttons and navigation, or any component layering in birdhouse-workspace. Cross-references the generic `solidjs-best-practices` and `corvu-best-practices` skills.
tags:
  - birdhouse-development
  - solidjs
  - corvu
  - frontend
metadata:
  internal: true
---

# Birdhouse Architecture

Use this skill for architecture and composition work in the Birdhouse frontend. Ground on the generic framework skills first (`solidjs-best-practices`, `corvu-best-practices`), then apply the Birdhouse-specific applications documented here.

## Companion Skills

This skill cross-references two generic skills in the dotfiles install:

- `solidjs-best-practices`
- `corvu-best-practices`

If either is missing, **stop and warn the user** before continuing. The referenced rules live there; this skill only captures how Birdhouse applies them. A message like:

> "The `birdhouse-architecture` skill references `solidjs-best-practices` and `corvu-best-practices`, which are not installed in this environment. Install them from the dotfiles skills repo before proceeding, or the rules in this skill will be incomplete."

is appropriate.

## Quick Start

1. Load the companion skills above first.
2. Load `references/modal-layering.md` when touching agent modals, search dialogs, command palette subdialogs, or anything in the modal stack.
3. Load `references/corvu-patterns.md` when working with Corvu primitives in Birdhouse — `AgentModal`, `AgentTypeahead`, `AgentSearchDialog`, match popovers, or any new Dialog/Popover.
4. Load `references/solid-patterns.md` for Birdhouse applications of recursive components, document-level listeners, context Providers, and animation preservation.
5. Load `references/components.md` for Birdhouse button/link conventions.
6. Load `references/module-level-and-cleanup.md` for module-level reactive ownership.
7. Load `references/resources-and-derived-state.md` for `createResource` patterns.

## Navigation

- **[references/modal-layering.md](./references/modal-layering.md)** — Agent modal stack, palette subdialogs, z-index provider, Corvu dismissible-layer model applied
- **[references/corvu-patterns.md](./references/corvu-patterns.md)** — Corvu Dialog and Popover usage in Birdhouse with code pointers
- **[references/solid-patterns.md](./references/solid-patterns.md)** — SolidJS patterns applied in Birdhouse: recursion, event handlers, Providers, animation timestamps
- **[references/components.md](./references/components.md)** — Button variants, polymorphic navigation buttons
- **[references/module-level-and-cleanup.md](./references/module-level-and-cleanup.md)** — Module-level `createRoot`, disposal, and cleanup examples
- **[references/resources-and-derived-state.md](./references/resources-and-derived-state.md)** — `createResource` error guards, storage usage, memos, prop/signal choices

## Key Reminders

- The agent modal stack is a **recursive component tree**, not a flat `<For>`. See `modal-layering.md`.
- Command palette agent-scoped subdialogs nest into the target agent modal's JSX — they are not siblings. See `modal-layering.md`.
- `AgentTypeahead` is a **Corvu `Popover`** anchored to the composer textarea. It is not a bespoke floating wrapper. See `corvu-patterns.md`.
- `ZIndexProvider` sets the z-index scope for a modal's descendants. Slot children must render **inside** it to inherit the elevated scope. See `solid-patterns.md`.
- Any document-level Escape listener running alongside a Corvu dialog must avoid unconditional `preventDefault()` — `solid-dismissible` gates on `event.defaultPrevented`. See `corvu-patterns.md`.
- Use `href` on the shared `Button` for navigation; `onClick` for actions. See `components.md`.

## Red Flags — Stop

- Rendering agent modals, search dialogs, palette subdialogs, or any other dialogs as siblings instead of nesting them in JSX. The Corvu dismissible-layer model is JSX-based — sibling dialogs break it.
- Using a plain recursive function returning JSX for the modal stack instead of a recursive component. See `solid-patterns.md`.
- Adding a bespoke `@floating-ui/dom` wrapper when a Corvu Popover would do. Check `AgentTypeahead` for the anchor-only controlled-open pattern.
- Registering a document-level keyboard listener in a component that lives inside a Corvu dialog without re-checking the reactive guard at event time. See `solid-patterns.md`.
- Rendering `{props.children}` outside a Provider the component sets up (`ZIndexProvider`, theme, focus). See `solid-patterns.md`.
- Targeting a live `topAgentId()` from command palette subdialogs instead of snapshotting the agent ID at action time. See `modal-layering.md`.
