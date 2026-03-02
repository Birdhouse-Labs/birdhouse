// ABOUTME: Agent-to-agent send message with sender metadata
// ABOUTME: Adds metadata for frontend to render sender identity

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import type { AgentRow } from "../../lib/agents-db";
import { sendMessage as baseSendMessage } from "../api/send-message";

/**
 * Helper: Get calling agent info from X-Session-ID header
 */
function getCallingAgent(c: Context, agentsDB: Deps["agentsDB"]): AgentRow | null {
  const sessionId = c.req.header("X-Session-ID");
  if (!sessionId) {
    return null;
  }
  return agentsDB.getAgentBySessionId(sessionId);
}

/**
 * POST /aapi/agents/:id/messages - Send message to agent with metadata
 */
export async function sendMessage(
  c: Context,
  deps: Pick<Deps, "agentsDB" | "dataDb" | "opencode" | "log" | "telemetry">,
) {
  const { agentsDB } = deps;

  // Get calling agent for metadata (if available)
  const callingAgent = getCallingAgent(c, agentsDB);

  // If we have a calling agent, modify the request body to include metadata
  if (callingAgent) {
    const body = await c.req.json();
    const modifiedBody = {
      ...body,
      metadata: {
        sent_by_agent_id: callingAgent.id,
        sent_by_agent_title: callingAgent.title,
      },
    };

    // Create a new context with modified body
    const modifiedRequest = new Request(c.req.raw, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: JSON.stringify(modifiedBody),
    });

    // Create new context with modified request
    const modifiedContext = {
      ...c,
      req: {
        ...c.req,
        json: async () => modifiedBody,
        raw: modifiedRequest,
        param: c.req.param.bind(c.req), // Preserve param method for route parameters
        query: c.req.query.bind(c.req), // Preserve query method for query parameters
      },
    } as Context;

    return baseSendMessage(modifiedContext, deps);
  }

  // No calling agent - just pass through
  return baseSendMessage(c, deps);
}
