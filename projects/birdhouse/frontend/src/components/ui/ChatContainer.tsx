// ABOUTME: Chat container with input at top and message list below (newest-at-top architecture)
// ABOUTME: Orchestrates message rendering and input handling

import { LibraryBig, Split, X } from "lucide-solid";
import { type Accessor, type Component, createMemo, createResource, createSignal, For, Show } from "solid-js";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { findPendingAssistantId, isMessageQueued } from "../../domain/message-queue";
import { previewSkillAttachments } from "../../services/skill-attachments-api";
import { uiSize } from "../../theme";
import type { ComposerAttachment } from "../../types/composer-attachments";
import type { Message } from "../../types/messages";
import type { QuestionRequest } from "../../types/question";
import { extractSkillLinkNames } from "../../utils/skillLinks";
import AutoGrowTextarea from "./AutoGrowTextarea";
import Button from "./Button";
import ComposerAttachmentDropZone from "./ComposerAttachmentDropZone";
import ComposerImageAttachments from "./ComposerImageAttachments";
import MessageBubble from "./MessageBubble";
import SkillAttachmentsDialog from "./SkillAttachmentsDialog";

export interface ChatContainerProps {
  messages: Message[];
  agentId: string; // Agent whose messages are being displayed
  inputValue: string;
  isStreaming: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  attachments?: ComposerAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onAttachmentsAdded?: (files: File[]) => void | Promise<void>;
  attachmentError?: string | null;
  isSendDisabled?: boolean;
  cloneMode?: boolean;
  onCloneModeChange?: (enabled: boolean) => void;
  onOpenAgentModal?: ((agentId: string) => void) | undefined;
  onCloneFromMessage?: ((messageId: string, messageContent: string, event: MouseEvent) => void) | undefined;
  onResetToMessage?: ((messageId: string) => void) | undefined;
  pendingQuestions?: Accessor<QuestionRequest[]>;
  onQuestionAnswered?: (questionId: string) => void;
  inputRef?: (el: HTMLTextAreaElement) => void;
}

