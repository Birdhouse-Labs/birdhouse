// ABOUTME: Get agent by OpenCode session ID
// ABOUTME: Used by /api/agents/by-session/:session_id and /aapi/agents/by-session/:session_id

import type { Context } from "hono";
import type { Deps } from "../../dependencies";

/**
 * GET /agents/by-session/:session_id - Get agent by OpenCode session ID
 */
export async function getBySession(c: Context, deps: Pick<Deps, "agentsDB">) {
  const { agentsDB } = deps;
  const sessionId = c.req.param("session_id");

  try {
    const agent = agentsDB.getAgentBySessionId(sessionId);
    if (!agent) {
      return c.json({ error: `Agent with session ${sessionId} not found` }, 404);
    }

    return c.json(agent);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
