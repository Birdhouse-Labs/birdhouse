// ABOUTME: Renders matched message content for the agent search results popover.
// ABOUTME: Handles snippet windowing, match highlighting, bubble layout, and tool call display.

import { type Component, For, Show } from "solid-js";
import type { AgentMessageSearchResult, MessagePart } from "../../services/agents-api";
import MessageBubble from "./MessageBubble";

// ============================================================================
// Constants
// ============================================================================

const MATCH_CONTEXT_CHARS = 64;

// ============================================================================
// Bubble layout
// ============================================================================

interface BubbleLayout {
  justify: "start" | "center" | "end";
  background: string;
  boxShadow: string;
  maxWidth: string;
  gradientBackground?: string;
}

export function getAssistantBubbleProps(): BubbleLayout {
  return {
    justify: "start",
    background: "var(--theme-surface-raised)",
    boxShadow: "0 0 0 1px color-mix(in srgb, var(--theme-border) 50%, transparent)",
    maxWidth: "max-w-[85%]",
  };
}

export function getUserBubbleProps(): BubbleLayout {
  return {
    justify: "end",
    background: "color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))",
    boxShadow: `0 0 0 1px color-mix(in srgb, var(--theme-accent) 30%, transparent),
      0 2px 8px -2px color-mix(in srgb, var(--theme-accent) 20%, transparent)`,
    maxWidth: "max-w-[85%]",
    gradientBackground: `linear-gradient(to bottom,
      transparent,
      color-mix(in srgb, var(--theme-accent) 15%, var(--theme-surface-raised))
    )`,
  };
}

export function getAgentSentBubbleProps(): BubbleLayout {
  return {
    justify: "center",
    background: `linear-gradient(to right,
      color-mix(in srgb, var(--theme-gradient-from) 20%, var(--theme-surface-raised)),
      color-mix(in srgb, var(--theme-gradient-via) 20%, var(--theme-surface-raised)),
      color-mix(in srgb, var(--theme-gradient-to) 20%, var(--theme-surface-raised))
    )`,
    boxShadow: `0 0 0 1px color-mix(in srgb, var(--theme-gradient-via) 40%, transparent),
      0 2px 8px -2px color-mix(in srgb, var(--theme-gradient-via) 25%, transparent)`,
    maxWidth: "max-w-[90%]",
    gradientBackground: `linear-gradient(to bottom,
      transparent,
      color-mix(in srgb, var(--theme-gradient-via) 20%, var(--theme-surface-raised))
    )`,
  };
}

function getMessageLayout(role: string): BubbleLayout {
  if (role === "user") return getUserBubbleProps();
  return getAssistantBubbleProps();
}

function getJustifyClass(justify: BubbleLayout["justify"]): string {
  switch (justify) {
    case "end":
      return "justify-end";
    case "center":
      return "justify-center";
    default:
      return "justify-start";
  }
}

// ============================================================================
// Snippet windowing
// ============================================================================

interface SnippetWindowData {
  key: string;
  snippet: string;
  highlightStart?: number;
  highlightEnd?: number;
}

function findMatchIndexes(text: string, query: string): number[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const normalizedText = text.toLowerCase();
  const indexes: number[] = [];
  let fromIndex = 0;

  while (fromIndex < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, fromIndex);
    if (matchIndex === -1) break;
    indexes.push(matchIndex);
    fromIndex = matchIndex + normalizedQuery.length;
  }

  return indexes;
}

function trimSnippetStart(text: string, start: number, matchStart: number): number {
  if (start === 0) return 0;
  const whitespaceOffset = text.slice(start, matchStart).search(/\s/);
  return whitespaceOffset === -1 ? start : start + whitespaceOffset + 1;
}

function trimSnippetEnd(text: string, end: number, matchEnd: number): number {
  if (end === text.length) return end;
  const suffix = text.slice(matchEnd, end);
  for (let i = suffix.length - 1; i >= 0; i -= 1) {
    if (/\s/.test(suffix[i] ?? "")) {
      return matchEnd + i;
    }
  }
  return end;
}

function createSnippetWindow(text: string, matchStart: number, matchLength: number, key: string): SnippetWindowData {
  const rawStart = Math.max(0, matchStart - MATCH_CONTEXT_CHARS);
  const rawEnd = Math.min(text.length, matchStart + matchLength + MATCH_CONTEXT_CHARS);

  const start = trimSnippetStart(text, rawStart, matchStart);
  const end = trimSnippetEnd(text, rawEnd, matchStart + matchLength);
  const trimmedStart = start > 0;
  const trimmedEnd = end < text.length;
  const prefix = trimmedStart ? "..." : "";
  const suffix = trimmedEnd ? "..." : "";
  const snippetBody = text.slice(start, end);

  return {
    key,
    snippet: `${prefix}${snippetBody}${suffix}`,
    highlightStart: prefix.length + (matchStart - start),
    highlightEnd: prefix.length + (matchStart - start) + matchLength,
  };
}

function createTextMatchWindows(text: string, query: string, keyPrefix: string): SnippetWindowData[] {
  const matchIndexes = findMatchIndexes(text, query);
  const matchLength = query.trim().length;
  if (matchLength === 0) return [];
  return matchIndexes.map((matchIndex, index) =>
    createSnippetWindow(text, matchIndex, matchLength, `${keyPrefix}-${index}`),
  );
}

