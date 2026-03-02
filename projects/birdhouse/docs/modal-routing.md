# Modal Routing Strategy

## Overview

Birdhouse uses a URL-based modal management system that stores modal state in the `modals` query parameter. This approach enables:

- **Deep linking**: Share URLs that open specific modals
- **Browser navigation**: Back/forward buttons work naturally with modal state
- **Nested modals**: Stack multiple modals on top of each other
- **Referential equality**: Modal objects are cached to prevent unnecessary re-renders

## URL Format

The `modals` query parameter uses a comma-separated list of `type/id` pairs:

```
?modals=workspace_config/ws_123
?modals=agent/agent_1,agent/agent_2
```

Each entry represents a modal in the stack, with later entries appearing on top.

## Core API

### `useModalRoute()`

The primary hook for modal management. Returns an object with:

```typescript
const {
  modalStack,     // Accessor<ModalState[]> - full stack of open modals
  currentModal,   // Accessor<ModalState | null> - top modal in stack
  openModal,      // (type: string, id: string) => void
  closeModal,     // () => void - closes top modal
  isModalOpen,    // (type: string, id: string) => boolean
} = useModalRoute();
```

### `ModalState` Interface

```typescript
interface ModalState {
  type: string;  // Modal type identifier (e.g., "agent", "workspace_config")
  id: string;    // Resource ID (e.g., agent ID, workspace ID)
}
```

## Usage Examples

### Opening a Modal

Use `openModal(type, id)` to add a modal to the stack:

```tsx
import { useModalRoute } from "~/lib/routing";

function WorkspaceCard({ workspaceId }: { workspaceId: string }) {
  const { openModal } = useModalRoute();

  return (
    <Button onClick={() => openModal("workspace_config", workspaceId)}>
      Edit Configuration
    </Button>
  );
}
```

### Closing a Modal

Use `closeModal()` to remove the top modal from the stack:

```tsx
function MyModal() {
  const { closeModal } = useModalRoute();

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) closeModal();
      }}
    >
      {/* Modal content */}
    </Dialog>
  );
}
```

### Conditional Rendering

Use `isModalOpen()` to check if a specific modal is in the stack:

```tsx
function WorkspaceSettings({ workspaceId }: { workspaceId: string }) {
  const { isModalOpen, closeModal } = useModalRoute();

  return (
    <>
      <Button onClick={() => openModal("workspace_config", workspaceId)}>
        Edit Configuration
      </Button>

      <Show when={isModalOpen("workspace_config", workspaceId)}>
        <WorkspaceConfigDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) closeModal();
          }}
          workspaceId={workspaceId}
        />
      </Show>
    </>
  );
}
```

### Using `currentModal` for Single Modal

When you only care about the top modal in the stack:

```tsx
function App() {
  const { currentModal, closeModal } = useModalRoute();

  return (
    <Show when={currentModal()?.type === "workspace_config" ? currentModal() : null} keyed>
      {(modal) => (
        <WorkspaceConfigDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) closeModal();
          }}
          workspaceId={modal.id}
        />
      )}
    </Show>
  );
}
```

## Nested Modal Pattern

The modal stack naturally supports nesting. Each `openModal()` call pushes to the stack:

```tsx
function App() {
  const { modalStack, closeModal, openModal } = useModalRoute();
  const agentModalStack = createMemo(() =>
    modalStack().filter((modal) => modal.type === "agent")
  );

  return (
    <For each={agentModalStack()}>
      {(modal, index) => (
        <AgentModal
          agentId={modal.id}
          navigationDepth={index() + 1}
          isTop={index() === agentModalStack().length - 1}
          onClose={closeModal}
          onOpenAgentModal={openModal}
        />
      )}
    </For>
  );
}
```

**Key points:**
- Each modal in the stack is rendered
- `navigationDepth` can be used for visual offset/stacking
- `isTop` indicates if this is the frontmost modal
- Child modals can open additional modals via `onOpenAgentModal`

## Implementation Details

### Duplicate Prevention

