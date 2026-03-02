# Performance Best Practices

This guide covers performance optimization patterns. Read this when handling large datasets or complex state.

---

## Coming Soon

This guide will cover:
- When to use createMemo
- Virtualization for large lists (@tanstack/solid-virtual)
- Avoiding unnecessary re-renders
- Resource management

**For now:**
- We have `@tanstack/solid-virtual` installed for future large list support
- Use `createMemo` for expensive derived values
- See `src/components/ui/Combobox.tsx` for efficient filtering patterns
