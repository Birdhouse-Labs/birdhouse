# Testing Patterns

This guide covers testing strategies and patterns. Read this when writing tests.

---

## SolidJS Testing Gotchas

### createResource Error Testing

When testing `createResource` error states, **the component must guard against errors before accessing `resource()`**. Otherwise, the error becomes an unhandled rejection instead of populating `resource.error`.

See the full explanation in [SolidJS Best Practices - Common Pitfalls](./solidjs.md#-dont-access-resource-without-checking-resourceerror-first).

**Symptom:** Test mocks API to reject, but:
- `resource.error` is set correctly
- Component never renders error UI
- Test fails with "Unhandled Rejection"

**Cause:** An effect or memo calls `resource()` without checking `resource.error` first.

**Fix:** Guard all `resource()` access:
```typescript
createEffect(() => {
  if (config.error) return;  // ✅ Guard first
  const data = config();
  // ...
});
```

---

## Corvu Component Mocks Are Load-Bearing

When a Corvu primitive (Dialog, Popover, Drawer, etc.) is mocked in a test file, the mock's
prop interface becomes part of the test infrastructure. If the real component adds a new event
handler prop — `onKeyUp`, `onFocus`, `onPointerDown`, etc. — and the mock doesn't forward it,
the handler silently disappears. The test won't fail with a clear error; it will just never fire.

**Symptom:** You add a new event handler to a Corvu component in production code. Tests that
exercise that handler pass zero calls to the mock function, even though the handler works in
the browser.

**Cause:** The mock `Dialog.Content` (or equivalent) only forwards the props it was originally
written to accept. New props are ignored unless explicitly added.

**Fix:** Keep the mock's prop type in sync with what the component actually uses. When you add
a handler to `Dialog.Content` in the component, add the same prop to the mock:

```tsx
// In the test file's vi.mock("corvu/dialog", ...) block:
Dialog.Content = (props: {
  children: JSX.Element;
  class?: string;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;  // ← add when component uses it
}) => (
  <div role="presentation" onKeyDown={props.onKeyDown} onKeyUp={props.onKeyUp}>
    {props.children}
  </div>
);
```

The mock in `AgentSearchDialog.test.tsx` is the canonical reference for this pattern.

---

## Test Helper Side Effects

Test files often define small helpers like `renderDialog()` that set up shared mutable state
before rendering. If that helper resets state you've already configured, tests silently use the
wrong setup.

**Symptom:** You set a shared variable (e.g. `mockModalStack`) before calling a render helper,
but the test behaves as if your assignment never happened.

**Cause:** The render helper resets the variable as a side effect.

**Fix:** Document the side effects on the helper, and in tests that need non-default state,
set the variable *after* calling the helper:

```ts
// renderDialog resets mockModalStack as a side effect — set it after if needed
renderDialog();
mockModalStack = [{ type: "agent-search", id: "main" }, { type: "agent", id: "agent-1" }];
await screen.findByLabelText("Search agent messages");
```

See `AgentSearchDialog.test.tsx` for a working example of both patterns.
