// ABOUTME: Renders individual chat message bubbles with role-based styling.
// ABOUTME: Supports user and assistant messages with markdown content and tool blocks.

import Popover from "corvu/popover";
import { Braces, Check, Copy, LibraryBig, MoreVertical, RotateCcw, Split } from "lucide-solid";
import { type Accessor, type Component, createMemo, createSignal, For, Show } from "solid-js";
import type { BirdhouseAssistantMessageInfo, BirdhouseMessageInfo } from "../../../../server/src/harness/types";
import { formatSmartTime } from "../../adapters/utils/time-utils";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useZIndex } from "../../contexts/ZIndexContext";
import { uiSize } from "../../theme";
import type { Message } from "../../types/messages";
import { isAgentEventBlock, isFileBlock, isReasoningBlock, isSystemMessage, isToolBlock } from "../../types/messages";
import type { QuestionRequest } from "../../types/question";
import { recordAgentView } from "../../utils/agent-navigation";
import { copyToClipboard } from "../../utils/clipboard";
import { extractSkillsFromXML, stripSkillXML } from "../../utils/skillAttachmentXml";
import MarkdownRenderer from "../MarkdownRenderer";
import AgentButton from "./AgentButton";
import AgentToolCard from "./AgentToolCard";
import Button from "./Button";
import ContentDialog from "./ContentDialog";
import EventDivider from "./EventDivider";
import IconButton from "./IconButton";
import MenuItemButton from "./MenuItemButton";
import MessageBubbleContent from "./MessageBubbleContent";
import MessageFileAttachments from "./MessageFileAttachments";
import QuestionToolCard from "./QuestionToolCard";
import ReasoningBlock from "./ReasoningBlock";
import SkillAttachmentsDialog from "./SkillAttachmentsDialog";
import ToolCallCard from "./ToolCallCard";
import AgentManagementCard from "./tools/AgentManagementCard";
import DocumentationToolCard from "./tools/DocumentationToolCard";
import FileOperationCard from "./tools/FileOperationCard";
import SearchToolCard from "./tools/SearchToolCard";
import SystemToolCard from "./tools/SystemToolCard";
import TaskToolCard from "./tools/TaskToolCard";

export interface ChatMessageBubbleProps {
  message: Message;
  agentId: string;
  onOpenAgentModal?: ((agentId: string) => void) | undefined;
  isQueued?: boolean;
  onCloneFromMessage?: ((messageId: string, messageContent: string, event: MouseEvent) => void) | undefined;
  onResetToMessage?: ((messageId: string) => void) | undefined;
  pendingQuestions?: Accessor<QuestionRequest[]>;
  onQuestionAnswered?: (questionId: string) => void;
}

const formatError = (
  messageInfo: BirdhouseMessageInfo | undefined,
): { id: string; type: "error"; errorType: string; message: string } | undefined => {
  if (!messageInfo || messageInfo.role !== "assistant") return;
  if (!messageInfo.error) return;
  if (messageInfo.error.name === "MessageAbortedError") return;

  const assistantInfo = messageInfo as BirdhouseAssistantMessageInfo;
  const assistantError = assistantInfo.error;
  if (!assistantError) return;

  return {
    id: `error_${assistantInfo.id}`,
    type: "error",
    errorType: assistantError.name,
    message: String(assistantError.data?.["message"] ?? assistantError.name),
  };
};

