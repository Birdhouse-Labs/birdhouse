// ABOUTME: Floating @@ typeahead wrapper around the shared AgentFinder component.
// ABOUTME: Parses the active trigger near the cursor and maps confirmation back to text replacement.

import { autoUpdate, flip, offset, shift, size } from "@floating-ui/dom";
import { useFloating } from "solid-floating-ui";
import { type Component, createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { useModalRoute } from "../../lib/routing";
import AgentFinder from "../AgentFinder";

export interface AgentTypeaheadSelection {
  id: string;
  title: string;
}

export interface AgentTypeaheadProps {
  referenceElement: HTMLElement | undefined;
  inputValue: string;
  cursorPosition: number;
  visible: boolean;
  workspaceId: string;
  currentAgentId: string | undefined;
  insideAgentModal?: boolean | undefined;
  onSelect: (agent: AgentTypeaheadSelection, matchedText: string, matchStartIndex: number) => void;
  onClose: () => void;
}

interface TriggerMatch {
  query: string;
  startIndex: number;
}

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
  const [floating, setFloating] = createSignal<HTMLElement>();
  const [maxWidth, setMaxWidth] = createSignal<number | undefined>();
  const [ownerModalDepth, setOwnerModalDepth] = createSignal<number | null>(null);
  const [openPopoverIndex, setOpenPopoverIndex] = createSignal<number | null>(null);

  const triggerMatch = createMemo(() => findAgentTrigger(props.inputValue, props.cursorPosition));
  const shouldShow = createMemo(() => props.visible && triggerMatch() !== null);

  const position = useFloating(() => props.referenceElement, floating, {
    placement: "top-start",
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({
        padding: 16,
        apply({ availableWidth }) {
          setMaxWidth(availableWidth);
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  createEffect(() => {
    if (!shouldShow()) {
      setOwnerModalDepth(null);
      setOpenPopoverIndex(null);
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
    if (!shouldShow()) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!isInteractive()) return;
      if (openPopoverIndex() !== null) return;
      e.preventDefault();
      props.onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={shouldShow() && triggerMatch()}>
      {(match) => (
        <div
          ref={setFloating}
          class="flex flex-col rounded-xl border border-border bg-surface-overlay shadow-xl overflow-hidden"
          style={{
            position: position.strategy,
            top: `${position.y ?? 0}px`,
            left: `${position.x ?? 0}px`,
            "max-height": "min(80vh, 36rem)",
            "min-width": "min(20rem, 85vw)",
            "max-width": maxWidth() !== undefined ? `min(${maxWidth()}px, 42rem)` : "min(calc(100vw - 2rem), 42rem)",
            "z-index": baseZIndex,
          }}
        >
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
        </div>
      )}
    </Show>
  );
};

export default AgentTypeahead;
