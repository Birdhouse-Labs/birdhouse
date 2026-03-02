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

## Coming Soon

This guide will cover:
- Component testing patterns
- Testing user interactions
- Snapshot testing
- Mock strategies

**For now, see:**
- `src/components/ui/Button.test.tsx` - Example component test
- `src/workspace-config/components/WorkspaceConfigDialog.test.tsx` - Resource error testing
- Run: `bun run test` or `bun run test:watch`
