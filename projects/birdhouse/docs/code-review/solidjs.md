# SolidJS Best Practices

This guide covers SolidJS-specific patterns and common pitfalls. Read this when working with reactive primitives, effects, or component lifecycle.

---

## Module-Level Reactive Computations

### ✅ Correct Pattern: Single createRoot with Disposal

When you need signals, effects, or memos at **module level** (outside components), wrap them in `createRoot` for proper cleanup.

**✅ Example to follow:** `src/theme/context.ts:78-130`

This file demonstrates the correct pattern:
- ONE `createRoot` for all related computations
- Stores the `dispose` function for cleanup
- Properly exports reactive values (like `resolvedCodeTheme`)
- Uses `onCleanup` for event listeners

**Key points:**
```typescript
// Declare reactive values that will be assigned in createRoot
let resolvedCodeTheme: ReturnType<typeof createMemo<string>>;

// Single root for all related effects
export const disposeThemeSystem = createRoot((dispose) => {
  // Assign memo inside root
  resolvedCodeTheme = createMemo(() => /* ... */);
  
  // Effects are owned by this root
  createEffect(() => { /* ... */ });
  
  // Event listeners need onCleanup
  onCleanup(() => removeEventListener(...));
  
  // Return dispose for explicit cleanup
  return dispose;
});

// Export the memo so it can be called
export { resolvedCodeTheme };
```

**Why this matters:**
- ❌ **Without createRoot**: "computations created outside a createRoot" warnings + memory leaks
- ✅ **With createRoot**: Proper disposal tracking, no leaks, clean console

