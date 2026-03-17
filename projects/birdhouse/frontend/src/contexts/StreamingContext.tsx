// ABOUTME: Streaming context for subscribing to OpenCode SSE events (messages, parts, sessions)
// ABOUTME: Single EventSource connection shared across all components

import type { Message as OpencodeMessage } from "@opencode-ai/sdk/client";
import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  type ParentComponent,
  useContext,
} from "solid-js";
import { API_ENDPOINT_BASE } from "../config/api";
import type { StreamingPart } from "../domain/message-updates";
import { log } from "../lib/logger";
import type { QuestionRequest } from "../types/question";

/**
 * Event payload from server SSE stream
 */
interface ServerEvent {
  type: string;
  properties: Record<string, unknown>;
}

/**
 * Handler function for streaming part updates
 */
export type PartUpdateHandler = (part: StreamingPart) => void;

/**
 * Handler function for streaming part deltas (incremental text during streaming)
 */
export type PartDeltaHandler = (delta: {
  sessionID: string;
  messageID: string;
  partID: string;
  field: string;
  delta: string;
  agentId?: string;
}) => void;

/**
 * Handler function for message updates (full message with role)
 */
export type MessageUpdateHandler = (message: { info: OpencodeMessage }) => void;

/**
 * Handler function for session updates (session metadata changes like revert state)
 */
export type SessionUpdateHandler = (sessionInfo: { info: Record<string, unknown> }) => void;

/**
 * Handler function for message removed events
 */
export type MessageRemovedHandler = (messageId: string) => void;

/**
 * Handler function for agent idle events
 */
export type AgentIdleHandler = (agentId: string) => void;

/**
 * Handler function for agent error events
 */
export type AgentErrorHandler = (error: {
  sessionID?: string;
  error: { name: string; data: { message: string } };
}) => void;

/**
 * Handler function for session created events
 */
export type SessionCreatedHandler = (sessionInfo: { id: string; title: string; agentId?: string }) => void;

/**
 * Session status from OpenCode
 */
export type SessionStatus =
  | { type: "idle" }
  | { type: "busy" }
  | { type: "retry"; attempt: number; message: string; next: number };

/**
 * Handler function for session status events
 */
export type SessionStatusHandler = (status: SessionStatus) => void;

/**
 * Handler function for all session status events (includes agentId)
 */
export type AllSessionStatusHandler = (agentId: string, status: SessionStatus) => void;

/**
 * Handler function for agent created events (Birdhouse custom event)
 */
export type AgentCreatedHandler = (agentInfo: { agentId: string; agent: Record<string, unknown> }) => void;

/**
 * Handler function for agent updated events (Birdhouse custom event)
 */
export type AgentUpdatedHandler = (agentId: string, agent: Record<string, unknown>) => void;

/**
 * Handler function for event created events (Birdhouse custom event)
 * Fires when a system event (like clone) is created and should be added to timeline
 */
export type EventCreatedHandler = (
  agentId: string,
  event: {
    id: string;
    event_type: string;
    timestamp: number;
    actor_agent_id: string | null;
    actor_agent_title: string;
    source_agent_id: string | null;
    source_agent_title: string;
    target_agent_id: string | null;
    target_agent_title: string;
    metadata?: Record<string, unknown>;
  },
) => void;

/**
 * Handler function for agent archived events (Birdhouse custom event)
 * Fires when an agent and its descendants are archived
 */
export type AgentArchivedHandler = (payload: { agentId: string; archivedCount: number; archivedIds: string[] }) => void;

/**
 * Handler function for agent unarchived events (Birdhouse custom event)
 * Fires when an agent and its descendants are unarchived
 */
export type AgentUnarchivedHandler = (payload: {
  agentId: string;
  unarchivedCount: number;
  unarchivedIds: string[];
}) => void;

/**
 * Handler function for connection established events
 * Fires when SSE connection is (re)established - useful for refreshing stale data
 */
export type ConnectionEstablishedHandler = () => void;

/**
 * Handler function for skill updated events (Birdhouse custom event)
 * Fires when skill trigger phrases change and cache should refresh
 */
