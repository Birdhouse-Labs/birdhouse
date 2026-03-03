// ABOUTME: Handlers for question endpoints - listing pending questions and submitting replies
// ABOUTME: Used by GET /agents/:id/questions and POST /agents/:id/questions/:requestId/reply

import type { Context } from "hono";
import type { Deps } from "../../dependencies";

/**
 * GET /agents/:id/questions - List pending questions for an agent
 * Fetches all pending questions from OpenCode and filters to those matching the agent's session
 */
export async function getAgentQuestions(c: Context, deps: Pick<Deps, "agentsDB" | "opencode">) {
  const { agentsDB, opencode } = deps;
  const agentId = c.req.param("id");

  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
    return c.json({ error: `Agent ${agentId} not found` }, 404);
  }

  try {
    const allQuestions = await opencode.listPendingQuestions();
    const agentQuestions = allQuestions.filter((q) => q.sessionID === agent.session_id);
    return c.json(agentQuestions);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

/**
 * POST /agents/:id/questions/:requestId/reply - Reply to a pending question
 * Validates the reply body and forwards it to OpenCode
 */
export async function replyToAgentQuestion(c: Context, deps: Pick<Deps, "agentsDB" | "opencode">) {
  const { agentsDB, opencode } = deps;
  const agentId = c.req.param("id");
  const requestId = c.req.param("requestId");

  const agent = agentsDB.getAgentById(agentId);
  if (!agent) {
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

  try {
    await opencode.replyToQuestion(requestId, answers as string[][]);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
