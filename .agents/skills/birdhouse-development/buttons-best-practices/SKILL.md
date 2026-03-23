---
name: buttons-best-practices
description: Guidelines for button variants (primary/secondary/tertiary) and when to use href for navigation vs onClick for actions.
tags:
  - birdhouse-development
trigger_phrases:
  - button styles
  - buttons best practices
---

# Buttons Best Practices

## Button Variants

Use the correct variant for the action's importance:

- Primary - Main action (gradient button). Use sparingly, usually one per section.
- Secondary - Standard actions.
- Tertiary - Less prominent actions.

## Navigation vs Actions

For navigation (changes URL):

- Use `href` to render as an `<a>` tag.
- Add `#` prefix for hash routes: `href="#/workspace/123/agents"`.
- This enables right-click "Open in new tab" and Cmd/Ctrl-click behavior.
- This shows the URL on hover in the browser.

For actions (API calls, state changes):

- Use `onClick` to render as a `<button>` tag.
- Do not provide `href`.

## Examples

```tsx
// Navigation - use href with # prefix
<Button variant="primary" href="#/workspace/ws_123/agents">
  Open Workspace
</Button>

// Action - use onClick
<Button variant="secondary" onClick={handleDelete}>
  Delete
</Button>
```
