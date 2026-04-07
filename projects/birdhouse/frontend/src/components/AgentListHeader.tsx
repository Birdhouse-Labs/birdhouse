// ABOUTME: Slim header bar for the agent list panel
// ABOUTME: Shows "Agents" title with a search icon button that opens AgentSearchDialog

import { Search } from "lucide-solid";
import type { Component } from "solid-js";
import { borderColor } from "../styles/containerStyles";

export interface AgentListHeaderProps {
  onSearchOpen: () => void;
}

const AgentListHeader: Component<AgentListHeaderProps> = (props) => {
  return (
    <div
      class={`px-4 py-1 flex items-center justify-between border-b ${borderColor} flex-shrink-0`}
      style={{ background: "var(--theme-surface-raised)" }}
    >
      <span class="text-sm font-medium text-text-primary">Agents</span>
      <button
        type="button"
        onClick={props.onSearchOpen}
        class="flex items-center justify-center w-7 h-7 rounded-lg transition-colors text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
        aria-label="Search agents"
        data-ph-capture-attribute-button-type="open-agent-search"
      >
        <Search size={14} />
      </button>
    </div>
  );
};

export default AgentListHeader;
