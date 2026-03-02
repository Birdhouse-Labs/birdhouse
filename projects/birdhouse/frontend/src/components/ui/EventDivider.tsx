// ABOUTME: Visual divider component for displaying clone events in message timeline
// ABOUTME: Shows centered gradient pill with event type and clickable agent references (actor/source/target)

import { GitBranchPlus, Split } from "lucide-solid";
import type { Component } from "solid-js";
import { formatSmartTime } from "../../adapters/utils/time-utils";
import { uiSize } from "../../theme";
import type { AgentEventBlock } from "../../types/messages";
import AgentButton from "./AgentButton";

export interface EventDividerProps {
  block: AgentEventBlock;
  agentId: string; // Whose timeline this event is on
  onOpenAgentModal?: ((agentId: string) => void) | undefined;
}

type DisplayPart = { type: "text"; text: string } | { type: "link"; agentId: string; title: string };

/**
 * Build display for self-clone scenario (actor = source)
 */
function buildSelfCloneDisplay(
  viewingAsActor: boolean,
  viewingAsTarget: boolean,
  source_agent_id: string | null,
  source_agent_title: string,
  target_agent_id: string | null,
  target_agent_title: string,
): DisplayPart[] {
  const parts: DisplayPart[] = [];

  if (viewingAsActor) {
    // "Created [Agent D] by cloning myself"
    parts.push({ type: "text", text: "Created" });
    if (target_agent_id) {
      parts.push({ type: "link", agentId: target_agent_id, title: target_agent_title });
    }
    parts.push({ type: "text", text: "by cloning myself" });
  } else if (viewingAsTarget) {
    // "Created when [Agent A] cloned itself"
    parts.push({ type: "text", text: "Created when" });
    if (source_agent_id) {
      parts.push({ type: "link", agentId: source_agent_id, title: source_agent_title });
    }
    parts.push({ type: "text", text: "cloned itself" });
  }

  return parts;
}

/**
 * Build display for human-initiated scenario (actor = null)
 */
function buildHumanInitiatedDisplay(
  viewingAsSource: boolean,
  viewingAsTarget: boolean,
  source_agent_id: string | null,
  source_agent_title: string,
  target_agent_id: string | null,
  target_agent_title: string,
): DisplayPart[] {
  const parts: DisplayPart[] = [];

  if (viewingAsSource) {
    // "You cloned me to create [Agent D]"
    parts.push({ type: "text", text: "You cloned me to create" });
    if (target_agent_id) {
      parts.push({ type: "link", agentId: target_agent_id, title: target_agent_title });
    }
  } else if (viewingAsTarget) {
    // "Created when you cloned [Agent B]"
    parts.push({ type: "text", text: "Created when you cloned" });
    if (source_agent_id) {
      parts.push({ type: "link", agentId: source_agent_id, title: source_agent_title });
    }
  }

  return parts;
}

/**
 * Build display for normal clone scenario (actor ≠ source)
 */
function buildNormalCloneDisplay(
  viewingAsActor: boolean,
  viewingAsSource: boolean,
  viewingAsTarget: boolean,
  actor_agent_id: string | null,
  actor_agent_title: string,
  source_agent_id: string | null,
  source_agent_title: string,
  target_agent_id: string | null,
  target_agent_title: string,
): DisplayPart[] {
  const parts: DisplayPart[] = [];

  if (viewingAsActor) {
    // "Created clone [Agent C] from [Agent B]"
    parts.push({ type: "text", text: "Created clone" });
    if (target_agent_id) {
      parts.push({ type: "link", agentId: target_agent_id, title: target_agent_title });
    }
    parts.push({ type: "text", text: "from" });
    if (source_agent_id) {
      parts.push({ type: "link", agentId: source_agent_id, title: source_agent_title });
    }
  } else if (viewingAsSource) {
    // "[Agent A] cloned me to create [Agent C]"
    if (actor_agent_id) {
      parts.push({ type: "link", agentId: actor_agent_id, title: actor_agent_title });
    }
    parts.push({ type: "text", text: "cloned me to create" });
    if (target_agent_id) {
      parts.push({ type: "link", agentId: target_agent_id, title: target_agent_title });
    }
  } else if (viewingAsTarget) {
    // "Created when [Agent A] cloned [Agent B]"
    parts.push({ type: "text", text: "Created when" });
    if (actor_agent_id) {
      parts.push({ type: "link", agentId: actor_agent_id, title: actor_agent_title });
    }
    parts.push({ type: "text", text: "cloned" });
    if (source_agent_id) {
      parts.push({ type: "link", agentId: source_agent_id, title: source_agent_title });
    }
  }

  return parts;
}

