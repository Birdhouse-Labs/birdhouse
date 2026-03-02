// ABOUTME: Inline button for viewing message/prompt content with popover
// ABOUTME: Uses theme gradient colors, similar to AgentButton but simpler (no mouse tracking)

import Popover from "corvu/popover";
import { MessageSquare } from "lucide-solid";
import { type Component, createSignal, type JSX, Show } from "solid-js";
import { formatSmartTime } from "../../adapters/utils/time-utils";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useZIndex } from "../../contexts/ZIndexContext";
import { MarkdownRenderer } from "../MarkdownRenderer";
import CopyButton from "./CopyButton";
import MessageBubbleContent from "./MessageBubbleContent";

export interface MessageButtonProps {
  children: JSX.Element;
  showIcon?: boolean;
  class?: string;
  content: string;
  popoverTitle: string;
  timestamp?: Date | undefined;
}

export const MessageButton: Component<MessageButtonProps> = (props) => {
  const { workspaceId } = useWorkspace();
  const baseZIndex = useZIndex();
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <>
      <Popover open={isOpen()} onOpenChange={setIsOpen} floatingOptions={{ offset: 8, flip: true, shift: true }}>
        <Popover.Trigger
          as="button"
          type="button"
          class={`message-btn inline-flex items-center gap-1 rounded font-medium cursor-pointer ${props.class || ""}`}
          style={{ transition: "transform 100ms ease-in-out" }}
        >
          <Show when={props.showIcon}>
            <MessageSquare size={14} class="flex-shrink-0" />
          </Show>
          {props.children}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content class="max-w-[80vw] md:max-w-md" style={{ "z-index": baseZIndex }}>
            {/* Mimics message list structure: bg-surface container with padding and scroll, bubble inside */}
            <div class="bg-surface p-4 rounded-xl border shadow-xl border-border overflow-y-auto max-h-[50vh]">
              {/* Sender info - above bubble like in MessageBubble */}
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="flex items-center gap-2 text-xs">
                  <span class="font-medium text-accent">{props.popoverTitle}</span>
                  <Show when={props.timestamp}>
                    {(timestamp) => <span class="text-text-secondary">{formatSmartTime(timestamp(), new Date())}</span>}
                  </Show>
                </div>
                <CopyButton text={props.content} />
              </div>

              {/* Message bubble - using agent-sent variant for gradient background */}
              <MessageBubbleContent variant="agent-sent" class="px-4 py-3">
                <MarkdownRenderer content={props.content} workspaceId={workspaceId} class="text-sm" />
              </MessageBubbleContent>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover>

      {/* CSS for message button styling */}
      <style>{`
        /* Active (click) feedback - scale down slightly */
        .message-btn:active {
          transform: scale(0.95);
        }
        
        /* Solid theme color */
        .message-btn {
          color: var(--theme-gradient-from);
        }
        
        .message-btn:hover {
          color: var(--theme-gradient-to);
        }
      `}</style>
    </>
  );
};

export default MessageButton;