export const ChatMessageBubble: Component<ChatMessageBubbleProps> = (props) => {
  const { workspaceId } = useWorkspace();
  const baseZIndex = useZIndex();
  const isUser = () => props.message.role === "user";
  const [errorDialogOpen, setErrorDialogOpen] = createSignal(false);
  const [skillDialogOpen, setSkillDialogOpen] = createSignal(false);
  const [selectedSkillName, setSelectedSkillName] = createSignal<string | undefined>(undefined);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [showCopySuccess, setShowCopySuccess] = createSignal(false);
  const [showCopyJSONSuccess, setShowCopyJSONSuccess] = createSignal(false);

  const senderInfo = createMemo(() => {
    if (!isUser()) return null;
    const firstTextBlock = props.message.blocks?.find((block) => block.type === "text");
    if (firstTextBlock && firstTextBlock.type === "text" && firstTextBlock.metadata) {
      return {
        agentId: firstTextBlock.metadata.sent_by_agent_id as string | undefined,
        agentTitle: firstTextBlock.metadata.sent_by_agent_title as string | undefined,
      };
    }
    return null;
  });

  const isAgentSent = createMemo(() => Boolean(senderInfo()?.agentTitle));

  const attachedSkills = createMemo(() => {
    if (props.message.role !== "user") return [];
    return extractSkillsFromXML(props.message.content);
  });

  const cleanedContent = createMemo(() => {
    if (props.message.role !== "user") return props.message.content;
    return stripSkillXML(props.message.content);
  });

  const sizeClasses = createMemo(() => {
    const size = uiSize();
    return {
      small: size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
      padding: size === "sm" ? "px-3" : size === "md" ? "px-4" : "px-5",
    };
  });

  const shouldBePinned = createMemo(() => {
    if (
      props.message.isStreaming &&
      !props.message.content &&
      (!props.message.blocks || props.message.blocks.length === 0)
    ) {
      return false;
    }

    return props.message.isStreaming || (props.message.blocks?.some((block) => block.type === "tool") ?? false);
  });

  const messageInfo = props.message.messageInfo;
  const wasInterrupted = messageInfo?.role === "assistant" ? messageInfo.error?.name === "MessageAbortedError" : false;
  const mode = messageInfo?.role === "assistant" ? messageInfo.mode : null;
  const error = formatError(messageInfo);
  const fileAttachments = createMemo(() => props.message.blocks?.filter(isFileBlock) ?? []);

  const copyableContent = createMemo(() => {
    const mainContent = isUser() ? cleanedContent() : props.message.content;
    return mainContent || null;
  });

  const handleCopyContent = async () => {
    const content = copyableContent();
    if (!content) return;

    const success = await copyToClipboard(content);
    if (success) {
      setShowCopySuccess(true);
      setIsMenuOpen(false);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }
  };

  const handleCopyJSON = async () => {
    const json = JSON.stringify(props.message, null, 2);
    const success = await copyToClipboard(json);
    if (success) {
      setShowCopyJSONSuccess(true);
      setIsMenuOpen(false);
      setTimeout(() => setShowCopyJSONSuccess(false), 2000);
    }
  };

  const renderActionsMenu = (messageContent: string) => (
    <div class="absolute top-2 right-2 z-10 transition-opacity md:opacity-0 md:group-hover:opacity-100">
      <Popover open={isMenuOpen()} onOpenChange={setIsMenuOpen}>
        <Popover.Trigger
          as={IconButton}
          icon={
            showCopySuccess() ? (
              <Check size={16} />
            ) : showCopyJSONSuccess() ? (
              <Check size={16} />
            ) : (
              <MoreVertical size={16} />
            )
          }
          variant="ghost"
          aria-label="Message actions"
          fixedSize
        />
        <Popover.Portal>
          <Popover.Content
            class="w-48 rounded-xl border border-border bg-surface-raised px-2 py-1 shadow-2xl"
            style={{ "z-index": baseZIndex }}
          >
            <MenuItemButton icon={<Copy size={16} />} onClick={handleCopyContent} disabled={!copyableContent()}>
              Copy Content
            </MenuItemButton>
            <MenuItemButton
              icon={showCopyJSONSuccess() ? <Check size={16} /> : <Braces size={16} />}
              onClick={handleCopyJSON}
            >
              Copy JSON
            </MenuItemButton>
            <Show when={props.onCloneFromMessage}>
              <MenuItemButton
                icon={<Split size={16} />}
                onClick={(event) => {
                  props.onCloneFromMessage?.(props.message.id, messageContent, event);
                  setIsMenuOpen(false);
                }}
              >
                Clone from here
              </MenuItemButton>
            </Show>
            <Show when={props.onResetToMessage}>
              <MenuItemButton
                icon={<RotateCcw size={16} />}
                onClick={() => {
                  props.onResetToMessage?.(props.message.id);
                  setIsMenuOpen(false);
                }}
              >
                Reset to here
              </MenuItemButton>
            </Show>
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    </div>
  );

  return (
    <div
      class="flex flex-col transition-opacity"
      classList={{
        "items-end": isUser() && !isAgentSent(),
        "items-start": !isUser() && !isSystemMessage(props.message),
        "items-center": isAgentSent() || isSystemMessage(props.message),
        "opacity-60": props.isQueued,
      }}
    >
      <Show when={!isSystemMessage(props.message)}>
        <div
          class="mb-1 flex items-center gap-2"
          classList={{
            [sizeClasses().small]: true,
            "flex-row-reverse": isUser() && !isAgentSent(),
          }}
        >
          <Show
            when={isAgentSent() && senderInfo()?.agentId}
            fallback={
              <div class="flex items-center gap-1.5">
                <span
                  class="font-medium"
                  classList={{
                    "text-accent": !isUser() || isAgentSent(),
                    "text-accent-secondary": isUser() && !isAgentSent(),
                  }}
                >
                  {isUser() ? senderInfo()?.agentTitle || "You" : props.message.model}
                </span>
              </div>
            }
          >
            <AgentButton
              agentId={senderInfo()?.agentId || ""}
              showIcon={true}
              class="font-medium"
              onClick={() => {
                const agentId = senderInfo()?.agentId;
                if (agentId) {
                  props.onOpenAgentModal?.(agentId);
                }
              }}
            >
              {senderInfo()?.agentTitle}
            </AgentButton>
          </Show>

          {!isUser() && <span class="text-text-secondary">{props.message.provider}</span>}

          <Show when={isUser()}>
            <span
              classList={{
                "text-text-secondary": mode === "build",
                "text-accent": mode === "plan",
              }}
            >
              {mode}
            </span>
          </Show>

          <Show
            when={props.isQueued}
            fallback={<span class="text-text-secondary">{formatSmartTime(props.message.timestamp, new Date())}</span>}
          >
            <span class="rounded px-1.5 py-0.5 text-xs font-medium bg-accent/20 text-accent">Queued</span>
          </Show>

          <Show when={wasInterrupted}>
            <span class="text-sm text-text-muted">interrupted</span>
          </Show>
        </div>
      </Show>

      {isSystemMessage(props.message) ? (
        <Show
          when={
            props.message.blocks?.[0] && isAgentEventBlock(props.message.blocks[0]) ? props.message.blocks[0] : null
          }
        >
          {(eventBlock) => (
            <EventDivider block={eventBlock()} agentId={props.agentId} onOpenAgentModal={props.onOpenAgentModal} />
          )}
        </Show>
      ) : isUser() && !isAgentSent() ? (
        <MessageBubbleContent
          variant="user"
          class={sizeClasses().padding}
          classList={{
            "w-[90%] md:w-[85%]": shouldBePinned(),
            "max-w-[90%] md:max-w-[85%]": !shouldBePinned(),
          }}
        >
          {renderActionsMenu(cleanedContent())}

          <MarkdownRenderer
            content={cleanedContent()}
            workspaceId={workspaceId}
            onSkillLinkClick={(skillName) => {
              if (attachedSkills().some((attachment) => attachment.name === skillName)) {
                setSelectedSkillName(skillName);
                setSkillDialogOpen(true);
              }
            }}
            onReferenceLinkClick={(reference) => {
              if (reference.type === "agent") {
                recordAgentView(reference.identifier);
                props.onOpenAgentModal?.(reference.identifier);
              }
            }}
          />

          <MessageFileAttachments attachments={fileAttachments()} />

          <Show when={attachedSkills().length > 0}>
            <div class="mt-2 mb-1 flex justify-end">
              <Button variant="tertiary" leftIcon={<LibraryBig size={16} />} onClick={() => setSkillDialogOpen(true)}>
                {attachedSkills().length} {attachedSkills().length === 1 ? "skill" : "skills"} attached
              </Button>
            </div>
          </Show>
        </MessageBubbleContent>
      ) : isAgentSent() ? (
        <MessageBubbleContent
          variant="agent-sent"
          class={sizeClasses().padding}
          classList={{
            "w-[95%] md:w-[92.5%]": shouldBePinned(),
            "max-w-[95%] md:max-w-[92.5%]": !shouldBePinned(),
          }}
        >
          {renderActionsMenu(cleanedContent())}

          <MarkdownRenderer
            content={cleanedContent()}
            workspaceId={workspaceId}
            onSkillLinkClick={(skillName) => {
              if (attachedSkills().some((attachment) => attachment.name === skillName)) {
                setSelectedSkillName(skillName);
                setSkillDialogOpen(true);
              }
            }}
            onReferenceLinkClick={(reference) => {
              if (reference.type === "agent") {
                recordAgentView(reference.identifier);
                props.onOpenAgentModal?.(reference.identifier);
              }
            }}
          />

          <MessageFileAttachments attachments={fileAttachments()} />

          <Show when={attachedSkills().length > 0}>
            <div class="mt-2 mb-1 flex justify-start">
              <Button variant="tertiary" leftIcon={<LibraryBig size={16} />} onClick={() => setSkillDialogOpen(true)}>
                {attachedSkills().length} {attachedSkills().length === 1 ? "skill" : "skills"} attached
              </Button>
            </div>
          </Show>
        </MessageBubbleContent>
      ) : (
        <MessageBubbleContent
          variant="assistant"
          class={sizeClasses().padding}
          classList={{
            "w-[90%] md:w-[85%]": shouldBePinned(),
            "max-w-[90%] md:max-w-[85%]": !shouldBePinned(),
          }}
        >
          {renderActionsMenu(props.message.content)}

          <MessageFileAttachments attachments={fileAttachments()} />

          <Show when={props.message.content}>
            <MarkdownRenderer
              content={props.message.content}
              workspaceId={workspaceId}
              {...(props.message.isStreaming !== undefined && { isStreaming: props.message.isStreaming })}
              onReferenceLinkClick={(reference) => {
                if (reference.type === "agent") {
                  recordAgentView(reference.identifier);
                  props.onOpenAgentModal?.(reference.identifier);
                }
              }}
            />
          </Show>

          <Show when={props.message.isStreaming && !props.message.content}>
            <div class="flex items-center justify-center py-4">
              <div class="h-4 w-4 animate-spin rounded-full border-b-2 border-accent" />
            </div>
          </Show>

          <Show when={props.message.blocks && props.message.blocks.length > 0}>
            <For each={props.message.blocks}>
              {(block) => {
                if (isToolBlock(block)) {
                  switch (block.name) {
                    case "agent_create":
                    case "agent_reply":
                    case "agent_read":
                    case "agent_tree":
                      return <AgentToolCard block={block} onOpenAgentModal={props.onOpenAgentModal} />;
                    case "read":
                    case "write":
                    case "edit":
                      return <FileOperationCard block={block} />;
                    case "glob":
                    case "grep":
                      return <SearchToolCard block={block} />;
                    case "bash":
                    case "webfetch":
                      return <SystemToolCard block={block} />;
                    case "context7_resolve-library-id":
                    case "context7_query-docs":
                      return <DocumentationToolCard block={block} />;
                    case "todowrite":
                    case "todoread":
                      return <TaskToolCard block={block} />;
                    case "skill":
                      return <AgentManagementCard block={block} />;
                    case "question":
                      return (
                        <QuestionToolCard
                          block={block}
                          agentId={props.agentId}
                          {...(props.pendingQuestions !== undefined && { pendingQuestions: props.pendingQuestions })}
                          {...(props.onQuestionAnswered !== undefined && { onAnswered: props.onQuestionAnswered })}
                        />
                      );
                    default:
                      return <ToolCallCard block={block} />;
                  }
                }

                if (isReasoningBlock(block)) {
                  return <ReasoningBlock block={block} />;
                }

                return null;
              }}
            </For>
          </Show>

          <Show when={!!error}>
            <div class="mt-2 mb-2 overflow-hidden rounded-lg border border-red-500/20 bg-red-500/5">
              <div class="flex items-start gap-2 px-3 py-2">
                <span class="flex-shrink-0 text-red-600 dark:text-red-400">⚠️</span>
                <div class="min-w-0 flex-1">
                  <div class="break-words text-sm font-medium text-red-600 dark:text-red-400">{error?.message}</div>
                </div>
              </div>
              <div class="border-t border-red-500/20 px-3 py-2">
                <Button variant="tertiary" onClick={() => setErrorDialogOpen(true)}>
                  View full error details
                </Button>
              </div>
            </div>
          </Show>
        </MessageBubbleContent>
      )}

      <SkillAttachmentsDialog
        attachments={attachedSkills()}
        open={skillDialogOpen()}
        onClose={() => {
          setSkillDialogOpen(false);
          setSelectedSkillName(undefined);
        }}
        workspaceId={workspaceId}
        {...(selectedSkillName() ? { initialSkillName: selectedSkillName() } : {})}
      />

      <ContentDialog
        open={errorDialogOpen()}
        onOpenChange={setErrorDialogOpen}
        title="Error Details"
        content={JSON.stringify(error, null, 2)}
        language="json"
      />
    </div>
  );
};

export default ChatMessageBubble;
