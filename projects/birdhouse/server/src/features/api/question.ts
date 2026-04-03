// ABOUTME: Handlers for question endpoints - listing pending questions and submitting replies
// ABOUTME: Used by GET /agents/:id/questions and POST /agents/:id/questions/:requestId/reply

import type { Context } from "hono";
import type { Deps } from "../../dependencies";

/**
 * GET /agents/:id/questions - List pending questions for an agent
 * Fetches all pending questions from the harness and filters to those matching the agent's session.
 * Returns empty array if the session is idle — a pending question on an idle session is a leaked
 * OpenCode promise from an aborted run and cannot be answered.
 */
export async function getAgentQuestions(c: Context, deps: Pick<Deps, "agentsDB" | "harness" | "log">) {
  const { agentsDB, harness, log } = deps;
  const questionsCapability = harness.capabilities.questions;
  const agentId = c.req.param("id");

  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  try {
    if (!questionsCapability) {
      return c.json({ error: "Questions not supported by harness" }, 501);
    }

    const [allQuestions, allStatuses] = await Promise.all([
      questionsCapability.listPendingQuestions(),
      harness.getSessionStatus(),
    ]);

    // If the session is idle, any pending questions are leaked from an aborted run — not answerable
    const sessionStatus = allStatuses[agent.session_id] ?? { type: "idle" };
    if (sessionStatus.type === "idle") {
      log.server.debug({ agentId, sessionId: agent.session_id }, "Session is idle — returning no pending questions");
      return c.json([]);
    }

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
export async function replyToAgentQuestion(c: Context, deps: Pick<Deps, "agentsDB" | "harness" | "log">) {
  const { agentsDB, harness, log } = deps;
  const questionsCapability = harness.capabilities.questions;
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

  log.server.info({ agentId, requestId, answerCount: answers.length }, "Forwarding question reply to harness");

  try {
    if (!questionsCapability) {
      return c.json({ error: "Questions not supported by harness" }, 501);
    }

    await questionsCapability.replyToQuestion(requestId, answers as string[][]);
    log.server.info({ agentId, requestId }, "Question reply forwarded to harness successfully");
    return c.json({ ok: true });
  } catch (error) {
    log.server.error({ agentId, requestId, error }, "Failed to forward question reply to OpenCode");
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