/**
 * Determine display text and agent links based on viewer role
 * Uses personal pronouns (me, myself, you) for clarity
 */
function getEventDisplay(block: AgentEventBlock, viewerAgentId: string): DisplayPart[] {
  const {
    actor_agent_id,
    actor_agent_title,
    source_agent_id,
    source_agent_title,
    target_agent_id,
    target_agent_title,
  } = block;

  // Detect scenario
  const isSelfClone = actor_agent_id !== null && actor_agent_id === source_agent_id;
  const isHumanInitiated = actor_agent_id === null;

  // Determine viewer role
  const viewingAsActor = viewerAgentId === actor_agent_id;
  const viewingAsSource = viewerAgentId === source_agent_id;
  const viewingAsTarget = viewerAgentId === target_agent_id;

  // Route to appropriate builder
  if (isSelfClone) {
    return buildSelfCloneDisplay(
      viewingAsActor,
      viewingAsTarget,
      source_agent_id,
      source_agent_title,
      target_agent_id,
      target_agent_title,
    );
  }

  if (isHumanInitiated) {
    return buildHumanInitiatedDisplay(
      viewingAsSource,
      viewingAsTarget,
      source_agent_id,
      source_agent_title,
      target_agent_id,
      target_agent_title,
    );
  }

  return buildNormalCloneDisplay(
    viewingAsActor,
    viewingAsSource,
    viewingAsTarget,
    actor_agent_id,
    actor_agent_title,
    source_agent_id,
    source_agent_title,
    target_agent_id,
    target_agent_title,
  );
}

export const EventDivider: Component<EventDividerProps> = (props) => {
  const sizeClasses = () => {
    const size = uiSize();
    return {
      padding: size === "sm" ? "px-3 py-1.5" : size === "md" ? "px-4 py-2" : "px-5 py-2.5",
    };
  };

  const displayParts = () => getEventDisplay(props.block, props.agentId);

  // Determine viewer role for icon selection
  const viewingAsActor = () => props.agentId === props.block.actor_agent_id;
  const viewingAsSource = () => props.agentId === props.block.source_agent_id;
  const viewingAsTarget = () => props.agentId === props.block.target_agent_id;

  // Icon selection: Split for Actor/Target, GitBranchPlus for Source
  const showSplitIcon = () => viewingAsActor() || viewingAsTarget();
  const showGitBranchPlusIcon = () => viewingAsSource();

  return (
    <div
      class="rounded-full text-xs text-text-secondary flex items-center justify-center gap-1.5 w-[80%] md:w-[75%]"
      classList={{
        [sizeClasses().padding]: true,
      }}
      style={{
        background: "var(--theme-surface-raised)",
        "box-shadow": `0 0 0 1px color-mix(in srgb, var(--theme-gradient-via) 50%, transparent)`,
      }}
    >
      {/* Role-based icon */}
      {showSplitIcon() && <Split size={14} class="flex-shrink-0 text-text-secondary" />}
      {showGitBranchPlusIcon() && <GitBranchPlus size={14} class="flex-shrink-0 text-text-secondary" />}

      {/* Render display parts (text and agent links) */}
      {displayParts().map((part, index) => (
        <>
          {part.type === "text" ? (
            <span>{part.text}</span>
          ) : (
            <AgentButton
              agentId={part.agentId}
              showIcon={true}
              class="text-xs"
              onClick={() => {
                props.onOpenAgentModal?.(part.agentId);
              }}
            >
              {part.title}
            </AgentButton>
          )}
          {/* Add space between parts except after the last one */}
          {index < displayParts().length - 1 && part.type === "text" && <span> </span>}
        </>
      ))}

      <span class="text-text-muted">•</span>
      <span class="text-text-muted">{formatSmartTime(new Date(props.block.timestamp), new Date())}</span>
    </div>
  );
};

export default EventDivider;
