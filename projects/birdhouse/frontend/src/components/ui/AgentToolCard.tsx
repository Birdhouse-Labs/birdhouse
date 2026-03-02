// ABOUTME: Renders agent_create, agent_reply, agent_read, and agent_tree tool calls
// ABOUTME: All use compact inline sentence style with clickable buttons/popovers

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  MessageSquareText,
  MessagesSquare,
  Network,
} from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, Show } from "solid-js";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { fetchAgent } from "../../services/messages-api";
import type { ToolBlock } from "../../types/messages";
import { MarkdownRenderer } from "../MarkdownRenderer";
import AgentButton from "./AgentButton";
import CodeBlock from "./CodeBlock";
import MessageButton from "./MessageButton";

export interface AgentToolCardProps {
  block: ToolBlock;
  onOpenAgentModal?: ((agentId: string) => void) | undefined;
}

const AgentToolCard: Component<AgentToolCardProps> = (props) => {
  const { workspaceId } = useWorkspace();
  const [agentReplyTitle, setAgentReplyTitle] = createSignal<string | null>(null);
  const [agentReadTitle, setAgentReadTitle] = createSignal<string | null>(null);
  const [isTreeExpanded, setIsTreeExpanded] = createSignal(false);

  const isAgentCreate = () => props.block.name === "agent_create";
  const isAgentReply = () => props.block.name === "agent_reply";
  const isAgentRead = () => props.block.name === "agent_read";
  const isAgentTree = () => props.block.name === "agent_tree";

  // Extract metadata from input
  const metadata = createMemo(() => {
    const input = props.block.input;

    if (isAgentCreate()) {
      const title = input["title"] as string;
      const model = input["model"] as string;
      const prompt = input["prompt"] as string;
      return {
        title: title || "Untitled Agent",
        model: model || "",
        prompt: prompt || "",
      };
    }

    if (isAgentReply()) {
      const agentId = input["agent_id"] as string;
      const message = input["message"] as string;
      return {
        agentId: agentId || "",
        message: message || "",
      };
    }

    if (isAgentRead()) {
      const agentId = input["agent_id"] as string;
      const skipWait = input["skip_wait"] as boolean | undefined;
      const latestTurn = input["latest_turn"] as boolean | undefined;
      const all = input["all"] as boolean | undefined;
      return {
        agentId: agentId || "",
        skipWait,
        latestTurn,
        all,
      };
    }

    return null;
  });

  // Extract created agent ID from output (when completed)
  const createdAgentId = createMemo(() => {
    if (isAgentCreate() && props.block.status === "completed" && props.block.output) {
      const output = props.block.output.trim();

      // Try to extract agent_id from the output
      // Output format: "✅ Agent agent_abc123 completed" or similar
      // Agent IDs can contain alphanumeric chars, hyphens, and underscores
      const match = output.match(/agent_[a-zA-Z0-9_-]+/);
      if (match) {
        return match[0];
      }

      // Try JSON parsing as fallback
      try {
        const parsed = JSON.parse(output);
        if (parsed.agent_id) return parsed.agent_id;
        if (parsed.id) return parsed.id;
      } catch {
        // Not JSON, continue
      }

      return null;
    }
    return null;
  });

  // Parse agent_read output to get message count
  const agentReadInfo = createMemo(() => {
    if (isAgentRead() && props.block.status === "completed" && props.block.output) {
      try {
        const output = props.block.output.trim();
        const parsed = JSON.parse(output);

        // Handle array of messages
        if (Array.isArray(parsed)) {
          return { messageCount: parsed.length };
        }

        // Handle single message object
        if (parsed.id && parsed.role) {
          return { messageCount: 1 };
        }

        return null;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Parse agent_tree output to get agent count
  const agentTreeInfo = createMemo(() => {
    if (isAgentTree() && props.block.status === "completed" && props.block.output) {
      const output = props.block.output.trim();
      // Count lines with birdhouse:agent/ links
      const agentCount = (output.match(/birdhouse:agent\//g) || []).length;
      return {
        agentCount,
        treeMarkdown: output,
      };
    }
    return null;
  });

  // Status icon
  const statusIcon = () => {
    switch (props.block.status) {
      case "pending":
      case "running":
        return <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />;
      case "completed":
        return <CheckCircle2 size={16} class="text-green-600 dark:text-green-400" />;
      case "error":
        return <AlertCircle size={16} class="text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  // Duration from metadata (only shown for completed/error states)
  const duration = createMemo(() => {
    if (props.block.status === "pending" || props.block.status === "running") {
      return undefined;
    }
    const ms = props.block.metadata?.["duration"] as number | undefined;
    return ms ? `${(ms / 1000).toFixed(1)}s` : undefined;
  });

  // Fetch agent title for agent_reply mode
  createEffect(() => {
    if (isAgentReply() && metadata()?.agentId) {
      const agentId = metadata()?.agentId || "";
      if (agentId) {
        fetchAgent(workspaceId, agentId)
          .then((agent) => {
            setAgentReplyTitle(agent.title || null);
          })
          .catch(() => {
            setAgentReplyTitle(null);
          });
      }
    }
  });

  // Fetch agent title for agent_read mode
  createEffect(() => {
    if (isAgentRead() && metadata()?.agentId) {
      const agentId = metadata()?.agentId || "";
      if (agentId) {
        fetchAgent(workspaceId, agentId)
          .then((agent) => {
            setAgentReadTitle(agent.title || null);
          })
          .catch(() => {
            setAgentReadTitle(null);
          });
      }
    }
  });

  // Prefix text based on status for agent_reply (before the [reply] button)
  const replyPrefix = createMemo(() => {
    switch (props.block.status) {
      case "pending":
      case "running":
        return "Sending";
      case "completed":
        return "Sent";
      case "error":
        return "Failed to send";
      default:
        return "Sent";
    }
  });

  // Prefix text based on status for agent_create (before the [AgentButton])
  const createPrefix = createMemo(() => {
    switch (props.block.status) {
      case "pending":
      case "running":
        return "Creating";
      case "completed":
        return "Created";
      case "error":
        return "Failed to create";
      default:
        return "Created";
    }
  });

  // Prefix text based on status for agent_read
  const readPrefix = createMemo(() => {
    switch (props.block.status) {
      case "pending":
      case "running":
        return "Reading";
      case "completed":
        return "Read";
      case "error":
        return "Failed to read";
      default:
        return "Read";
    }
  });

  // Readable description of what was read (for agent_read)
  const readDescription = createMemo(() => {
    const meta = metadata();
    if (!isAgentRead() || !meta) return null;

    const parts: string[] = [];

    // What was read
    if (meta.all) {
      parts.push("all messages");
    } else if (meta.latestTurn) {
      parts.push("latest turn");
    } else if (agentReadInfo()?.messageCount) {
      const count = agentReadInfo()?.messageCount || 0;
      parts.push(`${count} message${count === 1 ? "" : "s"}`);
    } else {
      // Default: reads last message (mode='last' in plugin)
      parts.push("last message");
    }

    return parts.join(" ");
  });

  // Prefix text based on status for agent_tree
  const treePrefix = createMemo(() => {
    switch (props.block.status) {
      case "pending":
      case "running":
        return "Viewing";
      case "completed":
        return "Viewed";
      case "error":
        return "Failed to view";
      default:
        return "Viewed";
    }
  });

  // Render agent_tree as collapsible card (like ReasoningBlock)
  if (isAgentTree()) {
    return (
      <div
        class="my-2 overflow-hidden rounded-lg border group/toolcard transition-colors"
        classList={{
          "border-border": isTreeExpanded(),
          "border-transparent hover:border-border": !isTreeExpanded(),
        }}
      >
        {/* Header - one line */}
        <button
          type="button"
          onClick={() => setIsTreeExpanded(!isTreeExpanded())}
          class="w-full px-3 py-2 flex items-center gap-2 bg-transparent hover:bg-surface-overlay/50 border-b border-transparent hover:border-border transition-colors"
          aria-expanded={isTreeExpanded()}
        >
          {/* Icon: Network normally, Chevron on hover */}
          <div class="flex-shrink-0 relative w-4 h-4">
            <div class="absolute inset-0 opacity-100 group-hover/toolcard:opacity-0 transition-opacity flex items-center justify-center">
              <Network size={16} class="text-accent" />
            </div>
            <div class="absolute inset-0 opacity-0 group-hover/toolcard:opacity-100 transition-opacity flex items-center justify-center">
              {isTreeExpanded() ? (
                <ChevronUp size={16} class="text-text-secondary" />
              ) : (
                <ChevronDown size={16} class="text-text-secondary" />
              )}
            </div>
          </div>

          {/* Label */}
          <span class="text-sm text-text-secondary flex-shrink-0">{treePrefix()} tree</span>

          {/* Agent count */}
          <Show when={agentTreeInfo()?.agentCount}>
            {(count) => (
              <span class="text-sm text-text-primary flex-shrink-0">
                {count()} agent{count() === 1 ? "" : "s"}
              </span>
            )}
          </Show>

          {/* Duration on the right */}
          <div class="ml-auto flex items-center gap-2">
            <Show when={duration()}>
              <span class="text-xs text-text-muted">{duration()}</span>
            </Show>
            <span class="text-sm">{statusIcon()}</span>
          </div>
        </button>

        {/* Expanded tree content */}
        <Show when={isTreeExpanded()}>
          <div class="px-3 py-3 bg-surface-raised max-h-96 overflow-y-auto">
            <Show when={agentTreeInfo()?.treeMarkdown}>
              {(markdown) => (
                <MarkdownRenderer
                  content={markdown()}
                  workspaceId={workspaceId}
                  class="text-sm"
                  onReferenceLinkClick={(reference) => {
                    if (reference.type === "agent") {
                      props.onOpenAgentModal?.(reference.identifier);
                    }
                  }}
                />
              )}
            </Show>
          </div>
        </Show>

        {/* Error display */}
        <Show when={props.block.error}>
          <div class="px-3 py-2 bg-surface-raised border-t border-border">
            <CodeBlock code={props.block.error || ""} language="text" theme="github-dark" />
          </div>
        </Show>
      </div>
    );
  }

  // Render agent_read as compact inline sentence
  if (isAgentRead()) {
    const agentId = () => metadata()?.agentId || "";
    const agentTitle = () => agentReadTitle() || agentId();

    return (
      <div class="my-2 px-3 py-1.5">
        {/* Inline sentence: "[Icon] Read from [AgentButton]" */}
        <div class="flex items-center gap-1.5 flex-wrap">
          {/* Leading icon */}
          <MessageSquareText size={16} class="text-text-primary flex-shrink-0" />

          {/* Prefix: "Read" / "Reading" / "Failed to read" */}
          <span class="text-sm text-text-secondary">{readPrefix()}</span>

          {/* Description of what was read */}
          <Show when={readDescription()}>
            <span class="text-sm text-text-primary font-medium">{readDescription()}</span>
          </Show>

          {/* "from" */}
          <span class="text-sm text-text-secondary">from</span>

          {/* Agent button */}
          <Show when={agentId()}>
            <AgentButton
              agentId={agentId()}
              showIcon={true}
              class="text-sm"
              onClick={() => props.onOpenAgentModal?.(agentId())}
            >
              {agentTitle()}
            </AgentButton>
          </Show>

          {/* Duration and status on the right */}
          <div class="ml-auto flex items-center gap-2">
            <Show when={duration()}>
              <span class="text-xs text-text-muted">{duration()}</span>
            </Show>
            <span class="text-sm">{statusIcon()}</span>
          </div>
        </div>

        {/* Error display (inline, below) */}
        <Show when={props.block.error}>
          <div class="mt-2">
            <CodeBlock code={props.block.error || ""} language="text" theme="github-dark" />
          </div>
        </Show>
      </div>
    );
  }

  // Render agent_reply as compact inline sentence
  if (isAgentReply()) {
    const agentId = () => metadata()?.agentId || "";
    const agentTitle = () => agentReplyTitle() || agentId();

    return (
      <div class="my-2 px-3 py-1.5">
        {/* Inline sentence: "[Icon] Sent [reply] to [AgentButton]" */}
        <div class="flex items-center gap-1.5 flex-wrap">
          {/* Leading icon */}
          <MessagesSquare size={16} class="text-text-primary flex-shrink-0" />

          {/* Prefix: "Sent" / "Sending" / "Failed to send" */}
          <span class="text-sm text-text-secondary">{replyPrefix()}</span>

          {/* Message button with popover: "reply" */}
          <Show when={metadata()?.message}>
            {(message) => (
              <MessageButton
                showIcon={true}
                popoverTitle="Reply"
                content={message()}
                class="text-sm"
                timestamp={props.block.timestamp}
              >
                reply
              </MessageButton>
            )}
          </Show>

          {/* "to" */}
          <span class="text-sm text-text-secondary">to</span>

          {/* Agent button */}
          <Show when={agentId()}>
            <AgentButton
              agentId={agentId()}
              showIcon={true}
              class="text-sm"
              onClick={() => props.onOpenAgentModal?.(agentId())}
            >
              {agentTitle()}
            </AgentButton>
          </Show>

          {/* Duration and status on the right */}
          <div class="ml-auto flex items-center gap-2">
            <Show when={duration()}>
              <span class="text-xs text-text-muted">{duration()}</span>
            </Show>
            <span class="text-sm">{statusIcon()}</span>
          </div>
        </div>

        {/* Error display (inline, below) */}
        <Show when={props.block.error}>
          <div class="mt-2">
            <CodeBlock code={props.block.error || ""} language="text" theme="github-dark" />
          </div>
        </Show>
      </div>
    );
  }

  // Render agent_create as compact inline sentence
  return (
    <div class="my-2 px-3 py-1.5">
      {/* Inline sentence: "[Icon] Created [AgentButton] with [prompt]" */}
      <div class="flex items-center gap-1.5 flex-wrap">
        {/* Leading icon */}
        <MessageSquarePlus size={16} class="text-text-primary flex-shrink-0" />

        {/* Prefix: "Created" / "Creating" / "Failed to create" */}
        <span class="text-sm text-text-secondary">{createPrefix()}</span>

        {/* Agent button (when completed) or plain text (when pending/error) */}
        <Show
          when={props.block.status === "completed" && createdAgentId()}
          fallback={
            <span class="inline-flex items-center gap-1 text-sm font-medium text-text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="14"
                height="14"
                class="lucide lucide-bot text-text-secondary"
                aria-hidden="true"
              >
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
              {metadata()?.title}
            </span>
          }
        >
          {(agentId) => (
            <AgentButton
              agentId={typeof agentId === "string" ? agentId : String(agentId())}
              showIcon={true}
              class="text-sm"
              onClick={() => {
                const id = typeof agentId === "string" ? agentId : String(agentId());
                props.onOpenAgentModal?.(id);
              }}
            >
              {metadata()?.title}
            </AgentButton>
          )}
        </Show>

        {/* "with" */}
        <span class="text-sm text-text-secondary">with</span>

        {/* Prompt button with popover */}
        <Show when={metadata()?.prompt}>
          {(prompt) => (
            <MessageButton
              showIcon={true}
              popoverTitle="Message"
              content={prompt()}
              class="text-sm"
              timestamp={props.block.timestamp}
            >
              message
            </MessageButton>
          )}
        </Show>

        {/* Duration and status on the right */}
        <div class="ml-auto flex items-center gap-2">
          <Show when={duration()}>
            <span class="text-xs text-text-muted">{duration()}</span>
          </Show>
          <span class="text-sm">{statusIcon()}</span>
        </div>
      </div>

      {/* Error display (inline, below) */}
      <Show when={props.block.error}>
        <div class="mt-2">
          <CodeBlock code={props.block.error || ""} language="text" theme="github-dark" />
        </div>
      </Show>
    </div>
  );
};

export default AgentToolCard;
