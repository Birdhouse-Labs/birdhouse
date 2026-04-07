// ABOUTME: Send a message to an agent (blocking or async mode, with optional cloning)
// ABOUTME: Used by /api/agents/:id/messages POST endpoint

import type { Context } from "hono";
import { getHarnessForAgent, type Deps } from "../../dependencies";
import { cloneAgent } from "../../domain/agent-lifecycle";
import { findSafeClonePoint } from "../../domain/clone-point";
import type { AgentHarness, BirdhouseInputFilePart } from "../../harness";
import type { AgentRow } from "../../lib/agents-db";
import { getWorkspaceEventBus } from "../../lib/birdhouse-event-bus";
import { BIRDHOUSE_SYSTEM_PROMPT } from "../../lib/birdhouse-system-prompt";
import { buildPromptParts, parseFileAttachments } from "../../lib/message-parts";
import { parseModelId } from "../../lib/model-validator";
import { buildSkillAttachmentPreview, enrichMessageWithSkillAttachments } from "../../lib/skill-attachments";
import { syncAgentTitle } from "../../lib/sync-agent-title";
import { generateTitle as generateTitleService } from "../../lib/title-generator";
import "../../types/context";

/**
 * POST /agents/:id/messages - Send message to agent
 */
export async function sendMessage(
  c: Context,
  deps: Pick<Deps, "agentsDB" | "dataDb" | "harnesses" | "log" | "telemetry">,
) {
  const { agentsDB, log, telemetry } = deps;

  // Get workspace context for stream creation
  const opencodeBase = c.get("opencodeBase");
  const workspace = c.get("workspace");

  if (!opencodeBase || !workspace?.directory) {
    return c.json({ error: "Workspace context not available" }, 500);
  }

  const workspaceDir = workspace.directory;
  const agentId = c.req.param("id");
  const { text, agent: agentName, clone_and_send, metadata, attachments } = await c.req.json();
  const rawText = typeof text === "string" ? text : "";
  let requestAttachments: BirdhouseInputFilePart[];
  try {
    requestAttachments = parseFileAttachments(attachments);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid attachments";
    return c.json({ error: message }, 400);
  }
  const workspaceRoot = workspaceDir;

  // Check for wait query parameter (default: true for blocking)
  const waitParam = c.req.query("wait");
  const shouldWait = waitParam !== "false"; // wait=false is the only way to disable

  // Lookup agent to get session_id and model
  const sourceAgent = agentsDB.getAgentById(agentId);
  if (!sourceAgent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  const sourceHarness = getHarnessForAgent(deps, sourceAgent);
  const visibleSkills = (await sourceHarness.capabilities.skills?.listSkills()) ?? [];
  const enrichedText = enrichMessageWithSkillAttachments(
    rawText,
    buildSkillAttachmentPreview(
      rawText,
      visibleSkills.map((skill) => ({
        name: skill.name,
        content: skill.content,
      })),
    ),
  );

  // Determine target agent (clone if requested, otherwise use original)
  let targetAgent: AgentRow = sourceAgent;
  let clonedAgent: AgentRow | undefined;

  if (clone_and_send === true) {
    // Clone the agent before sending the message
    log.server.info(
      {
        source_agent_id: sourceAgent.id,
        source_session: sourceAgent.session_id,
      },
      "Cloning agent for clone_and_send",
    );

    // Find safe clone point to avoid copying incomplete work
    // This is especially important when cloning a busy agent
    const messages = await sourceHarness.getMessages(sourceAgent.session_id);

    // DEBUG: Log message order returned by the harness
    log.server.info(
      {
        source_agent_id: sourceAgent.id,
        message_count: messages.length,
        message_order: messages.map((m, idx) => ({
          index: idx,
          id: m.info.id,
          role: m.info.role,
          time: m.info.time.created,
          finish: m.info.role === "assistant" ? ("finish" in m.info ? m.info.finish : "none") : "n/a",
        })),
      },
      "Messages received from harness (should be chronological/oldest-first)",
    );

    const clonePointMessageId = findSafeClonePoint(messages);

    log.server.info(
      {
        source_agent_id: sourceAgent.id,
        message_count: messages.length,
        clone_point_message_id: clonePointMessageId ?? "none (full copy)",
        expected_behavior: clonePointMessageId
          ? `Will clone FROM message ${clonePointMessageId} (excludes it and everything after)`
          : "Will clone entire conversation (all messages complete)",
      },
      "Determined safe clone point",
    );

    // DEBUG: Log what we're passing to cloneAgent
    log.server.info(
      {
        source_agent_id: sourceAgent.id,
        clone_point_message_id: clonePointMessageId ?? "undefined (full copy)",
        interpretation: clonePointMessageId
          ? "Clone will exclude the message with this ID and everything after it"
          : "Clone will copy all messages (no exclusions)",
      },
      "Passing clone point to cloneAgent",
    );

    // Clone with temporary title (will be replaced after message sent)
    const workspaceDir = workspace.directory || workspaceRoot;
    const birdhouseEventBus = getWorkspaceEventBus(workspaceDir);
    clonedAgent = await cloneAgent(
      sourceAgent,
      {
        harness: sourceHarness,
        agentsDB: deps.agentsDB,
        dataDb: deps.dataDb,
        log: deps.log,
        telemetry: deps.telemetry,
        birdhouseEventBus,
      },
      {
        title: "Cloning Agent...",
        messageId: clonePointMessageId,
      },
    );

    log.server.info(
      {
        source_agent: sourceAgent.id,
        cloned_agent: clonedAgent.id,
        tree_id: clonedAgent.tree_id,
        level: clonedAgent.level,
      },
      "Agent cloned successfully for clone_and_send",
    );

    // Insert timeline events for clone_and_send (action-centric model)
    try {
      const now = Date.now();
      const birdhouseEventBus = getWorkspaceEventBus(workspaceDir);

      // Common event data for both events (human-initiated, so actor is null)
      const eventData = {
        event_type: "clone_created" as const,
        timestamp: now,
        actor_agent_id: null, // Human performed the action
        actor_agent_title: null,
        source_agent_id: sourceAgent.id,
        source_agent_title: sourceAgent.title,
        target_agent_id: clonedAgent.id,
        target_agent_title: clonedAgent.title,
        metadata: null,
      };

      // Event 1: On source agent's timeline
      const sourceEvent = agentsDB.insertEvent({
        agent_id: sourceAgent.id,
        ...eventData,
      });

      birdhouseEventBus.emit({
        type: "birdhouse.event.created",
        properties: {
          agentId: sourceAgent.id,
          event: {
            id: sourceEvent.id,
            event_type: sourceEvent.event_type,
            timestamp: sourceEvent.timestamp,
            actor_agent_id: sourceEvent.actor_agent_id,
            actor_agent_title: sourceEvent.actor_agent_title,
            source_agent_id: sourceEvent.source_agent_id,
            source_agent_title: sourceEvent.source_agent_title,
            target_agent_id: sourceEvent.target_agent_id,
            target_agent_title: sourceEvent.target_agent_title,
            metadata: sourceEvent.metadata ? JSON.parse(sourceEvent.metadata) : undefined,
          },
        },
      });

      // Event 2: On target agent's timeline
      const targetEvent = agentsDB.insertEvent({
        agent_id: clonedAgent.id,
        ...eventData,
      });

      birdhouseEventBus.emit({
        type: "birdhouse.event.created",
        properties: {
          agentId: clonedAgent.id,
          event: {
            id: targetEvent.id,
            event_type: targetEvent.event_type,
            timestamp: targetEvent.timestamp,
            actor_agent_id: targetEvent.actor_agent_id,
            actor_agent_title: targetEvent.actor_agent_title,
            source_agent_id: targetEvent.source_agent_id,
            source_agent_title: targetEvent.source_agent_title,
            target_agent_id: targetEvent.target_agent_id,
            target_agent_title: targetEvent.target_agent_title,
            metadata: targetEvent.metadata ? JSON.parse(targetEvent.metadata) : undefined,
          },
        },
      });

      log.server.info(
        {
          source_agent: sourceAgent.id,
          cloned_agent: clonedAgent.id,
        },
        "Timeline events inserted and streamed for clone_and_send",
      );
    } catch (error) {
      log.server.error(
        {
          source_agent: sourceAgent.id,
          cloned_agent: clonedAgent.id,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to insert timeline events for clone_and_send",
      );
      throw error;
    }

    // Generate title for cloned agent (fire-and-forget)
    const clonedAgentId = clonedAgent.id; // Capture for error handler
    const workspaceId = workspace.workspace_id;
    generateAndUpdateTitleForClone(
      deps,
      clonedAgentId,
      rawText,
      sourceAgent.title,
        workspaceId,
        opencodeBase,
        workspaceDir,
        sourceHarness,
      ).catch((error) => {
      log.server.error(
        {
          agentId: clonedAgentId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to generate title for cloned agent",
      );
    });

    targetAgent = clonedAgent;
  }

  const targetHarness = getHarnessForAgent(deps, targetAgent);

  log.server.info(
    {
      agentId: targetAgent.id,
      sessionId: targetAgent.session_id,
      textLength: enrichedText.length,
      model: targetAgent.model,
      wait: shouldWait,
      isClone: !!clonedAgent,
    },
    "Sending message to agent",
  );

  let providerID: string;
  let modelID: string;
  try {
    ({ providerID, modelID } = parseModelId(targetAgent.model));
  } catch {
    return c.json({ error: `Invalid model format in agent record: ${targetAgent.model}` }, 500);
  }

  const messageParts = buildPromptParts(enrichedText, requestAttachments, metadata);

  if (messageParts.length === 0) {
    return c.json({ error: "Message must include text or attachments" }, 400);
  }

  if (!shouldWait) {
    // Async mode: Fire-and-forget (detach from the process)
    // Build collaboration context if tagged agents are present
    targetHarness
      .sendMessage(targetAgent.session_id, enrichedText, {
        model: { providerID, modelID },
        agent: agentName,
        system: BIRDHOUSE_SYSTEM_PROMPT,
        parts: messageParts,
        noReply: true,
      })
      .then((messageResponse) => {
        agentsDB.updateAgentTimestamp(targetAgent.id);
        if (messageResponse) telemetry.recordMessageTokens(targetAgent.id, messageResponse);
        log.server.info(
          {
            agentId: targetAgent.id,
          },
          "Async message completed",
        );
      })
      .catch((error) => {
        log.server.error(
          {
            agentId: targetAgent.id,
            error: error.message,
          },
          "Async message failed",
        );
      });

    // Return immediately
    log.server.info({ agentId: targetAgent.id }, "Message sent async (detached)");

    // Include cloned agent info if we cloned
    const response: { sent: boolean; async: boolean; cloned_agent?: AgentRow } = {
      sent: true,
      async: true,
    };
    if (clonedAgent) {
      response.cloned_agent = clonedAgent;
    }

    return c.json(response);
  }

  const messageResponse = await targetHarness.sendMessage(targetAgent.session_id, enrichedText, {
    model: { providerID, modelID },
    agent: agentName,
    system: BIRDHOUSE_SYSTEM_PROMPT,
    parts: messageParts,
  });

  if (!messageResponse) {
    throw new Error("No message response received from harness");
  }

  // Update agent's updated_at timestamp
  agentsDB.updateAgentTimestamp(targetAgent.id);
  try {
    telemetry.recordMessageTokens(targetAgent.id, messageResponse);
  } catch {
    // Never let telemetry errors affect message sending
  }

  log.server.info(
    {
      agentId: targetAgent.id,
      messageId: messageResponse.info.id,
    },
    "Message sent successfully (blocking)",
  );

  // Include cloned agent info if we cloned
  const response = clonedAgent ? { ...messageResponse, cloned_agent: clonedAgent } : messageResponse;

  return c.json(response);
}

/**
 * Generate title for cloned agent and update (async helper)
 */
async function generateAndUpdateTitleForClone(
  deps: Pick<Deps, "agentsDB" | "log" | "harnesses">,
  agentId: string,
  message: string,
  sourceTitle: string,
  _workspaceId: string,
  _opencodeBase: string,
  workspaceDir: string,
  harness: Pick<AgentHarness, "updateSessionTitle">,
): Promise<void> {
  const { agentsDB, log } = deps;

  try {
    // Construct message with clone context for better title generation
    const contextMessage = `This is a clone/continuation of "${sourceTitle}". User message: ${message}`;

    log.server.info({ agentId, sourceTitle, messageLength: message.length }, "Generating title for cloned agent");

    // Call title generation service directly (no HTTP request needed)
    const result = await generateTitleService(deps, {
      message: contextMessage.trim(),
    });

    const generatedTitle = result.title;

    log.server.info({ agentId, generatedTitle, sourceTitle }, "Clone title generated successfully");

    // Update agent title in Birdhouse, sync to the harness session, and emit SSE event
    await syncAgentTitle(
      {
        agentsDB,
        harness,
        workspaceDir,
        log,
      },
      agentId,
      generatedTitle,
    );

    log.server.info({ agentId, title: generatedTitle }, "Clone agent title updated and event emitted");
  } catch (error) {
    log.server.error(
      {
        agentId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to generate and update title for clone",
    );
    throw error;
  }
}
