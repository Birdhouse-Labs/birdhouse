// ABOUTME: Reusable agent button component with cursor-controlled gradient effect
// ABOUTME: Used for agent links in markdown, headers, and other UI elements

import { Bot } from "lucide-solid";
import { type Component, type JSX, Show } from "solid-js";
import { useWorkspace } from "../../contexts/WorkspaceContext";

export interface AgentButtonProps {
  agentId: string;
  children: JSX.Element;
  onClick?: (e: MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  showIcon?: boolean;
  class?: string;
  disabled?: boolean;
}

export const AgentButton: Component<AgentButtonProps> = (props) => {
  const { workspaceId } = useWorkspace();

  const handleMouseMove = (e: MouseEvent) => {
    const element = e.currentTarget as HTMLAnchorElement;
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    element.style.setProperty("--mouse-x", `${percent}%`);
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const element = e.currentTarget as HTMLAnchorElement;
    element.style.removeProperty("--mouse-x");
  };

  const handleClick = (e: MouseEvent) => {
    // Cmd/Ctrl+click: let browser open in new tab natively
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      return;
    }
    // Normal click: prevent navigation and use custom handler (dialog)
    e.preventDefault();
    props.onClick?.(e);
  };

  return (
    <>
      <a
        href={`#/workspace/${workspaceId}/agent/${props.agentId}`}
        data-agent-id={props.agentId}
        class={`agent-btn inline-flex items-center gap-1 rounded font-medium cursor-pointer no-underline ${props.class || ""}`}
        classList={{
          "opacity-50 pointer-events-none": props.disabled,
        }}
        style={{ transition: "transform 100ms ease-in-out" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onKeyDown={props.onKeyDown}
      >
        <Show when={props.showIcon}>
          <Bot size={16} class="flex-shrink-0" />
        </Show>
        {props.children}
      </a>

      {/* CSS for agent button gradient effects */}
      <style>{`
        /* Active (click) feedback - scale down slightly */
        .agent-btn:active {
          transform: scale(0.95);
        }
        
        /* Cursor-controlled gradient on text only */
        .agent-btn {
          background: linear-gradient(
            to right,
            var(--theme-gradient-from) 0%,
            var(--theme-gradient-from) calc(var(--mouse-x, -100%) - 20%),
            var(--theme-gradient-to) calc(var(--mouse-x, -100%) + 20%),
            var(--theme-gradient-to) 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        /* SVG icons start at gradient-to, switch to gradient-from on hover (no animation) */
        .agent-btn svg {
          color: var(--theme-gradient-to);
        }
        
        .agent-btn:hover svg {
          color: var(--theme-gradient-from);
        }
      `}</style>
    </>
  );
};

export default AgentButton;