The `pushModalStack` helper prevents duplicate entries at the top:

```typescript
// Opening the same modal twice is a no-op
openModal("agent", "agent_1");
openModal("agent", "agent_1"); // Stack unchanged
```

### Modal Caching

Modal objects are cached by `type/id` key to maintain referential equality:

```typescript
// Same modal objects are reused across parses
const modal1 = parseModalStack("agent/agent_1")[0];
const modal2 = parseModalStack("agent/agent_1")[0];
console.log(modal1 === modal2); // true
```

This prevents unnecessary re-renders in SolidJS components.

### URL Serialization

The implementation uses helper functions for URL management:

- `parseModalStack(modalsParam)` - Parses query param into `ModalState[]`
- `serializeModalStack(modals)` - Converts stack to query param string
- `pushModalStack(stack, modal)` - Adds modal to stack (immutably)
- `popModalStack(stack)` - Removes top modal (immutably)

## Common Patterns

### Pattern: Page-level Modal with Settings Button

```tsx
function WorkspaceSettings({ workspaceId }: { workspaceId: string }) {
  const { openModal, closeModal, isModalOpen } = useModalRoute();

  return (
    <div>
      <Button onClick={() => openModal("workspace_config", workspaceId)}>
        Edit Configuration
      </Button>

      <Show when={isModalOpen("workspace_config", workspaceId)}>
        <WorkspaceConfigDialog
          open={true}
          onOpenChange={(open) => {
            if (!open && isModalOpen("workspace_config", workspaceId)) {
              closeModal();
            }
          }}
          workspaceId={workspaceId}
        />
      </Show>
    </div>
  );
}
```

### Pattern: Modal Stack with Filtering

```tsx
function AgentModals() {
  const { modalStack, closeModal, openModal } = useModalRoute();
  
  // Filter to specific modal type
  const agentModals = createMemo(() =>
    modalStack().filter((m) => m.type === "agent")
  );

  return (
    <For each={agentModals()}>
      {(modal, index) => (
        <AgentModal
          agentId={modal.id}
          depth={index()}
          onClose={closeModal}
          onOpenAgent={(id) => openModal("agent", id)}
        />
      )}
    </For>
  );
}
```

### Pattern: Checking Top Modal Type

```tsx
function App() {
  const { currentModal, closeModal } = useModalRoute();
  
  const isTopModal = (type: string, id: string) =>
    currentModal()?.type === type && currentModal()?.id === id;

  return (
    <AgentModal
      agentId="agent_1"
      isTop={isTopModal("agent", "agent_1")}
      onClose={closeModal}
    />
  );
}
```

## Best Practices

1. **Always handle `onOpenChange`**: Connect dialog close actions to `closeModal()`
2. **Use `isModalOpen` for conditional rendering**: Ensures modals render when in URL
3. **Filter stacks for specific types**: Use `modalStack().filter()` when managing multiple modal types
4. **Provide navigation depth**: Pass `index()` to nested modals for visual stacking
5. **Check modal type before closing**: Prevent closing wrong modal in nested scenarios

## Testing

See [`frontend/src/lib/routing.test.ts`](../frontend/src/lib/routing.test.ts) for comprehensive test coverage of:
- Parsing and serialization
- Stack manipulation (push/pop)
- Round-trip URL consistency
- Edge cases (empty stacks, invalid entries, duplicates)

## Related Files

- **Implementation**: [`frontend/src/lib/routing.ts`](../frontend/src/lib/routing.ts)
- **Tests**: [`frontend/src/lib/routing.test.ts`](../frontend/src/lib/routing.test.ts)
- **Usage examples**:
  - [`frontend/src/LiveApp.tsx`](../frontend/src/LiveApp.tsx) - Agent modal stack
  - [`frontend/src/components/WorkspaceSelector.tsx`](../frontend/src/components/WorkspaceSelector.tsx) - Workspace config modal
  - [`frontend/src/components/WorkspaceSettings.tsx`](../frontend/src/components/WorkspaceSettings.tsx) - Settings page modal
