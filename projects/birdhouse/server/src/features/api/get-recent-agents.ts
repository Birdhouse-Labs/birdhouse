// ABOUTME: Get recent agents with message context for @@ typeahead
// ABOUTME: Returns agents sorted by activity with last message snippets

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import type { Message } from "../../lib/opencode-client";

const MAX_AGENTS = 100;
const MAX_SNIPPET_LENGTH = 100;

interface RecentAgentResponse {
  id: string;
  title: string;
  session_id: string;
  parent_id: string | null;
  tree_id: string;
  lastMessageAt: number | null;
  lastUserMessage: string | null;
  lastAgentMessage: string | null;
}

/**
 * Extract text content from message parts
 * Joins all text parts and truncates to max length
 */
function extractMessageText(message: Message, maxLength: number): string {
  const textParts = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text);

  const fullText = textParts.join(" ").trim();

  if (fullText.length <= maxLength) {
    return fullText;
  }

  return `${fullText.slice(0, maxLength - 3)}...`;
}

/**
 * GET /api/agents/recent - Get recent agents with message context
 * Returns agents sorted by updated_at desc, with last message snippets
 */
export async function getRecentAgents(c: Context, deps: Pick<Deps, "agentsDB" | "opencode">) {
  const {
    agentsDB,
    opencode: { getMessages: getMessagesFromOpenCode },
  } = deps;

  try {
    // Parse optional query parameter
    const query = c.req.query("q") || "";

    // Get recent agents from database (filtered by query if provided)
    const agents = agentsDB.getRecentAgents(MAX_AGENTS, query);

    // Fetch message context for each agent
    const agentsWithContext: RecentAgentResponse[] = await Promise.all(
      agents.map(async (agent) => {
        try {
          const messages = await getMessagesFromOpenCode(agent.session_id);

          if (messages.length === 0) {
            return {
              id: agent.id,
              title: agent.title,
              session_id: agent.session_id,
              parent_id: agent.parent_id,
              tree_id: agent.tree_id,
              lastMessageAt: null,
              lastUserMessage: null,
              lastAgentMessage: null,
            };
          }

          // Find the most recent message timestamp
          const lastMessage = messages[messages.length - 1];
          const lastMessageAt = lastMessage.info.time.created;

          // Find last user message (search from end)
          let lastUserMessage: string | null = null;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].info.role === "user") {
              lastUserMessage = extractMessageText(messages[i], MAX_SNIPPET_LENGTH);
              break;
            }
          }

          // Find last agent message (search from end)
          let lastAgentMessage: string | null = null;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].info.role === "assistant") {
              lastAgentMessage = extractMessageText(messages[i], MAX_SNIPPET_LENGTH);
              break;
            }
          }

          return {
            id: agent.id,
            title: agent.title,
            session_id: agent.session_id,
            parent_id: agent.parent_id,
            tree_id: agent.tree_id,
            lastMessageAt,
            lastUserMessage,
            lastAgentMessage,
          };
        } catch (_error) {
          // If message fetch fails, return agent with null message fields
          return {
            id: agent.id,
            title: agent.title,
            session_id: agent.session_id,
            parent_id: agent.parent_id,
            tree_id: agent.tree_id,
            lastMessageAt: null,
            lastUserMessage: null,
            lastAgentMessage: null,
          };
        }
      }),
    );

    return c.json({
      agents: agentsWithContext,
      total: agentsWithContext.length,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
