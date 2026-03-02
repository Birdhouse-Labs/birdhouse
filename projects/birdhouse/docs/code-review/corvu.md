# Corvu UI Library Best Practices

This guide covers Corvu-specific patterns and common pitfalls. Read this when working with Corvu components (Dialog, Drawer, Popover, etc).

**Corvu** is a SolidJS UI library providing accessible, unstyled primitives. It uses a shared dismissible context system for keyboard and click-outside handling.

**Official docs:** https://corvu.dev

---

## Dialog Component

### ✅ Nest Child Dialogs Inside Parent Dialog.Content

When using **nested modals** (confirmation dialogs, detail views, multi-step flows), you **must** render child `<Dialog>` components inside the parent's `<Dialog.Content>` - not as siblings.

**✅ Correct - Nested in Component Tree:**

```typescript
<Dialog open={props.open} onOpenChange={props.onOpenChange}>
  <Dialog.Portal>
    <Dialog.Content>
      {/* Parent dialog content */}
      <h1>Edit Pattern</h1>
      <form>...</form>
      
      {/* Nest confirmation dialog INSIDE parent content */}
      <Dialog open={confirmingCancel()} onOpenChange={setConfirmingCancel}>
        <Dialog.Portal>
          <Dialog.Content style={{ "z-index": 127 }}>
            <h2>Discard unsaved changes?</h2>
            <button>Keep Editing</button>
            <button>Discard</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog>
```

**✅ Example to follow:** `src/experiments/pattern-library-ui/components/PatternFormModal.tsx:425-448`

**❌ Wrong - Sibling Dialogs:**

```typescript
<>
  <Dialog open={props.open}>
    <Dialog.Content>
      {/* Parent content */}
    </Dialog.Content>
  </Dialog>
  
  {/* ❌ WRONG: Confirmation as sibling, not nested child */}
  <Dialog open={showConfirm()}>
    <Dialog.Content>
      {/* Confirmation content */}
    </Dialog.Content>
  </Dialog>
</>
```

### Why Component Hierarchy Matters

Corvu uses a **shared `DismissibleContext`** with a layer array to track which dialogs are open. This context is established by the first `Dialog` component and shared by all nested dialogs.

**From Corvu source code:**
```typescript
// Each Dialog creates a Dismissible with a unique ID
const dismissibleContext = useContext(DismissibleContext)
if (!dismissibleContext) {
  // First dialog creates the context provider
  return <DismissibleContext.Provider value={{ layers, onLayerShow, onLayerDismiss }}>
}

// Only the LAST layer in the array responds to Escape/outside clicks
const isLastLayer = () => {
  return context.layers()[context.layers().length - 1] === dismissibleId
}
```

**When dialogs are properly nested (component hierarchy):**
- ✅ Child dialogs inherit parent's `DismissibleContext`
- ✅ Layer array tracks parent → child relationship
- ✅ Only the **topmost (last layer)** dialog responds to Escape key
- ✅ Parent dialogs stay open when child dialogs close

**When dialogs are siblings (even with different z-indices):**
- ❌ Each dialog may create its own context or share it incorrectly
- ❌ Layer tracking breaks - Corvu can't determine parent/child relationships
- ❌ **"One Escape = Two Dismissals" bug**: Pressing Escape closes multiple dialogs at once
- ❌ Race conditions as each dialog's dismissal listener fires independently

### Component Hierarchy vs DOM Hierarchy

**Key insight:** What matters is **JSX component nesting**, not DOM hierarchy (z-index/Portal placement).

```typescript
// This IS properly nested, even though Portal moves DOM elements
<Dialog> <!-- Parent -->
  <Dialog.Content>
    <Dialog> <!-- Child: nested in JSX -->
      <Dialog.Portal> <!-- Portal moves to document.body in DOM -->
        <Dialog.Content style={{ "z-index": 127 }}>
          {/* Visually on top, component-wise nested */}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  </Dialog.Content>
</Dialog>
```

**Use z-index for visual stacking:**
- Parent: z-index 120/122
- Child: z-index 125/127
- Grandchild: z-index 130/132

But the **component hierarchy** is what Corvu's layer system reads.

### Real-World Example: Pattern Library

**Before (broken):**
```typescript
return (
  <>
    <Dialog>{/* Library */}</Dialog>
    <Dialog>{/* Detail Modal */}</Dialog>
    <Dialog>{/* Edit Form */}</Dialog>
    <Dialog>{/* Confirmation */}</Dialog>
  </>
)
```

**Bug:** Opening Library → Detail → Edit Form → Cancel. Pressing Escape closed both Confirmation AND Edit Form at once.

