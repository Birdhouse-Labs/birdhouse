# For vs Index in SolidJS

## TL;DR

- **`For`** - Keys by object reference (best for stores with stable objects)
- **`Index`** - Keys by array position (best for primitive arrays or stable positions)

For our newest-at-top message architecture: **Use `For`**

## The Problem We Had

```tsx
// Using Index (BAD for our architecture)
<Index each={props.messages}>
  {(message) => <MessageBubble message={message()} />}
</Index>
```

When new message arrives at position 0:

```
Before: [msg1, msg2, msg3]  (indices: 0, 1, 2)
After:  [newMsg, msg1, msg2, msg3]  (indices: 0, 1, 2, 3)
```

**Index behavior:**
- Index 0: Was `msg1`, now `newMsg` → Re-render with different data 💥
- Index 1: Was `msg2`, now `msg1` → Re-render with different data 💥  
- Index 2: Was `msg3`, now `msg2` → Re-render with different data 💥
- **Result:** ALL messages re-render, causing flicker and re-highlighting

## The Solution

```tsx
// Using For (GOOD for our architecture)
<For each={props.messages}>
  {(message) => <MessageBubble message={message} />}
</For>
```

When new message arrives:

```
Before: [msg1, msg2, msg3]  (refs: ref1, ref2, ref3)
After:  [newMsg, msg1, msg2, msg3]  (refs: refN, ref1, ref2, ref3)
```

**For behavior:**
- refN: New reference → Create new bubble ✅
- ref1, ref2, ref3: Same references → Keep existing bubbles, zero re-renders ✅
- **Result:** Only new message renders, old messages completely stable

## Why This Works with SolidJS Stores

```tsx
const [messages, setMessages] = createStore<Message[]>([]);

// Insert new message
setMessages([newMessage, ...messages]);  // New object at [0]

// Update existing message (granular)
setMessages(index, 'content', newContent);  // Same object reference!
```

**Key insight:** Store updates preserve object references, perfect for `For`.

## When to Use Each

### Use `For` when:
- ✅ Array of objects with stable references (stores, signals)
- ✅ Items inserted/removed at arbitrary positions
- ✅ Items updated in place (granular updates)
- ✅ **Our case:** Newest-at-top messages with streaming updates

### Use `Index` when:
- ✅ Array of primitives (`string[]`, `number[]`)
- ✅ Stable array positions (append-only, or specific indices change)
- ✅ Array where position matters more than identity
- ✅ Example: Fixed-size grid, paginated data with stable pages

## Syntax Differences

```tsx
// For - gives you the VALUE directly
<For each={items}>
  {(item) => <div>{item.name}</div>}
  //    ^--- value
</For>

// Index - gives you a SIGNAL (accessor)
<Index each={items}>
  {(item) => <div>{item().name}</div>}
  //    ^--- signal (call it with ())
</Index>
```

## Performance Impact

With 100 messages and newest-at-top:
- **Index:** 100 re-renders on each new message 💥
- **For:** 1 render (only the new message) ✅

## Related: Suspense and Focus

Using `For` also helps with:
- Code block re-highlighting (no unnecessary re-renders)
- Input focus stability (less DOM churn)
- Suspense boundary stability (fewer triggers)

## References

- [SolidJS For docs](https://docs.solidjs.com/reference/components/for)
- [SolidJS Index docs](https://docs.solidjs.com/reference/components/index-component)
- See: `frontend/src/components/ui/ChatContainer.tsx`
