// ABOUTME: Create agent for AAPI with cloning support (from_self, from_agent_id)
// ABOUTME: Used by /aapi/agents POST endpoint - optimized for agent-to-agent workflows

import type { Context } from "hono";
import type { Deps, Session } from "../../dependencies";
import { cloneAgent, createAgent } from "../../domain/agent-lifecycle";
import { sendFirstMessage } from "../../lib/agent-messaging";
import type { AgentRow } from "../../lib/agents-db";
import { validateModel } from "../../lib/model-validator";
import { getWorkspaceStream } from "../../lib/opencode-stream";

/**
 * Helper: Get current agent by session ID (for from_self)
 */
async function getCurrentAgentBySession(c: Context, deps: Pick<Deps, "agentsDB">): Promise<AgentRow | null> {
  // Try to get session ID from header or context
  const sessionId = c.req.header("X-Session-ID");
  if (!sessionId) {
    return null;
  }

  return deps.agentsDB.getAgentBySessionId(sessionId);
}

/**
 * POST /aapi/agents - Create agent with optional cloning
 */
export async function create(c: Context, deps: Pick<Deps, "harness" | "agentsDB" | "dataDb" | "log" | "telemetry">) {
  const {
    harness: { getMessages, createSession },
    agentsDB,
    log,
    telemetry,
  } = deps;

  try {
    // 1. Parse and validate request body
    const body = await c.req.json();
    const { prompt, title, model: requestModel, from_self, from_agent_id, from_message_id, wait } = body;

    // Validate required fields
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return c.json({ error: "prompt is required and must be a non-empty string" }, 400);
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return c.json({ error: "title is required and must be a non-empty string" }, 400);
    }

    // Validate mutually exclusive cloning sources
    if (from_self && from_agent_id) {
      return c.json({ error: "Cannot specify both from_self and from_agent_id" }, 400);
    }

    // Validate from_message_id requires a clone source
    if (from_message_id && !from_self && !from_agent_id) {
      return c.json({ error: "from_message_id requires either from_self or from_agent_id" }, 400);
    }

    // Determine if we're cloning
    const isCloning = from_self || from_agent_id;

    let newAgent: AgentRow;
    let session: Session;

    if (isCloning) {
      // ============================================================================
      // CLONING PATH
      // ============================================================================

      // Get source agent
      let sourceAgent: AgentRow | null = null;

      if (from_self) {
        sourceAgent = await getCurrentAgentBySession(c, { agentsDB });
        if (!sourceAgent) {
          return c.json({ error: "Cannot determine current agent for from_self" }, 400);
        }
      } else {
        sourceAgent = agentsDB.getAgentById(from_agent_id);
        if (!sourceAgent) {
          return c.json({ error: `Source agent ${from_agent_id} not found` }, 404);
        }
      }

      // Determine message ID to fork from
      let actualMessageId = from_message_id;

      if (from_self && !from_message_id) {
        // Smart detection: Find message before last user message
        log.server.info(
          { session_id: sourceAgent.session_id },
          "Smart from_self: finding message before last user message",
        );

        const messages = await getMessages(sourceAgent.session_id);

        // Find all user messages
        const userMessages = messages.filter((msg) => msg.info.role === "user");

        if (userMessages.length === 0) {
          return c.json(
            {
              error: "Cannot clone from_self: no user messages found in current session",
            },
            400,
          );
        }

        const lastUserMessage = userMessages[userMessages.length - 1];

        // Find the index of the last user message in the full message list
        const lastUserMessageIndex = messages.findIndex((msg) => msg.info.id === lastUserMessage.info.id);

        if (lastUserMessageIndex === 0) {
          return c.json(
            {
              error: "Cannot clone from_self: last user message is the first message",
            },
            400,
          );
        }

        // Get the message right before the last user message
        const messageBeforeLastUser = messages[lastUserMessageIndex - 1];
        actualMessageId = messageBeforeLastUser.info.id;

        log.server.info(
          {
            last_user_message: lastUserMessage.info.id,
            fork_from: actualMessageId,
          },
          "Smart from_self: forking from message before last user message",
        );
      }

      // Validate from_message_id exists if provided
      if (actualMessageId) {
        const messages = await getMessages(sourceAgent.session_id);
        const messageExists = messages.some((msg) => msg.info.id === actualMessageId);

        if (!messageExists) {
          return c.json(
            {
              error: `Message ${actualMessageId} not found in source agent session. Valid message IDs can be found by reading the agent's messages first.`,
            },
            400,
          );
        }
      }

      // Determine model (default to source's model if not specified)
      const model =
        requestModel && typeof requestModel === "string" && requestModel.trim()
          ? requestModel.trim()
          : sourceAgent.model;

      // Validate model if explicitly provided
      if (requestModel) {
        const modelError = await validateModel(model, deps.harness);
        if (modelError) {
          return c.json({ error: modelError }, 400);
        }
      }

      // Get calling agent for parent relationship
      const currentAgent = await getCurrentAgentBySession(c, { agentsDB });

      // Create stream for events
      const opencodeBase = c.get("opencodeBase");
      const workspace = c.get("workspace");

      if (!opencodeBase || !workspace?.directory) {
        return c.json({ error: "Workspace context not available" }, 500);
      }

      const workspaceDir = workspace.directory;
      const stream = getWorkspaceStream(opencodeBase, workspaceDir);

      // Clone the agent using the helper function
      newAgent = await cloneAgent(
        sourceAgent,
        { ...deps, stream },
        {
          messageId: actualMessageId,
          title: title.trim(),
          model: model,
          callingAgentId: currentAgent?.id, // If available, clone becomes child of calling agent
        },
      );

      // Insert timeline events for AAPI clone (action-centric model with deduplication)
      try {
        const now = Date.now();

        // Common event data for all three events
        const eventData = {
          event_type: "clone_created" as const,
          timestamp: now,
          actor_agent_id: currentAgent?.id ?? null,
          actor_agent_title: currentAgent?.title ?? null,
          source_agent_id: sourceAgent.id,
          source_agent_title: sourceAgent.title,
          target_agent_id: newAgent.id,
          target_agent_title: newAgent.title,
          metadata: null,
        };

        // Track which agent_ids we've inserted events for (prevents duplicates in self-cloning)
        const insertedAgentIds = new Set<string>();

        // Helper to conditionally insert event and emit SSE
        const insertEventIfUnique = (agentId: string, roleName: string) => {
          if (insertedAgentIds.has(agentId)) {
            log.server.info(
              {
                agent_id: agentId,
                role: roleName,
                reason: "duplicate",
              },
              `Skipped ${roleName} event (agent already has event on timeline)`,
            );
            return null;
          }

          insertedAgentIds.add(agentId);
          const event = agentsDB.insertEvent({
            agent_id: agentId,
            ...eventData,
          });

          stream.emitCustomEvent("birdhouse.event.created", {
            agentId: agentId,
            event: {
              id: event.id,
              event_type: event.event_type,
              timestamp: event.timestamp,
              actor_agent_id: event.actor_agent_id,
              actor_agent_title: event.actor_agent_title,
              source_agent_id: event.source_agent_id,
              source_agent_title: event.source_agent_title,
              target_agent_id: event.target_agent_id,
              target_agent_title: event.target_agent_title,
              metadata: event.metadata ? JSON.parse(event.metadata) : undefined,
            },
          });

          log.server.info(
            {
              agent_id: agentId,
              role: roleName,
              actor_agent: currentAgent?.id ?? "human",
              source_agent: sourceAgent.id,
              target_agent: newAgent.id,
            },
            `Inserted clone_created event for ${roleName}`,
          );

          return event;
        };

        // Event 1: On calling agent's timeline (if exists and unique)
        if (currentAgent) {
          insertEventIfUnique(currentAgent.id, "actor agent");
        }

        // Event 2: On source agent's timeline (if unique)
        insertEventIfUnique(sourceAgent.id, "source agent");

        // Event 3: On target agent's timeline (always unique - newly created)
        insertEventIfUnique(newAgent.id, "target agent");
      } catch (error) {
        log.server.error(
          {
            new_agent: newAgent.id,
            calling_agent: currentAgent?.id,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Failed to insert timeline events for AAPI clone",
        );
        throw error;
      }
    } else {
      // ============================================================================
      // NON-CLONING PATH (Fresh agent as child of current agent)
      // ============================================================================

      // Get current agent to determine parent
      const currentAgent = await getCurrentAgentBySession(c, { agentsDB });

      if (!currentAgent) {
        return c.json(
          {
            error: "Cannot determine current agent - session context required",
          },
          400,
        );
      }

      // Default model if not provided
      const model =
        requestModel && typeof requestModel === "string" && requestModel.trim()
          ? requestModel.trim()
          : currentAgent.model;

      // Validate model
      const modelError = await validateModel(model, deps.harness);
      if (modelError) {
        return c.json({ error: modelError }, 400);
      }

      // Create new OpenCode session
      log.server.info({ title }, "Creating OpenCode session");
      session = await createSession(title.trim());
      log.server.info(
        {
          sessionId: session.id,
          projectID: session.projectID,
          directory: session.directory,
        },
        "OpenCode session created",
      );

      // Insert as child of current agent
      const now = Date.now();
      const agentData: Omit<AgentRow, "id"> = {
        session_id: session.id,
        parent_id: currentAgent.id,
        tree_id: currentAgent.tree_id,
        level: currentAgent.level + 1,
        title: title.trim(),
        project_id: session.projectID,
        directory: session.directory,
        model,
        created_at: now,
        updated_at: now,
        cloned_from: null, // Not a clone
        cloned_at: null,
        archived_at: null,
      };

      const opencodeBase = c.get("opencodeBase");
      const workspace = c.get("workspace");

      if (!opencodeBase || !workspace?.directory) {
        return c.json({ error: "Workspace context not available" }, 500);
      }

      const workspaceDir = workspace.directory;
      const stream = getWorkspaceStream(opencodeBase, workspaceDir);
      newAgent = createAgent(agentsDB, agentData, stream, telemetry, deps.dataDb);

      log.server.info(
        {
          parent_agent: currentAgent.id,
          new_agent: newAgent.id,
          tree_id: newAgent.tree_id,
          level: newAgent.level,
        },
        "Fresh agent created as child",
      );
    }

    // ============================================================================
    // SEND PROMPT (both paths)
    // ============================================================================

    const shouldWait = wait !== false; // Default to true

    // Get calling agent for sender metadata
    const currentAgent = await getCurrentAgentBySession(c, { agentsDB });
    const senderMetadata = currentAgent
      ? {
          sent_by_agent_id: currentAgent.id,
          sent_by_agent_title: currentAgent.title,
        }
      : undefined;

    const result = await sendFirstMessage(deps, {
      agentId: newAgent.id,
      sessionId: newAgent.session_id,
      model: newAgent.model,
      prompt: prompt.trim(),
      wait: shouldWait,
      senderMetadata,
    });

    if (result.parts) {
      // Blocking mode - return agent with response
      return c.json({ ...newAgent, parts: result.parts }, 201);
    } else {
      // Async mode - return agent without waiting for response
      return c.json(newAgent, 201);
    }
  } catch (error) {
    log.server.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to create agent with cloning",
    );

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return c.json({ error: error.message }, 404);
      }
      if (error.message.includes("already exists")) {
        return c.json({ error: error.message }, 409);
      }
      if (error.message.includes("Failed to")) {
        return c.json({ error: error.message }, 502);
      }
    }

    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to create agent",
      },
      500,
    );
  }
}
