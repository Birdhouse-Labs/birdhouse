// ABOUTME: Popover showing agent metadata with on-demand loading for clone source info
// ABOUTME: Click timestamp to open, shows model, timestamps, tokens, and clone relationship

import Popover from "corvu/popover";
import { type Component, createResource, createSignal } from "solid-js";
import { formatSmartTime } from "../adapters/utils/time-utils";
import { buildWorkspaceUrl } from "../config/api";
import { useZIndex } from "../contexts/ZIndexContext";

import { type GlobalReference, MarkdownRenderer } from "./MarkdownRenderer";

export interface AgentInfoPopoverProps {
  agentId: string;
  workspaceId: string;
  title: string;
  modelName: string;
  createdAt: Date;
  updatedAt: Date;
  tokenUsage: number;
  clonedFrom: string | null;
  clonedAt: Date | null;
  isSelected: boolean;
  isGradientActive: boolean;
  sectionDate: Date;
  onAgentLinkClick?: (agentId: string, metaKey: boolean) => void;
}

interface SourceAgentInfo {
  id: string;
  title: string;
}

export const AgentInfoPopover: Component<AgentInfoPopoverProps> = (props) => {
  const baseZIndex = useZIndex();
  const [isOpen, setIsOpen] = createSignal(false);

  // Handle delayed open to avoid race condition with closeOnOutsidePointer
  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Delay opening to let other popovers close first
      setTimeout(() => setIsOpen(true), 50);
    } else {
      setIsOpen(false);
    }
  };

  // Fetch source agent info when popover opens (only if cloned)
  const [sourceAgent] = createResource(
    () => (isOpen() && props.clonedFrom ? props.clonedFrom : null),
    async (sourceAgentId): Promise<SourceAgentInfo | null> => {
      try {
        const response = await fetch(buildWorkspaceUrl(props.workspaceId, `/agents/${sourceAgentId}`));
        if (!response.ok) {
          // Source agent might have been deleted
          return null;
        }
        const data = await response.json();
        return {
          id: data.id,
          title: data.title,
        };
      } catch (_error) {
        return null;
      }
    },
  );

  // Build markdown content with clone info
  const markdownContent = () => {
    let content = `**${props.title}**

| Property | Value |
|----------|-------|
| Model | \`${props.modelName}\` |
| Created | \`${props.createdAt.toLocaleString()}\` |
| Updated | \`${props.updatedAt.toLocaleString()}\` |
| Tokens | \`${props.tokenUsage.toLocaleString()}\` |`;

    // Add clone info if this agent was cloned
    if (props.clonedFrom && props.clonedAt) {
      // Show loading state while fetching source agent
      if (sourceAgent.loading) {
        content += `\n| Cloned From | *Loading...* |`;
      } else if (sourceAgent.error || !sourceAgent()) {
        // Source agent not found (deleted or error)
        content += `\n| Cloned From | \`${props.clonedFrom}\` (deleted) |`;
      } else {
        // Show clickable link with source agent title
        content += `\n| Cloned From | [${sourceAgent()?.title}](birdhouse:agent/${props.clonedFrom}) |`;
      }
      content += `\n| Cloned At | \`${props.clonedAt.toLocaleString()}\` |`;
    }

    return content;
  };

  const handleReferenceLinkClick = (ref: GlobalReference, modifiers?: { metaKey: boolean }) => {
    if (ref.type === "agent" && props.onAgentLinkClick) {
      props.onAgentLinkClick(ref.identifier, modifiers?.metaKey || false);
    }
  };

  return (
    <Popover open={isOpen()} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        as="button"
        type="button"
        class="text-[10px] flex-shrink-0 cursor-pointer pr-2 relative z-10"
        classList={{
          "!text-text-on-accent hover:!text-text-on-accent/70": props.isGradientActive,
          "text-text-muted hover:text-accent": !props.isGradientActive && !props.isSelected,
          "text-text-primary hover:text-accent": !props.isGradientActive && props.isSelected,
        }}
        aria-label="Show agent info"
      >
        {formatSmartTime(props.updatedAt, props.sectionDate)}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          class="px-3 py-2 rounded-lg border border-border shadow-lg bg-surface-raised max-w-sm"
          style={{ "z-index": baseZIndex }}
        >
          <MarkdownRenderer
            content={markdownContent()}
            class="text-xs"
            workspaceId={props.workspaceId}
            onReferenceLinkClick={handleReferenceLinkClick}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  );
};

export default AgentInfoPopover;
