// ABOUTME: Agent typeahead dropdown for message input with keyboard navigation
// ABOUTME: Shows agent suggestions when user types @@, supports instant arrow key selection

import { autoUpdate, flip, offset, shift } from "@floating-ui/dom";
import { useFloating } from "solid-floating-ui";
import { type Component, createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { uiSize } from "../../theme";
import { getRecentlyViewedAgents } from "../../utils/agent-navigation";

interface Agent {
  id: string;
  title: string;
  status?: { type: "idle" | "busy" | "retry" };
}

export interface AgentTypeaheadProps {
  /** Reference element to position dropdown relative to */
  referenceElement: HTMLElement | undefined;
  /** Current input value to match against */
  inputValue: string;
  /** Current cursor position in the input */
  cursorPosition: number;
  /** Whether the dropdown should be visible */
  visible: boolean;
  /** Array of agents to match against */
  agents: Agent[];
  /** ID of the current agent to filter out */
  currentAgentId: string | undefined;
  /** Callback when user selects an agent */
  onSelect: (agent: Agent, matchedText: string, matchStartIndex: number) => void;
  /** Callback to close the dropdown */
  onClose: () => void;
  /** Callback when highlighted index changes (for external keyboard handling) */
  onHighlightChange?: (index: number) => void;
}

export const AgentTypeahead: Component<AgentTypeaheadProps> = (props) => {
  const baseZIndex = useZIndex();
  const [highlightedIndex, setHighlightedIndex] = createSignal(0);
  let listRef: HTMLElement | undefined;

  // Find agents that match "@@" trigger
  // Returns agents that match the trigger + the matched text and its position
  interface MatchResult {
    agent: Agent;
    matchedText: string; // What the user actually typed after @@
    startIndex: number; // Where @@ starts in the input
  }

  // Build list of recently viewed agents, excluding current agent
  const getRecentAgentsList = (): Agent[] => {
    const recent = getRecentlyViewedAgents();
    const result: Agent[] = [];
    const seenIds = new Set<string>();

    for (const record of recent) {
      // Skip the current agent
      if (props.currentAgentId && record.agentId === props.currentAgentId) {
        continue;
      }

      const agent = props.agents.find((a) => a.id === record.agentId);
      if (agent && !seenIds.has(agent.id)) {
        seenIds.add(agent.id);
        result.push(agent);
      }
    }

    return result;
  };

  // Find agents matching text after @@
  const findMatchesForText = (recentAgents: Agent[], textAfterTrigger: string, startIndex: number): MatchResult[] => {
    const textLower = textAfterTrigger.toLowerCase();
    const results: MatchResult[] = [];

    // If nothing typed, return all recent agents
    if (textLower.length === 0) {
      for (const agent of recentAgents) {
        results.push({
          agent,
          matchedText: "",
          startIndex,
        });
      }
      return results;
    }

    // Filter agents by typed text
    for (const agent of recentAgents) {
      if (agent.title.toLowerCase().startsWith(textLower)) {
        results.push({
          agent,
          matchedText: textAfterTrigger,
          startIndex,
        });
      }
    }

    return results;
  };

  const findMatches = (_agents: Agent[]): MatchResult[] => {
    const text = props.inputValue;
    const cursor = props.cursorPosition;

    // Only look at text UP TO cursor position
    const textBeforeCursor = text.substring(0, cursor);

    // Try progressively longer substrings ending at cursor position
    // Look back up to 50 characters (plenty for any agent name)
    const maxLookback = 50;
    const lookbackStart = Math.max(0, cursor - maxLookback);

    // Get recently viewed agents list once
    const recentAgents = getRecentAgentsList();

    // Try each possible starting position in the lookback window
    for (let start = lookbackStart; start < cursor; start++) {
      const substring = textBeforeCursor.substring(start);

      // Check if this position has @@ trigger (but not @@@ which is the model trigger)
      if (substring.startsWith("@@") && textBeforeCursor[start - 1] !== "@") {
        const matchedAfterTrigger = substring.substring(2); // Everything after @@
        const results = findMatchesForText(recentAgents, matchedAfterTrigger, start);

        // Return results if we found any or nothing was typed after @@
        if (results.length > 0) {
          return results;
        }
      }
    }

    return [];
  };

  // Display agents from findMatches (single source of truth)
  const displayAgents = (): Agent[] => {
    const matches = findMatches(props.agents);
    const seenIds = new Set<string>();
    const result: Agent[] = [];

    for (const match of matches) {
      if (!seenIds.has(match.agent.id)) {
        seenIds.add(match.agent.id);
        result.push(match.agent);
      }
    }

    return result;
  };

  // Get the best match for the currently highlighted agent (for text replacement)
  const getBestMatch = (agent: Agent): MatchResult | undefined => {
    const matches = findMatches(props.agents);
    return matches.find((m) => m.agent.id === agent.id);
  };

  // Setup floating UI for dropdown positioning
  const [floating, setFloating] = createSignal<HTMLElement>();

  const position = useFloating(() => props.referenceElement, floating, {
    placement: "top-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Reset highlight when displayed results change
  createEffect(() => {
    displayAgents();
    setHighlightedIndex(0);
  });

  // Scroll highlighted option into view
  createEffect(() => {
    if (props.visible && listRef) {
      const highlightedEl = listRef.children[highlightedIndex()] as HTMLElement;
      highlightedEl?.scrollIntoView({ block: "nearest" });
    }
  });

  // Notify parent of highlight changes
  createEffect(() => {
    props.onHighlightChange?.(highlightedIndex());
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    const displayed = displayAgents();
    if (displayed.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, displayed.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter": {
        // Only handle plain Enter - let Cmd/Ctrl/Shift+Enter pass through
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          return;
        }
        e.preventDefault();
        const selected = displayed[highlightedIndex()];
        if (selected) {
          const match = getBestMatch(selected);
          if (match) {
            props.onSelect(selected, match.matchedText, match.startIndex);
          }
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  // Listen for keyboard events globally when visible
  createEffect(() => {
    if (props.visible) {
      document.addEventListener("keydown", handleKeyDown);
      onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
    }
  });

  // Size classes based on uiSize setting
  const sizeClasses = () => {
    const size = uiSize();
    return {
      option: size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
      status: size === "sm" ? "text-xs" : size === "md" ? "text-xs" : "text-xs",
    };
  };

  // Get status display
  const getStatusDisplay = (status?: { type: "idle" | "busy" | "retry" }) => {
    if (!status) return "unknown";
    return status.type;
  };

  // Get status color
  const getStatusColor = (status?: { type: "idle" | "busy" | "retry" }) => {
    if (!status) return "text-text-muted";
    switch (status.type) {
      case "idle":
        return "text-text-secondary";
      case "busy":
        return "text-accent";
      case "retry":
        return "text-warn";
      default:
        return "text-text-muted";
    }
  };

  const shouldShow = () => {
    const displayed = displayAgents();
    return props.visible && displayed.length > 0;
  };

  return (
    <Show when={shouldShow()}>
      <div
        ref={(el) => {
          listRef = el;
          setFloating(el);
        }}
        class="rounded-xl border shadow-xl overflow-y-auto bg-surface-overlay border-border"
        style={{
          position: position.strategy,
          top: `${position.y ?? 0}px`,
          left: `${position.x ?? 0}px`,
          "max-height": "16rem",
          "min-width": "20rem",
          "z-index": baseZIndex,
        }}
      >
        <For each={displayAgents()}>
          {(agent, index) => (
            <div
              role="option"
              tabIndex={-1}
              aria-selected={highlightedIndex() === index()}
              class="px-3 py-2 cursor-pointer transition-colors"
              classList={{
                [sizeClasses().option]: true,
                "bg-gradient-from/30 text-text-primary": highlightedIndex() === index(),
                "hover:bg-surface-raised": highlightedIndex() !== index(),
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => {
                const match = getBestMatch(agent);
                if (match) {
                  props.onSelect(agent, match.matchedText, match.startIndex);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const match = getBestMatch(agent);
                  if (match) {
                    props.onSelect(agent, match.matchedText, match.startIndex);
                  }
                }
              }}
              onMouseEnter={() => {
                setHighlightedIndex(index());
              }}
            >
              <div>
                <div class="font-medium text-text-primary">{agent.title}</div>
                <div class={`${sizeClasses().status} mt-0.5 ${getStatusColor(agent.status)}`}>
                  {getStatusDisplay(agent.status)}
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

export default AgentTypeahead;
