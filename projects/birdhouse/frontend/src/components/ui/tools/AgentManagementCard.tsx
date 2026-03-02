// ABOUTME: Renders agent_read, agent_tree, and skill tool calls as minimal one-line collapsibles
// ABOUTME: Shows operation type, agent/skill info, with expandable structured output

import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Network, Zap } from "lucide-solid";
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import type { ToolBlock } from "../../../types/messages";
import Button from "../Button";
import CodeBlock from "../CodeBlock";

export interface AgentManagementCardProps {
  block: ToolBlock;
  onOpenAgentModal?: ((agentId: string) => void) | undefined;
}

// ABOUTME: Type for parsed agent_tree structure
interface TreeNode {
  id: string;
  title: string;
  model: string;
  level: number;
  isCurrentAgent?: boolean;
}

const AgentManagementCard: Component<AgentManagementCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const isAgentRead = () => props.block.name === "agent_read";
  const isAgentTree = () => props.block.name === "agent_tree";
  const isSkill = () => props.block.name === "skill";

  // ABOUTME: Extract metadata from input
  const metadata = createMemo(() => {
    const input = props.block.input;

    if (isAgentRead()) {
      return {
        agentId: (input["agent_id"] as string) || "",
        skipWait: input["skip_wait"] as boolean | undefined,
        latestTurn: input["latest_turn"] as boolean | undefined,
        all: input["all"] as boolean | undefined,
      };
    }

    if (isAgentTree()) {
      return {
        operation: "tree",
      };
    }

    if (isSkill()) {
      return {
        skillName: (input["name"] as string) || "",
      };
    }

    return null;
  });

  // ABOUTME: Parse agent_read output to extract message info
  const agentReadInfo = createMemo(() => {
    if (!isAgentRead() || props.block.status !== "completed" || !props.block.output) {
      return null;
    }

    try {
      const output = props.block.output.trim();
      const parsed = JSON.parse(output);

      // Handle array of messages
      if (Array.isArray(parsed)) {
        return {
          messageCount: parsed.length,
          messages: parsed,
          model: parsed[0]?.model || null,
        };
      }

      // Handle single message object
      if (parsed.id && parsed.role) {
        return {
          messageCount: 1,
          messages: [parsed],
          model: parsed.model || null,
        };
      }

      return null;
    } catch {
      return null;
    }
  });

  // ABOUTME: Parse agent_tree output to extract tree structure
  const treeInfo = createMemo(() => {
    if (!isAgentTree() || props.block.status !== "completed" || !props.block.output) {
      return null;
    }

    try {
      const output = props.block.output.trim();

      // Parse tree structure from text output
      // Format: "├─ [agent_id] Title (model) [THIS IS YOU]"
      const lines = output.split("\n");
      const nodes: TreeNode[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        // Calculate indentation level
        const indent = line.search(/[^\s│├└─]/);
        const level = Math.floor(indent / 2);

        // Extract agent ID
        const idMatch = line.match(/\[([^\]]+)\]/);
        const agentId = idMatch ? idMatch[1] : "";

        // Extract title (text between ] and ()
        const titleMatch = line.match(/\]\s+([^(]+)/);
        const title = (titleMatch?.[1]?.trim() ?? "") as string;

        // Extract model
        const modelMatch = line.match(/\(([^)]+)\)/);
        const model = (modelMatch ? modelMatch[1] : "") as string;

        // Check if current agent
        const isCurrentAgent = line.includes("[THIS IS YOU]");

        if (agentId) {
          nodes.push({ id: agentId, title, model, level, isCurrentAgent });
        }
      }

      return {
        totalAgents: nodes.length,
        nodes,
        rawOutput: output,
      };
    } catch {
      return null;
    }
  });

  // ABOUTME: Parse skill output to extract documentation
  const skillInfo = createMemo(() => {
    if (!isSkill() || props.block.status !== "completed" || !props.block.output) {
      return null;
    }

    try {
      const output = props.block.output.trim();
      const parsed = JSON.parse(output);

      return {
        name: parsed.name || metadata()?.skillName || "",
        description: parsed.description || "",
        documentation: (parsed.documentation as string | undefined) || output,
      };
    } catch {
      // Fallback: treat output as raw documentation
      return {
        name: metadata()?.skillName || "",
        description: "",
        documentation: props.block.output ?? "",
      };
    }
  });

  // ABOUTME: Status icon component
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

  // ABOUTME: Duration from metadata
  const duration = createMemo(() => {
    const ms = props.block.metadata?.["duration"] as number | undefined;
    return ms ? `${(ms / 1000).toFixed(1)}s` : undefined;
  });

  // ABOUTME: Operation label for header
  const operationLabel = createMemo(() => {
    if (isAgentRead()) return "Read Agent";
    if (isAgentTree()) return "Agent Tree";
    if (isSkill()) return "Load Skill";
    return "";
  });

  // ABOUTME: Primary info for header (agent ID, skill name, etc)
  const primaryInfo = createMemo(() => {
    if (isAgentRead()) {
      const flags = [];
      if (metadata()?.skipWait) flags.push("skip_wait");
      if (metadata()?.latestTurn) flags.push("latest_turn");
      if (metadata()?.all) flags.push("all");

      const flagsStr = flags.length > 0 ? ` (${flags.join(", ")})` : "";
      return `${metadata()?.agentId}${flagsStr}`;
    }

    if (isAgentTree()) {
      if (treeInfo()) {
        return `${treeInfo()?.totalAgents} agent${treeInfo()?.totalAgents === 1 ? "" : "s"}`;
      }
      return "";
    }

    if (isSkill()) {
      return metadata()?.skillName || "";
    }

    return "";
  });

  // ABOUTME: Secondary info for header (message count, etc)
  const secondaryInfo = createMemo(() => {
    if (isAgentRead() && agentReadInfo()) {
      const info = agentReadInfo();
      if (!info) return "";
      return `${info.messageCount} message${info.messageCount === 1 ? "" : "s"}`;
    }
    return "";
  });

  return (
    <div
      class="my-2 overflow-hidden rounded-lg border group/toolcard transition-colors"
      classList={{
        "border-border": isExpanded(),
        "border-transparent hover:border-border": !isExpanded(),
      }}
    >
      {/* ABOUTME: Header - one line with icon, operation type, info, status */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full px-3 py-2 flex items-center gap-2 bg-transparent hover:bg-surface-overlay/50 border-b border-transparent hover:border-border transition-colors"
        aria-expanded={isExpanded()}
      >
        {/* Icon: Network/Zap normally, Chevron on hover */}
        <div class="flex-shrink-0 relative w-4 h-4">
          <div class="absolute inset-0 opacity-100 group-hover/toolcard:opacity-0 transition-opacity flex items-center justify-center">
            <Show when={isAgentTree()}>
              <Network size={16} class="text-accent" />
            </Show>
            <Show when={isAgentRead() || isSkill()}>
              <Zap size={16} class="text-accent" />
            </Show>
          </div>
          <div class="absolute inset-0 opacity-0 group-hover/toolcard:opacity-100 transition-opacity flex items-center justify-center">
            {isExpanded() ? (
              <ChevronUp size={16} class="text-text-secondary" />
            ) : (
              <ChevronDown size={16} class="text-text-secondary" />
            )}
          </div>
        </div>

        {/* Operation label */}
        <span class="text-sm font-medium text-accent">{operationLabel()}</span>

        {/* Primary info (agent ID, skill name, agent count) */}
        <Show when={primaryInfo()}>
          <span class="text-sm text-text-primary font-mono truncate">{primaryInfo()}</span>
        </Show>

        {/* Secondary info (message count) */}
        <Show when={secondaryInfo()}>
          <span class="text-xs text-text-secondary">{secondaryInfo()}</span>
        </Show>

        {/* Duration and status on the right */}
        <div class="ml-auto flex items-center gap-2">
          <Show when={duration()}>
            <span class="text-xs text-text-muted">{duration()}</span>
          </Show>
          <span class="text-sm">{statusIcon()}</span>
        </div>
      </button>

      {/* ABOUTME: Expanded content - structured output display */}
      <Show when={isExpanded()}>
        <div class="px-3 py-3 space-y-3 bg-surface-raised">
          {/* ABOUTME: agent_read output - message summary */}
          <Show when={isAgentRead() && agentReadInfo()}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">Messages</div>
              <div class="space-y-2">
                <div class="text-sm text-text-primary">
                  <span class="font-medium">{agentReadInfo()?.messageCount}</span> message
                  {agentReadInfo()?.messageCount === 1 ? "" : "s"} retrieved
                </div>
                <Show when={agentReadInfo()?.model}>
                  <div class="text-sm text-text-secondary">
                    Model: <span class="font-mono">{agentReadInfo()?.model}</span>
                  </div>
                </Show>
                {/* Message list preview */}
                <div class="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  <For each={agentReadInfo()?.messages.slice(0, 5)}>
                    {(msg: { role?: string; content?: string }) => (
                      <div class="text-xs text-text-muted font-mono">
                        {msg.role}: {msg.content?.substring(0, 60) || "(no content)"}
                        {(msg.content?.length || 0) > 60 ? "..." : ""}
                      </div>
                    )}
                  </For>
                  <Show when={(agentReadInfo()?.messageCount ?? 0) > 5}>
                    <div class="text-xs text-text-muted italic">
                      ... and {(agentReadInfo()?.messageCount ?? 0) - 5} more
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          </Show>

          {/* ABOUTME: agent_tree output - tree visualization */}
          <Show when={isAgentTree() && treeInfo()}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">Agent Hierarchy</div>
              <div class="space-y-1">
                <div class="text-sm text-text-primary mb-2">
                  <span class="font-medium">{treeInfo()?.totalAgents}</span> agent
                  {treeInfo()?.totalAgents === 1 ? "" : "s"} in tree
                </div>
                {/* Tree structure */}
                <div class="font-mono text-xs bg-surface/50 p-2 rounded border border-border max-h-64 overflow-y-auto">
                  <pre class="whitespace-pre text-text-primary">{treeInfo()?.rawOutput}</pre>
                </div>
              </div>
            </div>
          </Show>

          {/* ABOUTME: skill output - documentation display */}
          <Show when={isSkill() && skillInfo()}>
            <div class="border-l-4 border-accent/40 pl-3 py-1">
              <div class="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2">
                Skill Documentation
              </div>
              <div class="space-y-2">
                <Show when={skillInfo()?.name}>
                  <div class="text-sm text-text-primary font-mono font-medium">{skillInfo()?.name}</div>
                </Show>
                <Show when={skillInfo()?.description}>
                  <div class="text-sm text-text-secondary">{skillInfo()?.description}</div>
                </Show>
                {/* Skill documentation */}
                <div class="mt-2 max-h-64 overflow-y-auto">
                  <div class="bg-surface/50 rounded border border-border overflow-hidden">
                    <CodeBlock code={skillInfo()?.documentation || ""} language="markdown" theme="github-dark" />
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* ABOUTME: Error message if present */}
          <Show when={props.block.error}>
            <div class="text-sm text-red-600 dark:text-red-400">
              <span class="font-medium">Error: </span>
              {props.block.error}
            </div>
          </Show>

          {/* ABOUTME: View Agent button (for agent_read) */}
          <Show when={isAgentRead() && metadata()?.agentId}>
            <div class="flex gap-2">
              <Button
                variant="tertiary"
                onClick={() => {
                  const agentId = metadata()?.agentId;
                  if (agentId) {
                    props.onOpenAgentModal?.(agentId);
                  }
                }}
              >
                View Agent
              </Button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default AgentManagementCard;
