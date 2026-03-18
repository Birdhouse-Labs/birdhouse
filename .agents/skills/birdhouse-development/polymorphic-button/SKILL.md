---
name: polymorphic-button
description: Ensures navigation buttons support browser link behaviors by rendering as <a> tags with href while maintaining button styling and effects.
trigger_phrases:
  - button link behavior
  - right click button
  - polymorphic button
  - button as link
  - link styled as button
  - navigation button
---

# Polymorphic Button: Links that Look Like Buttons

When a "button" does navigation rather than an action, use an `<a>` tag, not `<button>`. This keeps browser link behavior intact.

## Why This Matters

Users expect navigation elements to support:

- Right-click -> Open in new tab
- Cmd/Ctrl-click -> Open in new tab
- Middle-click -> Open in new tab
- Hover -> See URL in browser status bar
- Browser back and forward buttons behave correctly

Rule: if clicking changes the URL, use `<a>`. If it performs an action (submit form, toggle state, API call), use `<button>`.

## Birdhouse Implementation

Our `Button` component supports `href`. When provided, it renders as `<a>` with the same styling and effects.

### Correct: use href for navigation

```tsx
<Button
  variant="primary"
  href="/live"
  leftIcon={<Bot size={16} />}
>
  New Agent
</Button>

<Button
  variant="secondary"
  href={`/live/${agentId}`}
>
  View Agent
</Button>
```

### Wrong: do not use onClick for navigation

```tsx
<Button
  variant="primary"
  onClick={() => navigate("/live")}
>
  New Agent
</Button>
```

## Component Implementation Pattern

1. Add `href` to props:

```tsx
export type ButtonProps = {
  href?: string;
};
```

2. Extract `href` in `splitProps`:

```tsx
const [local, others] = splitProps(props, [
  "href",
]);
```

3. Conditionally render `<a>` or `<button>`:

```tsx
return (
  <>
    <style>{/* ... styles ... */}</style>
    {local.href ? (
      <a href={local.href} {...sharedProps} {...others}>
        {content}
      </a>
    ) : (
      <button {...sharedProps} disabled={local.disabled} {...others}>
        {content}
      </button>
    )}
  </>
);
```

4. Use `HTMLElement` in shared event handlers:

```tsx
const handleMouseMove = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement;
};
```

## Real Example

See `projects/birdhouse/frontend/src/components/ui/Button.tsx` for the complete implementation.

## When To Use

Use `href` when the control navigates to another page or route.

Use `onClick` when the control submits, toggles, starts, stops, creates, deletes, or otherwise performs an action without navigation.

## Testing

Verify:

1. Right-click shows open-in-new-tab options.
2. Cmd/Ctrl-click opens in a new tab.
3. Middle-click opens in a new tab.
4. Hover shows the URL.
5. Visual appearance stays identical.
6. Hover and active effects still work.
