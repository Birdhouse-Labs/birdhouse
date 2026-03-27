// ABOUTME: Live chat messages for real agents with streaming
// ABOUTME: Resource + Store hybrid for initial fetch + real-time updates

import { AlertCircle } from "lucide-solid";
import { type Component, createEffect, createMemo, createResource, createSignal, onCleanup, Show } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import type { EventType } from "../../../server/src/types/agent-events";
import { API_ENDPOINT_BASE } from "../config/api";
import { type SessionStatus, useStreaming } from "../contexts/StreamingContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { handlePartDelta, handlePartUpdate } from "../domain/message-updates";

import { log } from "../lib/logger";
import { clearDraft, getDraft, saveDraft } from "../services/drafts-api";
import {
  cloneAgent,
  fetchAgent,
  fetchMessages,
  revertAgent,
  SendMessageError,
  sendMessage,
  stopAgent,
  stopAgentTree,
  unrevertAgent,
} from "../services/messages-api";
import { fetchPendingQuestions } from "../services/questions-api";
import type { ComposerAttachment } from "../types/composer-attachments";
import type { Message } from "../types/messages";
import type { QuestionRequest } from "../types/question";
import {
  createComposerAttachments,
  getComposerAttachmentError,
  restoreComposerAttachments,
} from "../utils/composerAttachments";
import { createDebouncedSave } from "../utils/draft-persistence";
import AgentHeader from "./AgentHeader";
import Button from "./ui/Button";
import ChatContainer from "./ui/ChatContainer";
import ContentDialog from "./ui/ContentDialog";

interface LiveMessagesProps {
  agentId: string;
  onAgentHeaderClick?: (agentId: string) => void;
  onOpenAgentModal?: (agentId: string) => void;
  showCloseButton?: boolean;
  onClose?: () => void;
}

const LoadingState = () => (
  <div class="flex items-center justify-center h-full">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
  </div>
);

const ErrorState: Component<{ error: Error; onRetry: () => void }> = (props) => (
  <div class="flex items-center justify-center h-full">
    <div class="text-center">
      <div class="text-lg text-danger mb-4">Failed to load messages</div>
      <div class="text-sm text-muted mb-4">{props.error.message}</div>
      <Button variant="tertiary" onClick={props.onRetry} data-ph-capture-attribute-button-type="retry-load-messages">
        Retry
      </Button>
    </div>
  </div>
);

/**
 * Helper: Update agent titles in event blocks when an agent is renamed
 */
function updateAgentTitlesInEvents(messages: Message[], updatedAgentId: string, newTitle: string) {
  for (const message of messages) {
    if (message.role !== "system" || !message.blocks) continue;

    for (const block of message.blocks) {
      if (block.type === "agent_event") {
        if (block.actor_agent_id === updatedAgentId) {
          block.actor_agent_title = newTitle;
        }
        if (block.source_agent_id === updatedAgentId) {
          block.source_agent_title = newTitle;
        }
        if (block.target_agent_id === updatedAgentId) {
          block.target_agent_title = newTitle;
        }
      }
    }
  }
}

