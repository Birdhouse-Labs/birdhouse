// ABOUTME: Corvu popover wrapper for the @@ agent finder overlay anchored to the composer.
// ABOUTME: Parses the active trigger near the cursor and maps confirmation back to text replacement.

import Popover from "corvu/popover";
import { type Component, createEffect, createMemo, createSignal, type JSX, Show } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { useModalRoute } from "../../lib/routing";
import AgentFinder from "../AgentFinder";

export interface AgentTypeaheadSelection {
  id: string;
  title: string;
}

export interface AgentTypeaheadProps {
  inputValue: string;
  cursorPosition: number;
  visible: boolean;
  workspaceId: string;
  currentAgentId: string | undefined;
  insideAgentModal?: boolean | undefined;
  onSelect: (agent: AgentTypeaheadSelection, matchedText: string, matchStartIndex: number) => void;
  onClose: () => void;
  onRegainInteractivity?: () => void;
  children: JSX.Element;
}

interface TriggerMatch {
  query: string;
  startIndex: number;
}

const TYPEAHEAD_POPOVER_FLOATING_OPTIONS = {
  offset: 4,
  flip: true,
  shift: { padding: 8 },
  size: { fitViewPort: true, padding: 16 },
} as const;

function findAgentTrigger(inputValue: string, cursorPosition: number): TriggerMatch | null {
  const textBeforeCursor = inputValue.substring(0, cursorPosition);
  const maxLookback = 50;
  const lookbackStart = Math.max(0, cursorPosition - maxLookback);

  for (let start = cursorPosition - 1; start >= lookbackStart; start -= 1) {
    if (textBeforeCursor[start] !== "@" || textBeforeCursor[start + 1] !== "@") {
      continue;
    }

    if (textBeforeCursor[start - 1] === "@") {
      continue;
    }

    if (textBeforeCursor[start + 2] === "@") {
      continue;
    }

    return {
      query: textBeforeCursor.substring(start + 2),
      startIndex: start,
    };
  }

  return null;
}

export const AgentTypeahead: Component<AgentTypeaheadProps> = (props) => {
  const baseZIndex = useZIndex();
  const { modalStack } = useModalRoute();
  const [ownerModalDepth, setOwnerModalDepth] = createSignal<number | null>(null);
  const [openPopoverIndex, setOpenPopoverIndex] = createSignal<number | null>(null);
  const [wasBlockedByPeek, setWasBlockedByPeek] = createSignal(false);

  const triggerMatch = createMemo(() => findAgentTrigger(props.inputValue, props.cursorPosition));
  const shouldShow = createMemo(() => props.visible && triggerMatch() !== null);

  createEffect(() => {
    if (!shouldShow()) {
      setOwnerModalDepth(null);
      setOpenPopoverIndex(null);
      setWasBlockedByPeek(false);
      return;
    }

    if (!props.insideAgentModal) {
      setOwnerModalDepth(null);
      return;
    }

    // Tracks which modal-stack depth owns this typeahead while nested peeks come and go above it.
    if (ownerModalDepth() === null) {
      setOwnerModalDepth(modalStack().length);
    }
  });

  const isInteractive = createMemo(() => {
    if (!props.insideAgentModal) {
      return modalStack().length === 0;
    }

    const ownerDepth = ownerModalDepth();
    return ownerDepth !== null && modalStack().length === ownerDepth;
  });

  createEffect(() => {
    if (!shouldShow() || !props.insideAgentModal) {
      setWasBlockedByPeek(false);
      return;
    }

    if (!isInteractive()) {
      setWasBlockedByPeek(true);
      return;
    }

    if (wasBlockedByPeek()) {
      queueMicrotask(() => props.onRegainInteractivity?.());
      setWasBlockedByPeek(false);
    }
  });

  return (
    <Popover
      open={shouldShow()}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      modal={false}
      trapFocus={false}
      closeOnEscapeKeyDown={false}
      closeOnOutsidePointer={false}
      closeOnOutsideFocus={false}
      strategy="fixed"
      placement="top-start"
      floatingOptions={TYPEAHEAD_POPOVER_FLOATING_OPTIONS}
    >
      <Popover.Anchor class="w-full">{props.children}</Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          class="flex flex-col rounded-xl border border-border bg-surface-overlay shadow-xl overflow-hidden"
          style={{
            "max-height": "min(80vh, 36rem)",
            "min-width": "min(20rem, 85vw)",
            "max-width": "min(calc(100vw - 2rem), 42rem)",
            "z-index": baseZIndex,
          }}
        >
          <Show when={triggerMatch()}>
            {(match) => (
              <AgentFinder
                workspaceId={props.workspaceId}
                query={match().query}
                interactive={isInteractive()}
                confirmLabel="insert"
                openPopoverIndex={openPopoverIndex}
                setOpenPopoverIndex={setOpenPopoverIndex}
                {...(props.currentAgentId ? { currentAgentId: props.currentAgentId } : {})}
                onConfirm={(selection) => {
                  props.onSelect({ id: selection.agentId, title: selection.title }, match().query, match().startIndex);
                }}
                onDismiss={props.onClose}
              />
            )}
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

export default AgentTypeahead;
