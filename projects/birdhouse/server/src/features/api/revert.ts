// ABOUTME: Revert/unrevert endpoint handlers for resetting agent to a specific message
// ABOUTME: Revert returns the text of the user message being reverted to

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { extractRestorableComposerFileAttachments } from "../../lib/message-parts";

/**
 * POST /api/workspace/:workspaceId/agents/:id/revert
 * Revert agent session to a specific user message
 */
export async function revert(c: Context, deps: Pick<Deps, "agentsDB" | "opencode" | "log">) {
  const { agentsDB, opencode, log } = deps;
  const agentId = c.req.param("id");

  // Lookup agent
  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  try {
    // Parse request body
    const body = await c.req.json();
    const { messageId } = body;

    if (!messageId || typeof messageId !== "string") {
      return c.json({ error: "messageId is required and must be a string" }, 400);
    }

    log.server.info(
      {
        agent_id: agent.id,
        session_id: agent.session_id,
        message_id: messageId,
      },
      "Reverting session to message",
    );

    // Fetch messages BEFORE reverting (to extract text from the target message)
    const messages = await opencode.getMessages(agent.session_id);

    // Find the target message
    const targetMessage = messages.find((msg) => msg.info.id === messageId);
    if (!targetMessage) {
      return c.json({ error: `Message ${messageId} not found in session` }, 404);
    }

    // Verify it's a user message
    if (targetMessage.info.role !== "user") {
      return c.json({ error: "Can only revert to user messages" }, 400);
    }

    // Extract text from message parts
    const textParts = targetMessage.parts.filter((part) => part.type === "text");
    const messageText = textParts.map((part) => (part as { text: string }).text).join("\n");

    const attachments = extractRestorableComposerFileAttachments(targetMessage.parts);

    // Perform the revert
    await opencode.revertSession(agent.session_id, messageId);

    log.server.info(
      {
        agent_id: agent.id,
        session_id: agent.session_id,
        message_id: messageId,
      },
      "Session reverted successfully",
    );

    return c.json({
      success: true,
      messageText,
      attachments,
    });
  } catch (error) {
    log.server.error(
      {
        agent_id: agent.id,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to revert session",
    );

    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to revert session",
      },
      500,
    );
  }
}

/**
 * POST /api/workspace/:workspaceId/agents/:id/unrevert
 * Unrevert a previously reverted session
 */
export async function unrevert(c: Context, deps: Pick<Deps, "agentsDB" | "opencode" | "log">) {
  const { agentsDB, opencode, log } = deps;
  const agentId = c.req.param("id");

  // Lookup agent
  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  try {
    log.server.info(
      {
        agent_id: agent.id,
        session_id: agent.session_id,
      },
      "Unreverting session",
    );

    // Perform the unrevert
    await opencode.unrevertSession(agent.session_id);

    log.server.info(
      {
        agent_id: agent.id,
        session_id: agent.session_id,
      },
      "Session unreverted successfully",
    );

    return c.json({
      success: true,
    });
  } catch (error) {
    log.server.error(
      {
        agent_id: agent.id,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to unrevert session",
    );

    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to unrevert session",
      },
      500,
    );
  }
}