function createPreviewWindow(text: string, key: string): SnippetWindowData {
  const maxLength = MATCH_CONTEXT_CHARS * 2;
  const isTrimmed = text.length > maxLength;
  return {
    key,
    snippet: isTrimmed ? `${text.slice(0, maxLength)}...` : text,
  };
}

// ============================================================================
// Components
// ============================================================================

const HighlightedSnippet: Component<{ snippet: string; highlightStart: number; highlightEnd: number }> = (props) => (
  <span class="whitespace-pre-wrap break-all">
    <span>{props.snippet.slice(0, props.highlightStart)}</span>
    <mark class="rounded bg-accent/20 px-0.5 text-accent font-semibold break-all">
      {props.snippet.slice(props.highlightStart, props.highlightEnd)}
    </mark>
    <span>{props.snippet.slice(props.highlightEnd)}</span>
  </span>
);

const MatchWindow: Component<{ window: SnippetWindowData; monospace?: boolean }> = (props) => {
  const hasHighlight = () =>
    props.window.highlightStart !== undefined &&
    props.window.highlightEnd !== undefined &&
    props.window.highlightEnd > props.window.highlightStart;

  return (
    <div
      class="rounded-md bg-surface-overlay/80 px-2.5 py-1.5 text-xs text-text-primary"
      classList={{ "font-mono whitespace-pre-wrap break-words": props.monospace }}
    >
      <Show when={hasHighlight()} fallback={<span class="whitespace-pre-wrap break-all">{props.window.snippet}</span>}>
        <HighlightedSnippet
          snippet={props.window.snippet}
          highlightStart={props.window.highlightStart ?? 0}
          highlightEnd={props.window.highlightEnd ?? 0}
        />
      </Show>
    </div>
  );
};

interface MatchMessageProps {
  parts: MessagePart[];
  role: string;
  query?: string;
}

const MatchMessage: Component<MatchMessageProps> = (props) => {
  const layout = () => getMessageLayout(props.role);
  const query = () => props.query?.trim() ?? "";

  return (
    <div class="space-y-2">
      <For each={props.parts}>
        {(part, index) => {
          if (part.type === "text") {
            const text = part.text;
            if (!query()) {
              return (
                <MessageBubble
                  message={text}
                  justify={layout().justify}
                  background={layout().background}
                  boxShadow={layout().boxShadow}
                  maxWidth={layout().maxWidth}
                  gradientBackground={layout().gradientBackground}
                />
              );
            }

            const windows = createTextMatchWindows(text, query(), `text-${index()}`);
            return (
              <For each={windows}>
                {(window) => (
                  <div class={`flex ${getJustifyClass(layout().justify)}`}>
                    <div
                      class={`${layout().maxWidth} rounded-xl px-3 py-2 text-sm text-text-primary`}
                      style={{
                        background: layout().background,
                        "box-shadow": layout().boxShadow,
                      }}
                    >
                      <MatchWindow window={window} />
                    </div>
                  </div>
                )}
              </For>
            );
          }

          if (!query()) return null;

          const commandWindows = part.command
            ? createTextMatchWindows(part.command, query(), `tool-command-${index()}`)
            : [];
          const outputWindows = part.output
            ? createTextMatchWindows(part.output, query(), `tool-output-${index()}`)
            : [];
          const commandPreviewWindow =
            part.command && commandWindows.length === 0 && outputWindows.length > 0
              ? createPreviewWindow(part.command, `tool-command-preview-${index()}`)
              : null;

          if (commandWindows.length === 0 && outputWindows.length === 0) return null;

          return (
            <div class={`flex ${getJustifyClass(layout().justify)}`}>
              <div
                class={`${layout().maxWidth} rounded-xl px-3 py-2 text-sm text-text-primary`}
                style={{
                  background: layout().background,
                  "box-shadow": layout().boxShadow,
                }}
              >
                <div class="space-y-2">
                  <div class="text-xs font-mono text-text-secondary">[{part.toolName}]</div>
                  <Show when={commandWindows.length > 0 || commandPreviewWindow}>
                    <div class="space-y-1">
                      <div class="px-0.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                        Command
                      </div>
                      <Show
                        when={commandWindows.length > 0}
                        fallback={
                          commandPreviewWindow ? <MatchWindow window={commandPreviewWindow} monospace={true} /> : null
                        }
                      >
                        <For each={commandWindows}>{(window) => <MatchWindow window={window} monospace={true} />}</For>
                      </Show>
                    </div>
                  </Show>
                  <Show when={outputWindows.length > 0}>
                    <div class="space-y-1">
                      <div class="px-0.5 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                        Output
                      </div>
                      <For each={outputWindows}>{(window) => <MatchWindow window={window} monospace={true} />}</For>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};

export interface MatchPairProps {
  match: AgentMessageSearchResult;
  query: string;
}

export const MatchPair: Component<MatchPairProps> = (props) => (
  <div class="space-y-1.5">
    <div class="px-0.5 text-[11px] text-text-secondary">
      {new Date(props.match.matchedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}
    </div>
    <div class="flex flex-col-reverse gap-2">
      <Show when={props.match.contextMessage}>{(ctx) => <MatchMessage parts={ctx().parts} role={ctx().role} />}</Show>
      <MatchMessage
        parts={props.match.matchedMessage.parts}
        role={props.match.matchedMessage.role}
        query={props.query}
      />
    </div>
  </div>
);
