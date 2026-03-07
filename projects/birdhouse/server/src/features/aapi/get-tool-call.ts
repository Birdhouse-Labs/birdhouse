// ABOUTME: Gets one filtered tool call by call ID for targeted drill-down from agents.
// ABOUTME: Used by /aapi/agents/:id/tool-calls/:callId to avoid rereading full transcripts.

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { filterMessage } from "./helpers/message-filter";

export async function getToolCall(c: Context, deps: Pick<Deps, "agentsDB" | "opencode">) {
  const {
    agentsDB,
    opencode: { getMessages: getMessagesFromOpenCode },
  } = deps;

  const agentId = c.req.param("id");
  const callId = c.req.param("callId");

  try {
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    const messages = await getMessagesFromOpenCode(agent.session_id);

    for (const message of messages) {
      const matchingPart = message.parts.find(
        (part) =>
          (part as Record<string, unknown>).type === "tool" && (part as Record<string, unknown>).callID === callId,
      );

      if (!matchingPart) {
        continue;
      }

      const filteredMessage = filterMessage(
        {
          info: message.info,
          parts: [matchingPart],
        },
        "tool_call",
      );

      const [part] = filteredMessage.parts;
      return c.json({ info: filteredMessage.info, part });
    }

    return c.json({ error: `Tool call ${callId} not found for agent ${agentId}` }, 404);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
