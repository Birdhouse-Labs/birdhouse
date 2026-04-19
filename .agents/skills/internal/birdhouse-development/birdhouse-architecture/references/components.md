# Components

Load this reference when creating or modifying Birdhouse UI primitives (buttons, links, and similar interactive elements).

## Button Variants

Use the correct variant for the action's importance:

- **Primary** — main action (gradient button). Use sparingly, usually one per section.
- **Secondary** — standard actions.
- **Tertiary** — less prominent actions.

## Navigation Versus Actions

Every `Button` in Birdhouse must decide: does clicking change the URL, or does it perform an action?

### Navigation: Use `href`

When clicking navigates to another route, the `Button` renders as an `<a>` tag. Set `href`:

```tsx
<Button variant="primary" href="#/workspace/ws_123/agents">
  Open Workspace
</Button>

<Button variant="secondary" href={`#/live/${agentId}`}>
  View Agent
</Button>
```

Hash routing requires the `#` prefix.

This preserves browser behaviors users expect from navigation:

- Right-click → Open in new tab
- Cmd/Ctrl-click → Open in new tab
- Middle-click → Open in new tab
- Hover → shows URL in browser status bar
- Back/forward buttons work correctly

### Actions: Use `onClick`

When clicking performs an action (API call, state change, toggle), the `Button` renders as a `<button>` tag. Set `onClick`:

```tsx
<Button variant="secondary" onClick={handleDelete}>
  Delete
</Button>
```

Do not provide `href` for actions.

### Wrong: `onClick` To Navigate

```tsx
// ❌ loses right-click, middle-click, Cmd-click, status bar URL
<Button variant="primary" onClick={() => navigate("/live")}>
  New Agent
</Button>
```

## Polymorphic Implementation Pattern

The shared `Button` accepts `href` and switches between `<a>` and `<button>`. When creating a new polymorphic-style component:

1. Add `href` to props.
2. Extract `href` in `splitProps`.
3. Conditionally render `<a href={...}>` or `<button>`, spreading shared props both ways.
4. Type shared event handlers as `HTMLElement`, not element-specific.

See `projects/birdhouse/frontend/src/components/ui/Button.tsx` for the full implementation.

## Testing A Polymorphic Button

Verify:

1. Right-click shows open-in-new-tab options.
2. Cmd/Ctrl-click opens in a new tab.
3. Middle-click opens in a new tab.
4. Hover shows the URL in the browser status bar.
5. Visual appearance is identical between `<a>` and `<button>` renders.
6. Hover and active effects still fire.