**After (fixed):**
```typescript
return (
  <Dialog> {/* Library */}
    <Dialog.Content>
      {/* Library content */}
      <Dialog>{/* Detail Modal */}</Dialog>
      <Dialog>{/* Edit Form */}
        <Dialog.Content>
          {/* Form content */}
          <Dialog>{/* Confirmation */}</Dialog>
        </Dialog.Content>
      </Dialog>
    </Dialog.Content>
  </Dialog>
)
```

**Result:** Escape only closes the topmost dialog. Layer system works perfectly.

**Reference:** `src/experiments/pattern-library-ui/components/PatternLibraryDialog.tsx:300-537`

---

## Controlling Dialog Dismissal

### ✅ Use Built-in Props to Prevent Dismissal

Corvu provides three props to control when dialogs can be dismissed:

```typescript
<Dialog
  open={open()}
  onOpenChange={setOpen}
  closeOnEscapeKeyDown={!isDirty()}      // Disable Escape when dirty
  closeOnOutsidePointer={!isDirty()}     // Disable click-outside when dirty
  closeOnOutsideFocus={!isDirty()}       // Disable focus-outside when dirty
>
```

**When to use:**
- Forms with unsaved changes (dirty state protection)
- Critical confirmations that shouldn't be accidentally dismissed
- Multi-step flows where back-tracking should be explicit

**Alternative pattern - Event callbacks:**
```typescript
<Dialog
  open={open()}
  onOpenChange={setOpen}
  onEscapeKeyDown={(event) => {
    if (isDirty()) {
      event.preventDefault()
      setShowConfirmation(true)
    }
  }}
  onOutsidePointer={(event) => {
    if (isDirty()) {
      event.preventDefault()
      setShowConfirmation(true)
    }
  }}
>
```

**Which to use:**
- **Props** (`closeOnEscapeKeyDown={!isDirty()}`): Cleaner, more reactive, idiomatic
- **Event callbacks**: More control, can customize behavior per dismissal type

**Example:** `src/experiments/pattern-library-ui/components/PatternFormModal.tsx:202-212`

---

## Common Pitfalls

### ❌ Don't Use Event Handlers on Dialog.Content for Dismissal Control

**❌ Wrong:**
```typescript
<Dialog.Content
  onKeyDown={(e) => {
    if (e.key === "Escape" && isDirty()) {
      e.preventDefault() // ❌ Won't work - Corvu listens at document level
    }
  }}
>
```

**Why this fails:**
- Corvu's dismissible system registers **document-level** event listeners
- Your `onKeyDown` on `Dialog.Content` only captures events bubbling to that element
- Corvu's listener fires first and calls `setOpen(false)` before your handler runs

**✅ Right:**
```typescript
<Dialog
  closeOnEscapeKeyDown={!isDirty()}  // Use Corvu's built-in prop
>
```

### ❌ Don't Try to Coordinate Sibling Dialogs Manually

**❌ Wrong:**
```typescript
<Dialog closeOnEscapeKeyDown={!childDialogOpen()}>  {/* ❌ Fragile coordination */}
  {/* Parent */}
</Dialog>
<Dialog closeOnEscapeKeyDown={true}>
  {/* Child as sibling */}
</Dialog>
```

**✅ Right:**
```typescript
<Dialog>
  <Dialog.Content>
    {/* Parent */}
    <Dialog>  {/* ✅ Proper nesting - Corvu handles it */}
      {/* Child */}
    </Dialog>
  </Dialog.Content>
</Dialog>
```

**Why:** Corvu's layer system is designed for nested components. Fighting it with manual coordination is fragile and error-prone.

---

## Quick Reference

| Task | Pattern | Example in Codebase |
|------|---------|---------------------|
| Nested modals | Render inside parent `Dialog.Content` | `src/experiments/pattern-library-ui/components/PatternFormModal.tsx:425-448` |
| Multi-level nesting | Library → Detail → Form → Confirmation | `src/experiments/pattern-library-ui/components/PatternLibraryDialog.tsx:300-537` |
| Prevent dismissal when dirty | Use `closeOnEscapeKeyDown` prop | `src/experiments/pattern-library-ui/components/PatternFormModal.tsx:202-212` |
| Confirmation before close | Nest confirmation Dialog inside parent | `src/experiments/pattern-library-ui/components/PatternFormModal.tsx:425-448` |

---

## When to Read Corvu Docs

If you're doing any of these, read the official docs:
- Using other Corvu primitives (Drawer, Popover, Tooltip, etc)
- Implementing custom dismissible behavior
- Working with Corvu's context system
- Customizing accessibility features

**Official docs:** https://corvu.dev

---

**Created:** 2026-02-25 to document Dialog nesting pattern after fixing "One Escape = Two Dismissals" bug