**Reference:** [SolidJS createRoot docs](https://docs.solidjs.com/reference/reactive-utilities/create-root)

---

## Effects and Cleanup

### ✅ Always Use onCleanup for Resources

When an effect sets up resources (event listeners, timers, subscriptions), clean them up.

**✅ Example to follow:** `src/theme/context.ts:102-112`

```typescript
createEffect(() => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (e: MediaQueryListEvent) => {
    // Handle event
  };
  mediaQuery.addEventListener("change", handleChange);
  
  // Clean up when effect re-runs or disposes
  onCleanup(() => mediaQuery.removeEventListener("change", handleChange));
});
```

**Also see:** `src/components/ui/Combobox.tsx:244-246` (cleanup document listener)

**Why this matters:**
- ❌ **Without onCleanup**: Event listeners accumulate, memory leaks
- ✅ **With onCleanup**: Resources properly freed

---

## Component Patterns

### ✅ Use createMemo for Derived Values

When you have computed values used in multiple places, use `createMemo` instead of functions.

**✅ Example to follow:** `src/components/ui/Combobox.tsx:114-128`

The `filteredOptions` function is called multiple times per render. Consider if it should be a memo.

**When to use createMemo:**
- Value is expensive to compute
- Value is used multiple places in render
- Want to prevent redundant calculations

**When a function is fine:**
- Simple computation
- Only used once
- No performance concern

---

## Signals vs Props

### ✅ Pass Signals as Accessors, Not Values

**❌ Wrong:**
```typescript
<MyComponent value={signal()} />  // Passes current value, not reactive
```

**✅ Right:**
```typescript
<MyComponent value={signal} />    // Passes accessor, stays reactive
// OR
<MyComponent value={signal()} />  // OK if prop is not reactive
```

**In this codebase:** We pass `value={selected()}` to Combobox because it's controlled - the parent manages reactivity.

---

## createResource Patterns

### ✅ Use Storage Option to Prevent Loading Flash

**✅ Example to follow:** `src/demos/CodeBlockDemo/index.tsx:132-151`

```typescript
const [data] = createResource(
  source,
  fetcher,
  {
    storage: (init) => {
      const [value, setValue] = createSignal(init);
      return [value, (v) => v && setValue(v)];
    },
  }
);
```

This keeps previous value visible while fetching new data - prevents loading flashes.

**Reference:** `src/demos/CodeBlockDemo/index.tsx:251` - No loading fallback needed with storage

---

## Common Pitfalls

### ❌ Don't Access `resource()` Without Checking `resource.error` First

When a `createResource` is in an error state, calling `resource()` to get its value **throws the error**. This is by design for Suspense/ErrorBoundary integration, but it causes unhandled rejections if you access the value without guarding.

**❌ Wrong:**
```typescript
const [config] = createResource(source, fetchConfig);

// This effect will THROW when config errors!
createEffect(() => {
  const data = config();  // 💥 Throws if config.error is set
  if (data) doSomething(data);
});

// This memo will THROW when config errors!
const derived = createMemo(() => {
  return config()?.someField;  // 💥 Throws if config.error is set
});
```

**✅ Right:**
```typescript
const [config] = createResource(source, fetchConfig);

// Guard against errors before accessing value
createEffect(() => {
  if (config.error) return;  // ✅ Check error first
  const data = config();
  if (data) doSomething(data);
});

// Guard in memos too
const derived = createMemo(() => {
  if (config.error) return undefined;  // ✅ Check error first
  return config()?.someField;
});
```

**Why this matters:**
- ❌ **Without guard**: Error thrown → propagates to ErrorBoundary or becomes unhandled rejection
- ✅ **With guard**: Error stays in `resource.error`, component can render error UI

**Safe patterns that DON'T throw:**
```typescript
// These are always safe - they read metadata, not the value
config.loading  // ✅ Safe
config.error    // ✅ Safe  
config.state    // ✅ Safe

// Show guards check error before accessing value
<Show when={!config.error && config()}>  // ✅ Safe - error checked first
  {(data) => <div>{data().field}</div>}
</Show>
```

**Real example:** `src/workspace-config/components/WorkspaceConfigDialog.tsx` - has effects and memos that guard against `config.error` before calling `config()`.

**Testing implications:** This bug is especially nasty in tests because:
1. Mock returns rejected promise ✓
2. Resource captures the error in `resource.error` ✓
3. But then an effect/memo calls `resource()` without checking
4. Error is thrown and becomes "Unhandled Rejection"
5. Test fails with cryptic error, component never renders error UI

---

### ❌ Don't Create Effects in Loops or Conditionals

**❌ Wrong:**
```typescript
for (const item of items) {
  createEffect(() => { /* ... */ });  // Creates multiple untracked effects!
}
```

**✅ Right:**
```typescript
createEffect(() => {
  for (const item of items()) {
    // Process items inside effect
  }
});
```

### ❌ Don't Mutate Signals Directly

**❌ Wrong:**
```typescript
const [state] = createSignal({ count: 0 });
state().count++;  // Mutation doesn't trigger updates!
```

**✅ Right:**
```typescript
const [state, setState] = createSignal({ count: 0 });
setState({ count: state().count + 1 });  // Creates new object
// OR use createStore for mutable-style API
```

---

## When to Read SolidJS Docs

If you're doing any of these, read the official docs:
- Creating custom primitives or utilities
- Working with Suspense or ErrorBoundary
- Using Context providers
- Implementing advanced patterns (stores, reconciliation)

**Official docs:** https://docs.solidjs.com

---

## Quick Reference

| Task | Pattern | Example in Codebase |
|------|---------|---------------------|
| Module-level effects | `createRoot` with dispose | `src/theme/context.ts:78-130` |
| Event listener cleanup | `onCleanup` | `src/theme/context.ts:112` |
| Component event cleanup | `onCleanup` in effect | `src/components/ui/Combobox.tsx:244-246` |
| Prevent loading flash | `createResource` storage | `src/demos/CodeBlockDemo/index.tsx:132-151` |
| Derived values | `createMemo` | `src/theme/context.ts:83` |

---

**Updated:** 2025-12-22 after fixing module-level effects pattern
