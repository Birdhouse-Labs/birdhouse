// ABOUTME: Floating @@ typeahead wrapper around the shared AgentFinder component.
// ABOUTME: Parses the active trigger near the cursor and maps confirmation back to text replacement.

import { autoUpdate, flip, offset, shift, size } from "@floating-ui/dom";
import { useFloating } from "solid-floating-ui";
import { type Component, createMemo, createSignal, Show } from "solid-js";
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

  const triggerMatch = createMemo(() => findAgentTrigger(props.inputValue, props.cursorPosition));

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

  const isInteractive = createMemo(() => {
    const topModalType = modalStack().at(-1)?.type;

    if (props.insideAgentModal) {
      return topModalType === "agent";
    }

    return topModalType === undefined;
  });
  const shouldShow = createMemo(() => props.visible && triggerMatch() !== null);

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
