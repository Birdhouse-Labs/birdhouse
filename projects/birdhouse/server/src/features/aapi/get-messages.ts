// ABOUTME: Get filtered messages from an agent (removes IDs, cost, metadata)
// ABOUTME: Used by /aapi/agents/:id/messages GET endpoint (unique to /aapi)

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import type { BirdhouseMessage as Message } from "../../harness";
import { filterMessagesForView } from "./helpers/message-filter";

/**
 * GET /agents/:id/messages - Get filtered and selected messages for plugin consumption
 * Supports mode parameter for message selection
 */
export async function getMessages(c: Context, deps: Pick<Deps, "agentsDB" | "harness">) {
  const {
    agentsDB,
    harness: { getMessages: getMessagesFromHarness },
  } = deps;

  const agentId = c.req.param("id");
  const mode = c.req.query("mode") || "last"; // Default: last assistant message

  try {
    // Validate mode parameter
    const validModes = ["last", "latest_turn", "all", "full"];
    if (!validModes.includes(mode)) {
      return c.json(
        {
          error: `Invalid mode: ${mode}. Valid values: ${validModes.join(", ")}`,
        },
        400,
      );
    }

    // Lookup agent to get session_id
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    const historyLimit = mode === "last" ? 1000 : undefined;
    const allMessages = await getMessagesFromHarness(agent.session_id, historyLimit);

    // SELECT messages based on mode
    let selected: Message[];

    switch (mode) {
      case "all": {
        // Return all messages (full conversation)
        selected = allMessages;
        break;
      }

      case "full": {
        selected = allMessages;
        break;
      }

      case "latest_turn": {
        // Find last user message index
        let lastUserIndex = -1;
        for (let i = allMessages.length - 1; i >= 0; i--) {
          if (allMessages[i].info.role === "user") {
            lastUserIndex = i;
            break;
          }
        }

        if (lastUserIndex === -1) {
          // No user messages - return all assistant messages
          selected = allMessages.filter((m) => m.info.role === "assistant");
        } else {
          // Return all messages after the last user message
          selected = allMessages.slice(lastUserIndex);
        }
        break;
      }
      default: {
        // Last assistant message only
        const assistantMessages = allMessages.filter((m) => m.info.role === "assistant");
        selected = assistantMessages.slice(-1);
        break;
      }
    }

    // FILTER for plugin consumption (remove IDs, cost, metadata)
    const view = mode === "full" ? "full" : mode === "latest_turn" ? "exchange" : "default";
    const filtered = filterMessagesForView(selected, view);

    return c.json(filtered);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