export type SkillUpdatedHandler = (payload: { skillName: string }) => void;

/**
 * Handler function for question asked events (OpenCode question tool)
 * Fires when an AI agent pauses to ask the human a question
 */
export type QuestionAskedHandler = (question: QuestionRequest) => void;

/**
 * Connection status
 */
export type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface StreamingContextValue {
  /**
   * Subscribe to message updates for a specific agent
   * Fires when a complete message (user or assistant) is created/updated
   * @returns Cleanup function to unsubscribe
   */
  subscribeToMessageUpdates: (agentId: string, handler: MessageUpdateHandler) => () => void;

  /**
   * Subscribe to session updates for a specific agent
   * Fires when session metadata changes (e.g., revert state cleared)
   * @returns Cleanup function to unsubscribe
   */
  subscribeToSessionUpdates: (agentId: string, handler: SessionUpdateHandler) => () => void;

  /**
   * Subscribe to message removed events for a specific agent
   * Fires when a message is permanently deleted from the session
   * @returns Cleanup function to unsubscribe
   */
  subscribeToMessageRemoved: (agentId: string, handler: MessageRemovedHandler) => () => void;

  /**
   * Subscribe to part updates for a specific agent
   * @returns Cleanup function to unsubscribe
   */
  subscribeToPartUpdates: (agentId: string, handler: PartUpdateHandler) => () => void;

  /**
   * Subscribe to part delta events for a specific agent
   * Fires for every incremental text chunk during streaming (message.part.delta)
   * @returns Cleanup function to unsubscribe
   */
  subscribeToPartDeltas: (agentId: string, handler: PartDeltaHandler) => () => void;

  /**
   * Subscribe to agent idle events for a specific agent
   * @returns Cleanup function to unsubscribe
   */
  subscribeToAgentIdle: (agentId: string, handler: AgentIdleHandler) => () => void;

  /**
   * Subscribe to ALL agent idle events (use "*" as agentId)
   * Useful for global tree updates when any agent finishes
   * @returns Cleanup function to unsubscribe
   */
  subscribeToAllAgentIdle: (handler: AgentIdleHandler) => () => void;

  /**
   * Subscribe to agent error events
   * @returns Cleanup function to unsubscribe
   */
  subscribeToAgentError: (agentId: string, handler: AgentErrorHandler) => () => void;

  /**
   * Subscribe to session created events (all sessions, not agent-specific)
   * @returns Cleanup function to unsubscribe
   */
  subscribeToSessionCreated: (handler: SessionCreatedHandler) => () => void;

  /**
   * Subscribe to session status events for a specific agent
   * @returns Cleanup function to unsubscribe
   */
  subscribeToSessionStatus: (agentId: string, handler: SessionStatusHandler) => () => void;

  /**
   * Subscribe to ALL session status events (wildcard)
   * Useful for updating agent tree status without per-agent subscriptions
   * @returns Cleanup function to unsubscribe
   */
  subscribeToAllSessionStatus: (handler: AllSessionStatusHandler) => () => void;

  /**
   * Subscribe to agent created events (Birdhouse custom event)
   * Fires when a new agent is created and inserted into database
   * @returns Cleanup function to unsubscribe
   */
  subscribeToAgentCreated: (handler: AgentCreatedHandler) => () => void;

  /**
   * Subscribe to agent updated events (Birdhouse custom event)
   * Fires when an agent's properties are updated (e.g., title change)
   * @returns Cleanup function to unsubscribe
   */
  subscribeToAgentUpdated: (handler: AgentUpdatedHandler) => () => void;

  /**
   * Subscribe to event created events (Birdhouse custom event)
   * Fires when a system event (clone, etc.) is created and should be displayed
   * @returns Cleanup function to unsubscribe
   */
  subscribeToEventCreated: (handler: EventCreatedHandler) => () => void;

  /**
   * Subscribe to agent archived events (Birdhouse custom event)
   * Fires when an agent and its descendants are archived
   * @returns Cleanup function to unsubscribe
   */
  subscribeToAgentArchived: (handler: AgentArchivedHandler) => () => void;

  /**
   * Subscribe to agent unarchived events (Birdhouse custom event)
   * Fires when an agent and its descendants are unarchived
   * @returns Cleanup function to unsubscribe
   */
  subscribeToAgentUnarchived: (handler: AgentUnarchivedHandler) => () => void;

  /**
   * Subscribe to connection established events
   * Fires when SSE connection is (re)established after tab becomes visible
   * Useful for refreshing stale data when returning to a backgrounded tab
   * @returns Cleanup function to unsubscribe
   */
  subscribeToConnectionEstablished: (handler: ConnectionEstablishedHandler) => () => void;

  /**
   * Subscribe to skill updated events
   * Fires when skill metadata changes and cache should refresh
   * @returns Cleanup function to unsubscribe
   */
  subscribeToSkillUpdated: (handler: SkillUpdatedHandler) => () => void;

  /**
   * Subscribe to question asked events for a specific agent
   * Fires when an AI agent pauses to ask the human a question via the question tool
   * @returns Cleanup function to unsubscribe
   */
  subscribeToQuestionAsked: (agentId: string, handler: QuestionAskedHandler) => () => void;

  /**
   * Current connection status
   */
  connectionStatus: Accessor<ConnectionStatus>;
}

