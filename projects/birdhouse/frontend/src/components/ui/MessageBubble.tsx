// ABOUTME: Renders individual chat message bubbles with role-based styling
// ABOUTME: Supports user and assistant messages with markdown content

import type { Message as OpencodeMessage } from "@opencode-ai/sdk/client";
import Popover from "corvu/popover";
import { Braces, Check, Copy, LibraryBig, MoreVertical, RotateCcw, Split } from "lucide-solid";
import { type Accessor, type Component, createMemo, createSignal, For, Show } from "solid-js";
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

export interface MessageBubbleProps {
  message: Message;
  agentId: string; // Agent whose messages are being displayed
  onOpenAgentModal?: ((agentId: string) => void) | undefined;
  isQueued?: boolean; // Whether this message is queued (waiting for assistant to complete)
  onCloneFromMessage?: ((messageId: string, messageContent: string, event: MouseEvent) => void) | undefined;
  onResetToMessage?: ((messageId: string) => void) | undefined;
  pendingQuestions?: Accessor<QuestionRequest[]>;
  onQuestionAnswered?: (questionId: string) => void;
}
const formatError = (
  opencodeMessage: OpencodeMessage | undefined,
): { id: string; type: "error"; errorType: string; message: string } | undefined => {
  if (!opencodeMessage) return;
  if (opencodeMessage.role === "user") return;
  if (!opencodeMessage.error) return;
  if (opencodeMessage.error.name === "MessageAbortedError") return;

  const ocError = opencodeMessage.error;

  return {
    id: `error_${opencodeMessage.id}`,
    type: "error",
    errorType: ocError.name,
    message: String(ocError.data.message),
  };
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: MessageBubble handles many message types and states - complexity is inherent to the domain
export const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const { workspaceId } = useWorkspace();
  const baseZIndex = useZIndex();
  const isUser = () => props.message.role === "user";
  const [errorDialogOpen, setErrorDialogOpen] = createSignal(false);
  const [skillDialogOpen, setSkillDialogOpen] = createSignal(false);
  const [selectedSkillName, setSelectedSkillName] = createSignal<string | undefined>(undefined);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [showCopySuccess, setShowCopySuccess] = createSignal(false);
  const [showCopyJSONSuccess, setShowCopyJSONSuccess] = createSignal(false);

  // Extract sender info from first text block's metadata
  const senderInfo = createMemo(() => {
    if (!isUser()) return null;
    const firstTextBlock = props.message.blocks?.find((b) => b.type === "text");
    if (firstTextBlock && firstTextBlock.type === "text" && firstTextBlock.metadata) {
      return {
        agentId: firstTextBlock.metadata.sent_by_agent_id as string | undefined,
        agentTitle: firstTextBlock.metadata.sent_by_agent_title as string | undefined,
      };
    }
    return null;
  });

  // Check if this is an agent-sent message (vs human-sent)
  const isAgentSent = createMemo(() => !!senderInfo()?.agentTitle);

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
    // Not pinned if just showing spinner (no content yet)
    if (
      props.message.isStreaming &&
      !props.message.content &&
      (!props.message.blocks || props.message.blocks.length === 0)
    ) {
      return false;
    }
    // Pin to max width while streaming OR has tool blocks (prevents growing/shifting)
    return props.message.isStreaming || (props.message.blocks?.some((b) => b.type === "tool") ?? false);
  });

  // Get OpenCode message (undefined for system events, which is OK)
  const opencodeMessage = props.message.opencodeMessage;

  const wasInterrupted =
    opencodeMessage?.role === "user" ? false : opencodeMessage?.error?.name === "MessageAbortedError";

  const mode = opencodeMessage?.role === "user" ? null : opencodeMessage?.mode;

  const error = formatError(opencodeMessage);
  const fileAttachments = createMemo(() => props.message.blocks?.filter(isFileBlock) ?? []);

  const formatErrorForDialog = () => {
    if (!error) return "";

    return JSON.stringify(error, null, 2);
  };

  // Extract copyable content from message
  const copyableContent = createMemo(() => {
    // For user messages, use cleanedContent (XML stripped)
    // For assistant messages, use message.content
    // message.content already contains all the text, so we don't need to add blocks
    const mainContent = isUser() ? cleanedContent() : props.message.content;
    return mainContent || null;
  });

  // Handle copy content action
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

  // Handle copy JSON action - copies the full Message object as pretty-printed JSON
  const handleCopyJSON = async () => {
    const json = JSON.stringify(props.message, null, 2);
    const success = await copyToClipboard(json);
    if (success) {
      setShowCopyJSONSuccess(true);
      setIsMenuOpen(false);
      setTimeout(() => setShowCopyJSONSuccess(false), 2000);
    }
  };

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
      {/* Sender info - hidden for system messages */}
      <Show when={!isSystemMessage(props.message)}>
        <div
          class="flex items-center gap-2 mb-1"
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
            <span class="px-1.5 py-0.5 rounded text-xs font-medium bg-accent/20 text-accent">Queued</span>
          </Show>

          <Show when={wasInterrupted}>
            <span class="text-sm text-text-muted">interrupted</span>
          </Show>
        </div>
      </Show>
      {/* Message bubble */}
      {isSystemMessage(props.message) ? (
        // System event divider - clone events and other system timeline markers
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
        // Human user message - soft tinted background with prominent accent glow
        <MessageBubbleContent
          variant="user"
          class={sizeClasses().padding}
          classList={{
            "w-[90%] md:w-[85%]": shouldBePinned(),
            "max-w-[90%] md:max-w-[85%]": !shouldBePinned(),
          }}
        >
          {/* Copy menu - top right corner */}
          <div class="absolute top-2 right-2 z-10 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Popover open={isMenuOpen()} onOpenChange={setIsMenuOpen}>
              <Popover.Trigger
                as={IconButton}
                icon={showCopySuccess() ? <Check size={16} /> : <MoreVertical size={16} />}
                variant="ghost"
                aria-label="Message actions"
                fixedSize
              />
              <Popover.Portal>
                <Popover.Content
                  class="w-48 rounded-xl py-1 px-2 border shadow-2xl bg-surface-raised border-border"
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
                        props.onCloneFromMessage?.(props.message.id, cleanedContent(), event);
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

          {/* Attached Skills Button */}
          <Show when={attachedSkills().length > 0}>
            <div class="flex justify-end mt-2 mb-1">
              <Button variant="tertiary" leftIcon={<LibraryBig size={16} />} onClick={() => setSkillDialogOpen(true)}>
                {attachedSkills().length} {attachedSkills().length === 1 ? "skill" : "skills"} attached
              </Button>
            </div>
          </Show>
        </MessageBubbleContent>
      ) : isAgentSent() ? (
        // Agent-sent message - centered with gradient background, widest of all message types
        <MessageBubbleContent
          variant="agent-sent"
          class={sizeClasses().padding}
          classList={{
            "w-[95%] md:w-[92.5%]": shouldBePinned(),
            "max-w-[95%] md:max-w-[92.5%]": !shouldBePinned(),
          }}
        >
          {/* Copy menu - top right corner */}
          <div class="absolute top-2 right-2 z-10 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Popover open={isMenuOpen()} onOpenChange={setIsMenuOpen}>
              <Popover.Trigger
                as={IconButton}
                icon={showCopySuccess() ? <Check size={16} /> : <MoreVertical size={16} />}
                variant="ghost"
                aria-label="Message actions"
                fixedSize
              />
              <Popover.Portal>
                <Popover.Content
                  class="w-48 rounded-xl py-1 px-2 border shadow-2xl bg-surface-raised border-border"
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
                </Popover.Content>
              </Popover.Portal>
            </Popover>
          </div>

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
                // Always open in modal dialog
                props.onOpenAgentModal?.(reference.identifier);
              }
            }}
          />

          <MessageFileAttachments attachments={fileAttachments()} />

          {/* Skill attachments button - only show for user messages with attached skills */}
          <Show when={attachedSkills().length > 0}>
            <div class="flex justify-start mt-2 mb-1">
              <Button variant="tertiary" leftIcon={<LibraryBig size={16} />} onClick={() => setSkillDialogOpen(true)}>
                {attachedSkills().length} {attachedSkills().length === 1 ? "skill" : "skills"} attached
              </Button>
            </div>
          </Show>
        </MessageBubbleContent>
      ) : (
        // Assistant message styling
        <MessageBubbleContent
          variant="assistant"
          class={sizeClasses().padding}
          classList={{
            "w-[90%] md:w-[85%]": shouldBePinned(),
            "max-w-[90%] md:max-w-[85%]": !shouldBePinned(),
          }}
        >
          {/* Copy menu - top right corner */}
          <div class="absolute top-2 right-2 z-10 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <Popover open={isMenuOpen()} onOpenChange={setIsMenuOpen}>
              <Popover.Trigger
                as={IconButton}
                icon={showCopySuccess() ? <Check size={16} /> : <MoreVertical size={16} />}
                variant="ghost"
                aria-label="Message actions"
                fixedSize
              />
              <Popover.Portal>
                <Popover.Content
                  class="w-48 rounded-xl py-1 px-2 border shadow-2xl bg-surface-raised border-border"
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
                        props.onCloneFromMessage?.(props.message.id, props.message.content, event);
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

          <MessageFileAttachments attachments={fileAttachments()} />

          {/* Render markdown (even while streaming) */}
          <Show when={props.message.content}>
            <MarkdownRenderer
              content={props.message.content}
              workspaceId={workspaceId}
              {...(props.message.isStreaming !== undefined && {
                isStreaming: props.message.isStreaming,
              })}
              onReferenceLinkClick={(reference) => {
                if (reference.type === "agent") {
                  recordAgentView(reference.identifier);
                  // Always open in modal dialog
                  props.onOpenAgentModal?.(reference.identifier);
                }
              }}
            />
          </Show>

          {/* Streaming indicator when message has no content yet */}
          <Show when={props.message.isStreaming && !props.message.content}>
            <div class="flex items-center justify-center py-4">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-accent" />
            </div>
          </Show>

          {/* Render content blocks (tools, reasoning, files, etc.) */}
          <Show when={props.message.blocks && props.message.blocks.length > 0}>
            <For each={props.message.blocks}>
              {(block) => {
                if (isToolBlock(block)) {
                  // Route to specialized tool components
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
                          {...(props.pendingQuestions !== undefined && {
                            pendingQuestions: props.pendingQuestions,
                          })}
                          {...(props.onQuestionAnswered !== undefined && { onAnswered: props.onQuestionAnswered })}
                        />
                      );
                    default:
                      // Fallback to generic ToolCallCard for unknown tools
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

          {/* Message-level error banner */}
          <Show when={!!error}>
            <div class="mt-2 mb-2 rounded-lg border border-red-500/20 bg-red-500/5 overflow-hidden">
              <div class="px-3 py-2 flex items-start gap-2">
                <span class="text-red-600 dark:text-red-400 flex-shrink-0">⚠️</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-red-600 dark:text-red-400 font-medium break-words">{error?.message}</div>
                </div>
              </div>
              <div class="px-3 py-2 border-t border-red-500/20">
                <Button variant="tertiary" onClick={() => setErrorDialogOpen(true)}>
                  View full error details
                </Button>
              </div>
            </div>
          </Show>
        </MessageBubbleContent>
      )}

      {/* Skill attachments dialog */}
      <SkillAttachmentsDialog
        attachments={attachedSkills()}
        open={skillDialogOpen()}
        onClose={() => {
          setSkillDialogOpen(false);
          setSelectedSkillName(undefined);
        }}
        {...(selectedSkillName() ? { initialSkillName: selectedSkillName() } : {})}
      />

      {/* Error details dialog */}
      <ContentDialog
        open={errorDialogOpen()}
        onOpenChange={setErrorDialogOpen}
        title="Error Details"
        content={formatErrorForDialog()}
        language="json"
      />
    </div>
  );
};

export default MessageBubble;