const LiveMessages: Component<LiveMessagesProps> = (props) => {
  // Get workspace context
  const { workspaceId } = useWorkspace();

  // Store for messages (holds both fetched and streamed data)
  const [messagesStore, setMessages] = createStore<Message[]>([]);
  const [selectedAgent, setSelectedAgent] = createSignal("build");
  const [cloneMode, setCloneMode] = createSignal(false);
  const [stopTreeMode, setStopTreeMode] = createSignal(false);

  // Resource handles fetch lifecycle (with workspace ID)
  const [messagesResource, { refetch }] = createResource(
    () => props.agentId,
    (agentId) => fetchMessages(workspaceId, agentId),
  );

  // Fetch agent metadata for header (with workspace ID)
  const [agentMetadata, { refetch: refetchMetadata }] = createResource(
    () => props.agentId,
    (agentId) => fetchAgent(workspaceId, agentId),
  );

  // Filter messages based on revert state
  const filteredMessages = createMemo(() => {
    const metadata = agentMetadata();
    if (!metadata?.revert?.messageID) {
      return messagesStore;
    }

    // Filter out messages where id >= revert.messageID
    const revertMessageId = metadata.revert.messageID;
    return messagesStore.filter((msg) => msg.id < revertMessageId);
  });

  // Sync resource data to store when it arrives
  createEffect(() => {
    const data = messagesResource();
    if (data) {
      setMessages(reconcile(data));
    }
  });

  // Streaming context
  const streaming = useStreaming();

  // Session status - single source of truth for agent working state
  // Initial fetch from API to handle page refresh while agent is working
  const [sessionStatus, { refetch: refetchSessionStatus }] = createResource(
    () => ({ agentId: props.agentId, workspaceId }),
    async ({ agentId, workspaceId }) => {
      try {
        const response = await fetch(`${API_ENDPOINT_BASE}/workspace/${workspaceId}/agents/${agentId}/status`);
        if (!response.ok) return { type: "idle" as const };
        const data = await response.json();
        return data.status as SessionStatus;
      } catch {
        return { type: "idle" as const };
      }
    },
  );

  // Use a signal to track session status, initialized from resource
  const [agentStatus, setAgentStatus] = createSignal<SessionStatus>({ type: "idle" });

  // Sync initial resource value to signal when it loads
  createEffect(() => {
    const status = sessionStatus();
    if (status) {
      setAgentStatus(status);
    }
  });

  // Derive isAgentWorking from sessionStatus
  const isAgentWorking = () => {
    const status = agentStatus();
    return status.type === "busy" || status.type === "retry";
  };

  createEffect(() => {
    if (!isAgentWorking()) {
      setStopTreeMode(false);
    }
  });

  // Subscribe to session.status SSE events to keep status updated.
  // When session goes idle (e.g. after stop/abort), clear pending questions immediately
  // so the interactive form disappears without requiring a page refresh.
  createEffect(() => {
    const unsubscribe = streaming.subscribeToSessionStatus(props.agentId, (status) => {
      setAgentStatus(status);
      if (status.type === "idle") {
        setPendingQuestions([]);
      }
    });
    onCleanup(unsubscribe);
  });

  // Refetch status when SSE reconnects to prevent stale state
  createEffect(() => {
    const unsubscribe = streaming.subscribeToConnectionEstablished(() => {
      refetchSessionStatus();
    });
    onCleanup(unsubscribe);
  });

  // Pending questions - tracks active question tool calls that need human answers
  const [pendingQuestions, setPendingQuestions] = createSignal<QuestionRequest[]>([]);

  // Fetch pending questions on mount (handles page refresh while question is active)
  createEffect(() => {
    const agentId = props.agentId;
    fetchPendingQuestions(workspaceId, agentId)
      .then((questions) => {
        setPendingQuestions(questions);
      })
      .catch((err) => {
        log.api.warn("Failed to fetch pending questions", { agentId, err });
      });
  });

  // Subscribe to new questions arriving via SSE
  createEffect(() => {
    const unsubscribe = streaming.subscribeToQuestionAsked(props.agentId, (question) => {
      setPendingQuestions((prev) => {
        // Avoid duplicates if the same question arrives twice
        if (prev.some((q) => q.id === question.id)) return prev;
        return [...prev, question];
      });
    });
    onCleanup(unsubscribe);
  });

  // Refetch pending questions when SSE reconnects (may have missed events while disconnected).
  // Merges rather than replaces: adds any questions the server knows about that we missed,
  // but keeps questions already in state that aren't in the response yet — they may have
  // arrived via SSE moments before connection.established fired (race window). Questions
  // answered by the user are removed immediately via removePendingQuestion, so keeping
  // extras from prev is safe and never accumulates stale state.
  createEffect(() => {
    const unsubscribe = streaming.subscribeToConnectionEstablished(() => {
      fetchPendingQuestions(workspaceId, props.agentId)
        .then((fetched) => {
          setPendingQuestions((prev) => {
            const prevIds = new Set(prev.map((q) => q.id));
            // Add any from fetched not already in state (missed while disconnected)
            const newFromFetch = fetched.filter((q) => !prevIds.has(q.id));
            // Keep all of prev — server may not yet reflect questions that arrived via SSE
            // in the race window between question.asked and connection.established
            return [...prev, ...newFromFetch];
          });
        })
        .catch((err) => {
          log.api.warn("Failed to refetch pending questions on reconnect", { agentId: props.agentId, err });
        });
    });
    onCleanup(unsubscribe);
  });

  // Remove a question from pendingQuestions after it has been answered
  const removePendingQuestion = (questionId: string) => {
    setPendingQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  // Input state management
  const [inputValue, setInputValue] = createSignal("");
  const [attachments, setAttachments] = createSignal<ComposerAttachment[]>([]);
  const [attachmentError, setAttachmentError] = createSignal<string | null>(null);
  const [isSending, setIsSending] = createSignal(false);
  const [sendError, setSendError] = createSignal<string | null>(null);
  const [sendErrorDetails, setSendErrorDetails] = createSignal<SendMessageError | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = createSignal(false);

  // Input ref for focusing (reactive signal so effects can track it)
  const [inputRef, setInputRef] = createSignal<HTMLTextAreaElement | undefined>();

  // isLoaded gates the save effect — plain boolean, invisible to SolidJS tracking
  let isLoaded = false;

  // Debounced saver — created once at component init
  const draftSave = createDebouncedSave(() => {
    saveDraft(workspaceId, props.agentId, {
      text: inputValue(),
      attachments: attachments().map(({ filename, mime, url }) => ({ filename, mime, url })),
    }).catch(() => {}); // silent fail — user's text is still in the input
  });

  // Flush any pending save when the component unmounts
  onCleanup(() => draftSave.flush());

  // Load draft from server; resets when agentId changes
  createEffect(() => {
    const agentId = props.agentId; // track for agent changes
    isLoaded = false;
    setInputValue("");
    setAttachments([]);
    getDraft(workspaceId, agentId)
      .then((draft) => {
        if (draft) {
          setInputValue(draft.text);
          setAttachments(restoreComposerAttachments(draft.attachments.map((a) => ({ type: "file" as const, ...a }))));
        }
      })
      .catch(() => {})
      .finally(() => {
        isLoaded = true;
      });
  });

  // Focus input when both draft and inputRef exist
  createEffect(() => {
    const currentValue = inputValue();
    const currentRef = inputRef();

    if (currentValue && currentRef) {
      // Focus input when draft exists (e.g., after cloning or returning to work)
      currentRef.focus();
    }
  });

  // Track changes; gate on isLoaded to avoid saving during initial load
  createEffect(() => {
    inputValue();
    attachments();
    if (!isLoaded) return;
    draftSave.schedule();
  });

  // Subscribe to connection established events to refresh stale data
  createEffect(() => {
    const unsubscribe = streaming.subscribeToConnectionEstablished(() => {
      // Tab became visible and SSE reconnected - refetch messages
      log.api.info(`Connection re-established for agent ${props.agentId}, refreshing messages`);
      refetch();
    });

    onCleanup(unsubscribe);
  });

  // Subscribe to streaming updates after initial load completes
  createEffect(() => {
    // Wait for initial load to complete
    if (!messagesResource() || messagesResource.loading) return;

    // Subscribe to message updates (user and assistant messages)
    const unsubscribeMessages = streaming.subscribeToMessageUpdates(props.agentId, (messageData) => {
      // aborts also send a message update
      const { info } = messageData;

      // Check if message already exists
      const existingIndex = messagesStore.findIndex((m) => m.id === info.id);

      if (existingIndex === -1) {
        // New message - add to top (newest-at-top architecture)
        // Type-cast info as the proper OpenCode message type
        const newMessage: Message = {
          id: info.id,
          opencodeMessage: info,
          role: info.role,
          content: "", // Parts will fill this in
          blocks: [],
          timestamp: new Date(),
          isStreaming: info.role === "assistant",
        };
        setMessages([newMessage, ...messagesStore]);
      } else {
        // Message exists - update opencodeMessage to capture error field, completion time, etc.
        // This happens when OpenCode sends a second message.updated with error details
        setMessages(existingIndex, { opencodeMessage: info });
      }
    });

    // Subscribe to part updates (full part on create/complete)
    const unsubscribeParts = streaming.subscribeToPartUpdates(props.agentId, (part) => {
      handlePartUpdate(part, messagesStore, setMessages);
    });

    // Subscribe to part deltas (incremental text during streaming)
    const unsubscribeDeltas = streaming.subscribeToPartDeltas(props.agentId, (delta) => {
      handlePartDelta(delta, messagesStore, setMessages);
    });

    // Subscribe to agent idle (streaming complete)
    // Note: We no longer track isAssistantStreaming here - sessionStatus from SSE is the source of truth

    // Subscribe to agent errors
    const unsubscribeError = streaming.subscribeToAgentError(props.agentId, (errorData) => {
      const { error } = errorData;

      if (error.name === "MessageAbortedError") {
        setMessages(0, { isStreaming: false });
        refetch();
        return;
      }

      // Extract error message from the event
      const message = errorData.error?.data?.message || errorData.error?.name || "An error occurred";

      // Show error in banner
      setSendError(message);

      // Log for debugging
      log.api.error("Async message error", {
        agentId: props.agentId,
        errorData,
      });
    });

    // Subscribe to event created (system events like clones)
    const unsubscribeEvents = streaming.subscribeToEventCreated((agentId, systemEvent) => {
      // Only process if it's for the current agent
      if (agentId !== props.agentId) return;

      // Map system event to UI Message
      const eventMessage: Message = {
        id: systemEvent.id,
        role: "system",
        opencodeMessage: undefined,
        content: "",
        blocks: [
          {
            id: systemEvent.id,
            type: "agent_event" as const,
            event_type: systemEvent.event_type as EventType,
            timestamp: systemEvent.timestamp,
            actor_agent_id: systemEvent.actor_agent_id,
            actor_agent_title: systemEvent.actor_agent_title,
            source_agent_id: systemEvent.source_agent_id,
            source_agent_title: systemEvent.source_agent_title,
            target_agent_id: systemEvent.target_agent_id,
            target_agent_title: systemEvent.target_agent_title,
            metadata: systemEvent.metadata,
          },
        ],
        timestamp: new Date(systemEvent.timestamp),
      };

      // Insert event message at top (newest-at-top)
      setMessages([eventMessage, ...messagesStore]);
    });

    // Subscribe to agent updated events
    const unsubscribeAgentUpdates = streaming.subscribeToAgentUpdated((updatedAgentId, agent) => {
      // Agent title updated - find and update any event blocks referencing this agent
      const newTitle = agent["title"];
      if (typeof newTitle !== "string") return;

      // Update all AgentEventBlock instances that reference this agent
      setMessages(produce((draft) => updateAgentTitlesInEvents(draft, updatedAgentId, newTitle)));
    });

    // Subscribe to session updates (e.g., revert state cleared)
    const unsubscribeSessionUpdates = streaming.subscribeToSessionUpdates(props.agentId, () => {
      // Session metadata changed - refetch agent metadata to get updated revert state
      refetchMetadata();
    });

    // Subscribe to message removed events (e.g., messages deleted when revert is committed)
    const unsubscribeMessageRemoved = streaming.subscribeToMessageRemoved(props.agentId, (messageId) => {
      // Remove message from store when OpenCode confirms deletion
      setMessages(messagesStore.filter((msg) => msg.id !== messageId));
    });

    // Cleanup all subscriptions
    onCleanup(() => {
      unsubscribeMessages();
      unsubscribeParts();
      unsubscribeDeltas();
      unsubscribeError();
      unsubscribeEvents();
      unsubscribeAgentUpdates();
      unsubscribeSessionUpdates();
      unsubscribeMessageRemoved();
    });
  });

  // Refetch agent metadata when this agent is archived
  createEffect(() => {
    const unsubscribe = streaming.subscribeToAgentArchived((payload) => {
      if (payload.archivedIds.includes(props.agentId)) {
        refetchMetadata();
      }
    });
    onCleanup(unsubscribe);
  });

  // Refetch agent metadata when this agent is unarchived
  createEffect(() => {
    const unsubscribe = streaming.subscribeToAgentUnarchived((payload) => {
      if (payload.unarchivedIds.includes(props.agentId)) {
        refetchMetadata();
      }
    });
    onCleanup(unsubscribe);
  });

  const handleSendMessage = async (message: string) => {
    const content = message.trim();
    const currentAttachments = attachments();
    if ((!content && currentAttachments.length === 0) || isSending()) return;

    setIsSending(true);
    setSendError(null);
    setAttachmentError(null);

    try {
      await sendMessage(workspaceId, props.agentId, content, {
        agent: selectedAgent(),
        cloneAndSend: cloneMode(),
        attachments: currentAttachments,
      });

      // Clear input and draft only on success
      setInputValue("");
      setAttachments([]);
      clearDraft(workspaceId, props.agentId).catch(() => {});

      // Reset clone mode after successful send
      setCloneMode(false);

      // Streaming will update the UI with user message + assistant response
    } catch (error) {
      // Keep message in input for retry
      // Show error to user
      const errorMessage = error instanceof Error ? error.message : "Unknown error sending message";
      setSendError(errorMessage);

      // Store full error details for dialog
      if (error instanceof SendMessageError) {
        setSendErrorDetails(error);
      } else {
        setSendErrorDetails(null);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleStop = async () => {
    setSendError(null);

    try {
      if (stopTreeMode()) {
        await stopAgentTree(workspaceId, props.agentId);
      } else {
        await stopAgent(workspaceId, props.agentId);
      }

      // Streaming will update the UI with user message + assistant response
    } catch (error) {
      // Keep message in input for retry
      // Show error to user
      const errorMessage = error instanceof Error ? error.message : "Unknown error sending message";
      setSendError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachmentsAdded = async (files: File[]) => {
    const nextError = getComposerAttachmentError(files);
    if (nextError) {
      setAttachmentError(nextError);
      return;
    }

    setAttachmentError(null);
    const nextAttachments = await createComposerAttachments(files);
    setAttachments((current) => [...current, ...nextAttachments]);
  };

  const handleCloneFromMessage = async (messageId: string, messageContent: string, event: MouseEvent) => {
    setSendError(null);

    const isModifierClick = event.metaKey || event.ctrlKey || event.shiftKey;

    try {
      const newAgent = await cloneAgent(workspaceId, props.agentId, messageId);

      // Pre-populate the cloned agent's input with the message content
      saveDraft(workspaceId, newAgent.id, { text: messageContent, attachments: [] }).catch(() => {});

      // Navigate based on modifier key
      if (isModifierClick) {
        // Cmd/Ctrl+Click: open in new tab
        const url = `${window.location.origin}/#/workspace/${workspaceId}/agent/${newAgent.id}`;
        window.open(url, "_blank");
      } else {
        // Normal click: open in modal dialog
        props.onOpenAgentModal?.(newAgent.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error cloning agent";
      setSendError(errorMessage);

      // Store full error details for dialog
      if (error instanceof Error) {
        const errorDetails = new SendMessageError(errorMessage, 0, "", "");
        setSendErrorDetails(errorDetails);
      }
    }
  };

  const handleResetToMessage = async (messageId: string) => {
    setSendError(null);

    try {
      const result = await revertAgent(workspaceId, props.agentId, messageId);

      if (result.success) {
        // Pre-populate input with returned message text
        setInputValue(result.messageText);
        setAttachments(restoreComposerAttachments(result.attachments));
        setAttachmentError(null);

        // Refetch agent metadata to get updated revert state
        refetchMetadata();

        // Focus input to draw attention to the pre-populated message
        const ref = inputRef();
        if (ref) {
          queueMicrotask(() => ref.focus());
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error resetting agent";
      setSendError(errorMessage);

      // Store full error details for dialog
      if (error instanceof Error) {
        const errorDetails = new SendMessageError(errorMessage, 0, "", "");
        setSendErrorDetails(errorDetails);
      }
    }
  };

  const handleCancelRevert = async () => {
    setSendError(null);

    try {
      const result = await unrevertAgent(workspaceId, props.agentId);

      if (result.success) {
        // Clear input field (it was pre-populated with reverted message)
        setInputValue("");
        setAttachments([]);
        setAttachmentError(null);

        // Refetch agent metadata to clear revert state
        refetchMetadata();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error canceling revert";
      setSendError(errorMessage);

      // Store full error details for dialog
      if (error instanceof Error) {
        const errorDetails = new SendMessageError(errorMessage, 0, "", "");
        setSendErrorDetails(errorDetails);
      }
    }
  };

  return (
    <div class="flex flex-col h-full bg-surface">
      <Show
        when={messagesStore.length > 0 && !messagesResource.error}
        fallback={
          messagesResource.error ? (
            <ErrorState error={messagesResource.error as Error} onRetry={refetch} />
          ) : (
            <LoadingState />
          )
        }
      >
        <div class="flex flex-col h-full">
          {/* Agent Header - only show when metadata is loaded */}
          <Show when={agentMetadata()}>
            {(metadata) => (
              <Show
                when={props.showCloseButton && props.onClose}
                fallback={
                  <AgentHeader
                    agentId={props.agentId}
                    workspaceId={workspaceId}
                    title={metadata().title}
                    modelName={metadata().model}
                    messages={messagesStore}
                    mode={selectedAgent()}
                    onModeChange={setSelectedAgent}
                    onHeaderClick={() => props.onAgentHeaderClick?.(props.agentId)}
                    archivedAt={metadata().archived_at}
                  />
                }
              >
                <AgentHeader
                  agentId={props.agentId}
                  workspaceId={workspaceId}
                  title={metadata().title}
                  modelName={metadata().model}
                  messages={messagesStore}
                  mode={selectedAgent()}
                  onModeChange={setSelectedAgent}
                  onHeaderClick={() => props.onAgentHeaderClick?.(props.agentId)}
                  archivedAt={metadata().archived_at}
                  showCloseButton={true}
                  onClose={() => props.onClose?.()}
                />
              </Show>
            )}
          </Show>

          <Show when={sendError()}>
            <div class="bg-surface-raised border-b border-danger px-3 py-2 flex-shrink-0">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <Show when={sendErrorDetails()} fallback={<span class="text-danger text-sm flex-shrink-0">⚠</span>}>
                    <button
                      type="button"
                      onClick={() => setErrorDialogOpen(true)}
                      class="w-7 h-7 rounded-lg bg-danger/5 hover:bg-danger/10 text-danger transition-all flex items-center justify-center flex-shrink-0"
                      aria-label="View error details"
                      title="View full error details"
                      data-ph-capture-attribute-button-type="view-send-error-details"
                      data-ph-capture-attribute-agent-id={props.agentId}
                    >
                      <AlertCircle size={16} />
                    </button>
                  </Show>
                  <p class="text-sm text-text-secondary truncate">{sendError()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSendError(null)}
                  class="text-text-muted hover:text-text-primary text-sm flex-shrink-0"
                  title="Dismiss"
                  data-ph-capture-attribute-button-type="dismiss-send-error"
                  data-ph-capture-attribute-agent-id={props.agentId}
                >
                  ×
                </button>
              </div>
            </div>
          </Show>
          <Show when={agentMetadata()?.revert}>
            <div class="bg-surface-raised border-b border-accent px-3 py-2 flex-shrink-0">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <span class="text-accent text-sm flex-shrink-0">ℹ</span>
                  <p class="text-sm text-text-secondary truncate">
                    Reset pending: {messagesStore.length - filteredMessages().length}{" "}
                    {messagesStore.length - filteredMessages().length === 1 ? "message" : "messages"} hidden
                  </p>
                </div>
                <Button
                  variant="tertiary"
                  onClick={handleCancelRevert}
                  data-ph-capture-attribute-button-type="cancel-agent-revert"
                  data-ph-capture-attribute-agent-id={props.agentId}
                >
                  Cancel Reset
                </Button>
              </div>
            </div>
          </Show>
          <ChatContainer
            messages={filteredMessages()}
            agentId={props.agentId}
            inputValue={inputValue()}
            isStreaming={isAgentWorking()}
            onInputChange={setInputValue}
            onSend={() => handleSendMessage(inputValue())}
            onStop={handleStop}
            stopTreeMode={stopTreeMode()}
            onStopTreeModeChange={setStopTreeMode}
            attachments={attachments()}
            attachmentError={attachmentError()}
            onRemoveAttachment={(attachmentId) => {
              setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
            }}
            onAttachmentsAdded={handleAttachmentsAdded}
            isSendDisabled={isSending()}
            cloneMode={cloneMode()}
            onCloneModeChange={setCloneMode}
            onOpenAgentModal={props.onOpenAgentModal}
            onCloneFromMessage={handleCloneFromMessage}
            onResetToMessage={handleResetToMessage}
            pendingQuestions={pendingQuestions}
            onQuestionAnswered={removePendingQuestion}
            inputRef={(el) => {
              setInputRef(el);
            }}
          />
        </div>
      </Show>

      {/* Error details dialog */}
      <ContentDialog
        open={errorDialogOpen()}
        onOpenChange={setErrorDialogOpen}
        title="Send Message Error Details"
        content={sendErrorDetails() ? JSON.stringify(sendErrorDetails()?.toJSON(), null, 2) : ""}
        language="json"
      />
    </div>
  );
};

export default LiveMessages;