const StreamingContext = createContext<StreamingContextValue>();

export function useStreaming(): StreamingContextValue {
  const ctx = useContext(StreamingContext);
  if (!ctx) {
    throw new Error("useStreaming must be used within StreamingProvider");
  }
  return ctx;
}

interface StreamingProviderProps {
  workspaceId: string;
}

export const StreamingProvider: ParentComponent<StreamingProviderProps> = (props) => {
  const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>("connecting");

  // Maps to track agent-specific subscriptions
  const messageUpdateHandlers = new Map<string, Set<MessageUpdateHandler>>();
  const sessionUpdateHandlers = new Map<string, Set<SessionUpdateHandler>>();
  const messageRemovedHandlers = new Map<string, Set<MessageRemovedHandler>>();
  const partUpdateHandlers = new Map<string, Set<PartUpdateHandler>>();
  const partDeltaHandlers = new Map<string, Set<PartDeltaHandler>>();
  const agentIdleHandlers = new Map<string, Set<AgentIdleHandler>>();
  const agentErrorHandlers = new Map<string, Set<AgentErrorHandler>>();
  const sessionStatusHandlers = new Map<string, Set<SessionStatusHandler>>();

  // Maps to track agent-specific question asked subscriptions
  const questionAskedHandlers = new Map<string, Set<QuestionAskedHandler>>();

  // Sets to track global handlers (not agent-specific)
  const sessionCreatedHandlers = new Set<SessionCreatedHandler>();
  const allAgentIdleHandlers = new Set<AgentIdleHandler>();
  const allSessionStatusHandlers = new Set<AllSessionStatusHandler>();
  const agentCreatedHandlers = new Set<AgentCreatedHandler>();
  const agentUpdatedHandlers = new Set<AgentUpdatedHandler>();
  const eventCreatedHandlers = new Set<EventCreatedHandler>();
  const agentArchivedHandlers = new Set<AgentArchivedHandler>();
  const agentUnarchivedHandlers = new Set<AgentUnarchivedHandler>();
  const connectionEstablishedHandlers = new Set<ConnectionEstablishedHandler>();
  const skillUpdatedHandlers = new Set<SkillUpdatedHandler>();

  // EventSource connection (managed by visibility and workspace switching)
  let eventSource: EventSource | null = null;

  const connect = async (workspaceId: string) => {
    if (eventSource) return; // Already connected

    // Use workspace-scoped SSE endpoint
    const url = `${API_ENDPOINT_BASE}/workspace/${workspaceId}/events`;

    log.api.info(`Creating EventSource connection for workspace ${workspaceId}`);
    eventSource = new EventSource(url);
    setConnectionStatus("connecting");

    eventSource.onopen = () => {
      log.api.info("EventSource connected");
      setConnectionStatus("connected");
    };

    eventSource.onerror = () => {
      log.api.error("EventSource connection error");
      setConnectionStatus("disconnected");
    };

    eventSource.onmessage = handleMessage;
  };

  const disconnect = () => {
    if (!eventSource) return;
    log.api.info("Closing EventSource connection");
    eventSource.close();
    eventSource = null;
    setConnectionStatus("disconnected");
  };

  // Event handler helpers (extracted to reduce complexity)
  const handleMessageUpdate = (properties: Record<string, unknown>) => {
    const messageData = properties as {
      info: OpencodeMessage;
      agentId?: string;
    };

    if (!messageData.agentId) {
      // Event from non-Birdhouse agent - silently ignore
      return;
    }

    const handlers = messageUpdateHandlers.get(messageData.agentId);
    if (handlers) {
      for (const handler of handlers) {
        handler(messageData);
      }
    }
  };

  const handleSessionUpdate = (properties: Record<string, unknown>) => {
    const sessionData = properties as {
      info: Record<string, unknown>;
      agentId?: string;
    };

    if (!sessionData.agentId) {
      // Event from non-Birdhouse agent - silently ignore
      return;
    }

    const handlers = sessionUpdateHandlers.get(sessionData.agentId);
    if (handlers) {
      for (const handler of handlers) {
        handler(sessionData);
      }
    }
  };

  const handleMessageRemoved = (properties: Record<string, unknown>) => {
    const removeData = properties as {
      sessionID?: string;
      messageID: string;
      agentId?: string;
    };

    if (!removeData.agentId) {
      // Event from non-Birdhouse agent - silently ignore
      return;
    }

    const handlers = messageRemovedHandlers.get(removeData.agentId);
    if (handlers) {
      for (const handler of handlers) {
        handler(removeData.messageID);
      }
    }
  };

  const handlePartUpdate = (properties: Record<string, unknown>) => {
    const { part, agentId } = properties as {
      part: StreamingPart;
      agentId?: string;
    };

    if (!agentId) {
      // Event from non-Birdhouse agent - silently ignore
      return;
    }

    const handlers = partUpdateHandlers.get(agentId);
    if (handlers) {
      for (const handler of handlers) {
        handler(part);
      }
    }
  };

  const handlePartDelta = (properties: Record<string, unknown>) => {
    const deltaData = properties as {
      sessionID: string;
      messageID: string;
      partID: string;
      field: string;
      delta: string;
      agentId?: string;
    };

    if (!deltaData.agentId) {
      // Event from non-Birdhouse agent - silently ignore
      return;
    }

    const handlers = partDeltaHandlers.get(deltaData.agentId);
    if (handlers) {
      for (const handler of handlers) {
        handler(deltaData);
      }
    }
  };

  const handleAgentIdle = (properties: Record<string, unknown>) => {
    const { agentId } = properties as {
      sessionID: string;
      agentId?: string;
    };

    if (!agentId) {
      // Event from non-Birdhouse agent - silently ignore
      return;
    }

    // Notify agent-specific handlers
    const handlers = agentIdleHandlers.get(agentId);
    if (handlers) {
      for (const handler of handlers) {
        handler(agentId);
      }
    }

    // Notify global (all agents) handlers
    for (const handler of allAgentIdleHandlers) {
      handler(agentId);
    }
  };

  const handleAgentError = (properties: Record<string, unknown>) => {
    const errorData = properties as {
      sessionID?: string;
      agentId?: string;
      error: { name: string; data: { message: string } };
    };

    if (!errorData.agentId) {
      // Event from non-Birdhouse agent - silently ignore
      return;
    }

    const handlers = agentErrorHandlers.get(errorData.agentId);
    if (handlers) {
      for (const handler of handlers) {
        handler(errorData);
      }
    }
  };

  const handleSessionCreated = (properties: Record<string, unknown>) => {
    const sessionData = properties as {
      info?: { id: string; title: string };
      agentId?: string;
    };

    if (!sessionData.info) {
      return;
    }

    // Notify all session.created subscribers
    for (const handler of sessionCreatedHandlers) {
      const sessionInfo: { id: string; title: string; agentId?: string } = {
        id: sessionData.info.id,
        title: sessionData.info.title,
      };
      if (sessionData.agentId !== undefined) {
        sessionInfo.agentId = sessionData.agentId;
      }
      handler(sessionInfo);
    }
  };

  const handleSessionStatus = (properties: Record<string, unknown>) => {
    const statusData = properties as {
      sessionID?: string;
      agentId?: string;
      status?: SessionStatus;
    };

    if (!statusData.agentId || !statusData.status) {
      // Event from non-Birdhouse agent or malformed - silently ignore
      return;
    }

    // Notify global status subscribers (for tree-wide updates)
    for (const handler of allSessionStatusHandlers) {
      handler(statusData.agentId, statusData.status);
    }

    // Notify agent-specific status subscribers
    const handlers = sessionStatusHandlers.get(statusData.agentId);
    if (handlers) {
      for (const handler of handlers) {
        handler(statusData.status);
      }
    }
  };

  const handleAgentCreated = (properties: Record<string, unknown>) => {
    const createData = properties as {
      agentId: string;
      agent?: Record<string, unknown>;
    };

    if (!createData.agentId || !createData.agent) {
      return;
    }

    // Notify all agent created subscribers
    for (const handler of agentCreatedHandlers) {
      handler({ agentId: createData.agentId, agent: createData.agent });
    }
  };

  const handleAgentUpdated = (properties: Record<string, unknown>) => {
    const updateData = properties as {
      agentId: string;
      agent?: Record<string, unknown>;
    };

    if (!updateData.agent) {
      return;
    }

    // Notify all agent update subscribers with full agent data
    for (const handler of agentUpdatedHandlers) {
      handler(updateData.agentId, updateData.agent);
    }
  };

  const handleEventCreated = (properties: Record<string, unknown>) => {
    const eventData = properties as {
      agentId: string;
      event: {
        id: string;
        event_type: string;
        timestamp: number;
        actor_agent_id: string | null;
        actor_agent_title: string;
        source_agent_id: string | null;
        source_agent_title: string;
        target_agent_id: string | null;
        target_agent_title: string;
        metadata?: Record<string, unknown>;
      };
    };

    if (!eventData.agentId || !eventData.event) {
      return;
    }

    // Notify all event created subscribers
    for (const handler of eventCreatedHandlers) {
      handler(eventData.agentId, eventData.event);
    }
  };

  const handleAgentArchived = (properties: Record<string, unknown>) => {
    const archiveData = properties as {
      agentId: string;
      archivedCount: number;
      archivedIds: string[];
    };

    if (!archiveData.agentId || !archiveData.archivedIds) {
      return;
    }

    // Notify all agent archived subscribers
    for (const handler of agentArchivedHandlers) {
      handler({
        agentId: archiveData.agentId,
        archivedCount: archiveData.archivedCount,
        archivedIds: archiveData.archivedIds,
      });
    }
  };

  const handleAgentUnarchived = (properties: Record<string, unknown>) => {
    const unarchiveData = properties as {
      agentId: string;
      unarchivedCount: number;
      unarchivedIds: string[];
    };

    if (!unarchiveData.agentId || !unarchiveData.unarchivedIds) {
      return;
    }

    // Notify all agent unarchived subscribers
    for (const handler of agentUnarchivedHandlers) {
      handler({
        agentId: unarchiveData.agentId,
        unarchivedCount: unarchiveData.unarchivedCount,
        unarchivedIds: unarchiveData.unarchivedIds,
      });
    }
  };

  const handleQuestionAsked = (properties: Record<string, unknown>) => {
    const questionData = properties as {
      agentId?: string;
      id?: string;
      sessionID?: string;
      questions?: unknown[];
      tool?: { messageID: string; callID: string };
    };

    log.api.debug("question.asked SSE event received", {
      agentId: questionData.agentId,
      id: questionData.id,
      hasTool: !!questionData.tool,
      toolCallID: questionData.tool?.callID,
    });

    if (!questionData.agentId || !questionData.id || !questionData.questions) {
      // Malformed or non-Birdhouse-injected event - silently ignore
      return;
    }

    const question: QuestionRequest = {
      id: questionData.id,
      sessionID: questionData.sessionID || "",
      questions: questionData.questions as QuestionRequest["questions"],
      ...(questionData.tool !== undefined && { tool: questionData.tool }),
    };

    const handlers = questionAskedHandlers.get(questionData.agentId);
    if (handlers) {
      for (const handler of handlers) {
        handler(question);
      }
    }
  };

  const handleSkillUpdated = (properties: Record<string, unknown>) => {
    const skillUpdate = properties as {
      skillName?: string;
    };

    if (!skillUpdate.skillName) {
      log.api.warn("Invalid skill.updated event", properties);
      return;
    }

    for (const handler of skillUpdatedHandlers) {
      handler({ skillName: skillUpdate.skillName });
    }
  };

  const handleMessage = (event: MessageEvent) => {
    try {
      const serverEvent: ServerEvent = JSON.parse(event.data);

      // Dispatch to appropriate handler based on event type
      switch (serverEvent.type) {
        case "message.updated":
          handleMessageUpdate(serverEvent.properties);
          break;
        case "session.updated":
          handleSessionUpdate(serverEvent.properties);
          break;
        case "message.removed":
          handleMessageRemoved(serverEvent.properties);
          break;
        case "message.part.updated":
          handlePartUpdate(serverEvent.properties);
          break;
        case "message.part.delta":
          handlePartDelta(serverEvent.properties);
          break;
        case "session.idle":
          handleAgentIdle(serverEvent.properties);
          break;
        case "session.error":
          handleAgentError(serverEvent.properties);
          break;
        case "session.created":
          handleSessionCreated(serverEvent.properties);
          break;
        case "session.status":
          handleSessionStatus(serverEvent.properties);
          break;
        case "birdhouse.agent.created":
          handleAgentCreated(serverEvent.properties);
          break;
        case "birdhouse.agent.updated":
          handleAgentUpdated(serverEvent.properties);
          break;
        case "birdhouse.event.created":
          handleEventCreated(serverEvent.properties);
          break;
        case "birdhouse.agent.archived":
          handleAgentArchived(serverEvent.properties);
          break;
        case "birdhouse.agent.unarchived":
          handleAgentUnarchived(serverEvent.properties);
          break;
        case "question.asked":
          handleQuestionAsked(serverEvent.properties);
          break;
        case "birdhouse.skill.updated":
          handleSkillUpdated(serverEvent.properties);
          break;
        case "birdhouse.connection.established":
          // Connection established - notify subscribers to refresh stale data
          log.api.debug("SSE connection established, notifying subscribers");
          for (const handler of connectionEstablishedHandlers) {
            handler();
          }
          break;
      }
    } catch {
      // Ignore parse errors - stream might send non-JSON data
    }
  };

  // Reconnect when workspaceId changes
  createEffect(() => {
    const wsId = props.workspaceId;
    if (!wsId) return;

    // Close old connection if exists
    disconnect();

    // Open new connection for new workspace
    if (!document.hidden) {
      connect(wsId);
    }

    // Fire connection established event to notify subscribers to refresh data
    // Small delay to ensure SSE is ready
    setTimeout(() => {
      for (const handler of connectionEstablishedHandlers) {
        handler();
      }
    }, 100);
  });

  // Visibility management
  const handleVisibilityChange = () => {
    const wsId = props.workspaceId;
    if (!wsId) return;

    if (document.hidden) {
      log.api.info("Tab backgrounded, disconnecting SSE");
      disconnect();
    } else {
      log.api.info("Tab became visible, reconnecting SSE");
      connect(wsId);
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Cleanup on unmount
  onCleanup(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    disconnect();
    messageUpdateHandlers.clear();
    sessionUpdateHandlers.clear();
    messageRemovedHandlers.clear();
    partUpdateHandlers.clear();
    partDeltaHandlers.clear();
    agentIdleHandlers.clear();
    agentErrorHandlers.clear();
    sessionCreatedHandlers.clear();
    sessionStatusHandlers.clear();
    allAgentIdleHandlers.clear();
    allSessionStatusHandlers.clear();
    agentCreatedHandlers.clear();
    agentUpdatedHandlers.clear();
    eventCreatedHandlers.clear();
    agentArchivedHandlers.clear();
    agentUnarchivedHandlers.clear();
    connectionEstablishedHandlers.clear();
    skillUpdatedHandlers.clear();
    questionAskedHandlers.clear();
  });

  /**
   * Subscribe to message updates for an agent
   */
  const subscribeToMessageUpdates = (agentId: string, handler: MessageUpdateHandler): (() => void) => {
    if (!messageUpdateHandlers.has(agentId)) {
      messageUpdateHandlers.set(agentId, new Set());
    }
    messageUpdateHandlers.get(agentId)?.add(handler);

    // Return cleanup function
    return () => {
      const handlers = messageUpdateHandlers.get(agentId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageUpdateHandlers.delete(agentId);
        }
      }
    };
  };

  /**
   * Subscribe to session updates for an agent
   */
  const subscribeToSessionUpdates = (agentId: string, handler: SessionUpdateHandler): (() => void) => {
    if (!sessionUpdateHandlers.has(agentId)) {
      sessionUpdateHandlers.set(agentId, new Set());
    }
    sessionUpdateHandlers.get(agentId)?.add(handler);

    // Return cleanup function
    return () => {
      const handlers = sessionUpdateHandlers.get(agentId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          sessionUpdateHandlers.delete(agentId);
        }
      }
    };
  };

  /**
   * Subscribe to message removed events for an agent
   */
  const subscribeToMessageRemoved = (agentId: string, handler: MessageRemovedHandler): (() => void) => {
    if (!messageRemovedHandlers.has(agentId)) {
      messageRemovedHandlers.set(agentId, new Set());
    }
    messageRemovedHandlers.get(agentId)?.add(handler);

    // Return cleanup function
    return () => {
      const handlers = messageRemovedHandlers.get(agentId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageRemovedHandlers.delete(agentId);
        }
      }
    };
  };

  /**
   * Subscribe to part updates for an agent
   */
  const subscribeToPartUpdates = (agentId: string, handler: PartUpdateHandler): (() => void) => {
    if (!partUpdateHandlers.has(agentId)) {
      partUpdateHandlers.set(agentId, new Set());
    }
    partUpdateHandlers.get(agentId)?.add(handler);

    // Return cleanup function
    return () => {
      const handlers = partUpdateHandlers.get(agentId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          partUpdateHandlers.delete(agentId);
        }
      }
    };
  };

  /**
   * Subscribe to part delta events for an agent
   */
  const subscribeToPartDeltas = (agentId: string, handler: PartDeltaHandler): (() => void) => {
    if (!partDeltaHandlers.has(agentId)) {
      partDeltaHandlers.set(agentId, new Set());
    }
    partDeltaHandlers.get(agentId)?.add(handler);

    return () => {
      const handlers = partDeltaHandlers.get(agentId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          partDeltaHandlers.delete(agentId);
        }
      }
    };
  };

  /**
   * Subscribe to agent idle events
   */
  const subscribeToAgentIdle = (agentId: string, handler: AgentIdleHandler): (() => void) => {
    if (!agentIdleHandlers.has(agentId)) {
      agentIdleHandlers.set(agentId, new Set());
    }
    agentIdleHandlers.get(agentId)?.add(handler);

    return () => {
      const handlers = agentIdleHandlers.get(agentId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          agentIdleHandlers.delete(agentId);
        }
      }
    };
  };

  /**
   * Subscribe to agent error events
   */
  const subscribeToAgentError = (agentId: string, handler: AgentErrorHandler): (() => void) => {
    if (!agentErrorHandlers.has(agentId)) {
      agentErrorHandlers.set(agentId, new Set());
    }
    agentErrorHandlers.get(agentId)?.add(handler);

    return () => {
      const handlers = agentErrorHandlers.get(agentId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          agentErrorHandlers.delete(agentId);
        }
      }
    };
  };

  /**
   * Subscribe to ALL agent idle events (wildcard)
   */
  const subscribeToAllAgentIdle = (handler: AgentIdleHandler): (() => void) => {
    allAgentIdleHandlers.add(handler);

    return () => {
      allAgentIdleHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to session created events
   */
  const subscribeToSessionCreated = (handler: SessionCreatedHandler): (() => void) => {
    sessionCreatedHandlers.add(handler);

    return () => {
      sessionCreatedHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to session status events for an agent
   */
  const subscribeToSessionStatus = (agentId: string, handler: SessionStatusHandler): (() => void) => {
    if (!sessionStatusHandlers.has(agentId)) {
      sessionStatusHandlers.set(agentId, new Set());
    }
    sessionStatusHandlers.get(agentId)?.add(handler);

    return () => {
      const handlers = sessionStatusHandlers.get(agentId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          sessionStatusHandlers.delete(agentId);
        }
      }
    };
  };

  /**
   * Subscribe to ALL session status events (wildcard)
   */
  const subscribeToAllSessionStatus = (handler: AllSessionStatusHandler): (() => void) => {
    allSessionStatusHandlers.add(handler);

    return () => {
      allSessionStatusHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to agent created events (Birdhouse custom event)
   */
  const subscribeToAgentCreated = (handler: AgentCreatedHandler): (() => void) => {
    agentCreatedHandlers.add(handler);

    return () => {
      agentCreatedHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to agent updated events (Birdhouse custom event)
   */
  const subscribeToAgentUpdated = (handler: AgentUpdatedHandler): (() => void) => {
    agentUpdatedHandlers.add(handler);

    return () => {
      agentUpdatedHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to event created events (Birdhouse custom event)
   */
  const subscribeToEventCreated = (handler: EventCreatedHandler): (() => void) => {
    eventCreatedHandlers.add(handler);

    return () => {
      eventCreatedHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to agent archived events (Birdhouse custom event)
   */
  const subscribeToAgentArchived = (handler: AgentArchivedHandler): (() => void) => {
    agentArchivedHandlers.add(handler);

    return () => {
      agentArchivedHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to agent unarchived events (Birdhouse custom event)
   */
  const subscribeToAgentUnarchived = (handler: AgentUnarchivedHandler): (() => void) => {
    agentUnarchivedHandlers.add(handler);

    return () => {
      agentUnarchivedHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to connection established events
   */
  const subscribeToConnectionEstablished = (handler: ConnectionEstablishedHandler): (() => void) => {
    connectionEstablishedHandlers.add(handler);

    return () => {
      connectionEstablishedHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to skill updated events
   */
  const subscribeToSkillUpdated = (handler: SkillUpdatedHandler): (() => void) => {
    skillUpdatedHandlers.add(handler);

    return () => {
      skillUpdatedHandlers.delete(handler);
    };
  };

  /**
   * Subscribe to question asked events for a specific agent
   */
  const subscribeToQuestionAsked = (agentId: string, handler: QuestionAskedHandler): (() => void) => {
    if (!questionAskedHandlers.has(agentId)) {
      questionAskedHandlers.set(agentId, new Set());
    }
    questionAskedHandlers.get(agentId)?.add(handler);

    return () => {
      const handlers = questionAskedHandlers.get(agentId);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          questionAskedHandlers.delete(agentId);
        }
      }
    };
  };

  const value: StreamingContextValue = {
    subscribeToMessageUpdates,
    subscribeToSessionUpdates,
    subscribeToMessageRemoved,
    subscribeToPartUpdates,
    subscribeToPartDeltas,
    subscribeToAgentIdle,
    subscribeToAllAgentIdle,
    subscribeToAgentError,
    subscribeToSessionCreated,
    subscribeToSessionStatus,
    subscribeToAllSessionStatus,
    subscribeToAgentCreated,
    subscribeToAgentUpdated,
    subscribeToEventCreated,
    subscribeToAgentArchived,
    subscribeToAgentUnarchived,
    subscribeToConnectionEstablished,
    subscribeToSkillUpdated,
    subscribeToQuestionAsked,
    connectionStatus,
  };

  return <StreamingContext.Provider value={value}>{props.children}</StreamingContext.Provider>;
};
