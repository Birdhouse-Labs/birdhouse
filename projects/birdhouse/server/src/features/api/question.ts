// ABOUTME: Handlers for question endpoints - listing pending questions and submitting replies
// ABOUTME: Used by GET /agents/:id/questions and POST /agents/:id/questions/:requestId/reply

import type { Context } from "hono";
import type { Deps } from "../../dependencies";

/**
 * GET /agents/:id/questions - List pending questions for an agent
 * Fetches all pending questions from OpenCode and filters to those matching the agent's session
 */
export async function getAgentQuestions(c: Context, deps: Pick<Deps, "agentsDB" | "opencode" | "log">) {
  const { agentsDB, opencode, log } = deps;
  const agentId = c.req.param("id");

  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  try {
    const allQuestions = await opencode.listPendingQuestions();
    const agentQuestions = allQuestions.filter((q) => q.sessionID === agent.session_id);
    log.server.debug(
      { agentId, sessionId: agent.session_id, count: agentQuestions.length },
      "Listed pending questions for agent",
    );
    return c.json(agentQuestions);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

/**
 * POST /agents/:id/questions/:requestId/reply - Reply to a pending question
 * Validates the reply body and forwards it to OpenCode
 */
export async function replyToAgentQuestion(c: Context, deps: Pick<Deps, "agentsDB" | "opencode" | "log">) {
  const { agentsDB, opencode, log } = deps;
  const agentId = c.req.param("id");
  const requestId = c.req.param("requestId");

  log.server.info({ agentId, requestId }, "Question reply request received");

  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    log.server.warn({ agentId, requestId }, "Question reply: agent not found");
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "answers is required and must be an array" }, 400);
  }

  const { answers } = body as { answers?: unknown };
  if (!Array.isArray(answers)) {
    return c.json({ error: "answers is required and must be an array" }, 400);
  }

  log.server.info({ agentId, requestId, answerCount: answers.length }, "Forwarding question reply to OpenCode");

  // Resolve a tool call ID (toolu_...) to the actual question ID (que_...) if needed.
  // The frontend may send block.callID as a fallback when the pending question lookup fails.
  let resolvedRequestId = requestId;
  if (!requestId.startsWith("que_")) {
    const allQuestions = await opencode.listPendingQuestions();
    const match = allQuestions.find((q) => q.sessionID === agent.session_id && q.tool?.callID === requestId);
    if (match) {
      resolvedRequestId = match.id;
      log.server.info({ agentId, requestId, resolvedRequestId }, "Resolved tool callID to question ID");
    } else {
      log.server.warn({ agentId, requestId }, "Could not resolve tool callID to question ID - forwarding as-is");
    }
  }

  try {
    await opencode.replyToQuestion(resolvedRequestId, answers as string[][]);
    log.server.info({ agentId, requestId: resolvedRequestId }, "Question reply forwarded to OpenCode successfully");
    return c.json({ ok: true });
  } catch (error) {
    log.server.error({ agentId, requestId: resolvedRequestId, error }, "Failed to forward question reply to OpenCode");
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