export const ChatContainer: Component<ChatContainerProps> = (props) => {
  const { workspaceId } = useWorkspace();
  const sizeClasses = createMemo(() => {
    const size = uiSize();
    return {
      text: size === "sm" ? "text-sm" : size === "md" ? "text-base" : "text-lg",
      gap: size === "sm" ? "gap-3" : size === "md" ? "gap-4" : "gap-5",
    };
  });

  const linkedSkillNames = createMemo(() => extractSkillLinkNames(props.inputValue.trim()));

  const [skillAttachments] = createResource(
    () => {
      const text = props.inputValue.trim();
      if (!text || linkedSkillNames().length === 0) {
        return null;
      }

      return text;
    },
    (text) => previewSkillAttachments(workspaceId, text),
  );
  const visibleSkillAttachments = createMemo(() => {
    if (linkedSkillNames().length === 0 || !props.inputValue.trim() || skillAttachments.error) {
      return [];
    }

    return skillAttachments() ?? [];
  });
  const skillCount = createMemo(() => {
    return visibleSkillAttachments().length;
  });
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const hasDraftContent = createMemo(() => !!props.inputValue.trim() || (props.attachments?.length ?? 0) > 0);

  // Find the pending assistant message ID for queue detection
  const pendingAssistantId = createMemo(() => findPendingAssistantId(props.messages));

  return (
    <div class="flex flex-col flex-1 bg-surface overflow-hidden">
      {/* Input area - at TOP for newest-at-top architecture */}
      <div class="px-4 pt-3 pb-3 border-b bg-surface-raised border-border flex-shrink-0">
        <div class="flex items-end gap-3">
          <div class="flex-1 min-w-0">
            <ComposerAttachmentDropZone
              onAttachmentsAdded={props.onAttachmentsAdded}
              error={props.attachmentError}
              disabled={props.isSendDisabled}
            >
              <div>
                <AutoGrowTextarea
                  value={props.inputValue}
                  onInput={props.onInputChange}
                  onSend={props.onSend}
                  onAttachmentsAdded={props.onAttachmentsAdded}
                  disabled={props.isSendDisabled ?? false}
                  placeholder="Type a message..."
                  ref={props.inputRef}
                />
                <Show when={(props.attachments?.length ?? 0) > 0 && props.onRemoveAttachment}>
                  <ComposerImageAttachments
                    attachments={props.attachments || []}
                    onRemove={(attachmentId) => props.onRemoveAttachment?.(attachmentId)}
                  />
                </Show>
              </div>
            </ComposerAttachmentDropZone>
          </div>

          <Show when={props.isStreaming && !hasDraftContent()}>
            <button
              type="button"
              onClick={props.onStop}
              class="rounded-lg px-4 py-2 font-medium bg-gradient-to-r from-gradient-from to-gradient-to text-text-on-accent transition-opacity"
              classList={{
                [sizeClasses().text]: true,
              }}
              data-ph-capture-attribute-button-type="stop-streaming"
              data-ph-capture-attribute-agent-id={props.agentId}
            >
              Stop
            </button>
          </Show>
          <Show when={!props.isStreaming || hasDraftContent()}>
            <div class="flex">
              <button
                type="button"
                onClick={props.onSend}
                disabled={!hasDraftContent() || props.isSendDisabled}
                class="px-4 py-2 font-medium bg-gradient-to-r from-gradient-from to-gradient-to text-text-on-accent transition-opacity"
                classList={{
                  [sizeClasses().text]: true,
                  "opacity-50 cursor-not-allowed": !hasDraftContent() || props.isSendDisabled,
                  "hover:opacity-90": hasDraftContent() && !props.isSendDisabled,
                  "rounded-lg": !props.onCloneModeChange,
                  "rounded-l-lg": !!props.onCloneModeChange,
                }}
                data-ph-capture-attribute-button-type="send-message"
                data-ph-capture-attribute-agent-id={props.agentId}
                data-ph-capture-attribute-clone-mode={props.cloneMode ? "true" : "false"}
                data-ph-capture-attribute-is-streaming={props.isStreaming ? "true" : "false"}
                data-ph-capture-attribute-action={
                  props.cloneMode ? "clone-and-send" : props.isStreaming ? "queue" : "send"
                }
              >
                {props.isSendDisabled ? "..." : props.cloneMode ? "Clone & Send" : props.isStreaming ? "Queue" : "Send"}
              </button>
              <Show when={props.onCloneModeChange}>
                <button
                  type="button"
                  onClick={() => props.onCloneModeChange?.(!props.cloneMode)}
                  disabled={props.isSendDisabled}
                  class="px-3 py-2 font-medium bg-gradient-to-l from-gradient-from to-gradient-to text-text-on-accent transition-opacity border-l border-white/20 rounded-r-lg flex items-center justify-center"
                  classList={{
                    "opacity-50 cursor-not-allowed": props.isSendDisabled,
                    "hover:opacity-90": !props.isSendDisabled,
                  }}
                  aria-label={props.cloneMode ? "Disable clone mode" : "Enable clone mode"}
                  title={props.cloneMode ? "Switch to normal send" : "Switch to clone and send"}
                  data-ph-capture-attribute-button-type="toggle-clone-mode"
                  data-ph-capture-attribute-agent-id={props.agentId}
                  data-ph-capture-attribute-current-state={props.cloneMode ? "enabled" : "disabled"}
                  data-ph-capture-attribute-action={props.cloneMode ? "disable" : "enable"}
                >
                  <Show when={props.cloneMode} fallback={<Split size={18} />}>
                    <X size={18} />
                  </Show>
                </button>
              </Show>
            </div>
          </Show>
        </div>

        {/* Skill count button - appears below input in the padding area */}
        <Show when={skillCount() > 0}>
          <div class="flex justify-end mt-2 -mb-1">
            <Button variant="tertiary" leftIcon={<LibraryBig size={16} />} onClick={() => setDialogOpen(true)}>
              {skillCount()} {skillCount() === 1 ? "skill" : "skills"}
            </Button>
          </div>
        </Show>
      </div>

      {/* Skill Attachments Dialog */}
      <SkillAttachmentsDialog
        attachments={visibleSkillAttachments()}
        open={dialogOpen()}
        onClose={() => setDialogOpen(false)}
        workspaceId={workspaceId}
      />

      {/* Messages area - newest at top (scrollable) */}
      <div
        class="flex-1 p-4 space-y-4 overflow-y-auto"
        classList={{
          [sizeClasses().gap]: true,
        }}
      >
        <For each={props.messages}>
          {(message) => (
            <MessageBubble
              message={message}
              agentId={props.agentId}
              onOpenAgentModal={props.onOpenAgentModal}
              isQueued={isMessageQueued(message, pendingAssistantId())}
              onCloneFromMessage={props.onCloneFromMessage}
              onResetToMessage={props.onResetToMessage}
              {...(props.pendingQuestions !== undefined && { pendingQuestions: props.pendingQuestions })}
              {...(props.onQuestionAnswered !== undefined && { onQuestionAnswered: props.onQuestionAnswered })}
            />
          )}
        </For>
      </div>
    </div>
  );
};

export default ChatContainer;
