// ABOUTME: Get last message snippet for a single agent — used by the typeahead recent list
// ABOUTME: Returns lastMessageAt, lastUserMessage, and lastAgentMessage for one agent by ID

import type { Context } from "hono";
import { type Deps, getHarnessForAgent } from "../../dependencies";
import type { BirdhouseMessage as Message } from "../../harness";

const MAX_SNIPPET_LENGTH = 200;

interface AgentSnippetResponse {
  lastMessageAt: number | null;
  lastUserMessage: {
    text: string;
    isAgentSent: boolean;
    sentByAgentTitle?: string;
  } | null;
  lastAgentMessage: string | null;
}

/**
 * Extract text content from message parts, truncated to maxLength
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
 * GET /api/agents/:id/messages/snippet
 * Returns the last user and assistant message snippets for a single agent.
 * Used by the typeahead dialog to lazily load per-card previews.
 */
export async function getAgentSnippet(c: Context, deps: Pick<Deps, "agentsDB" | "harnesses">) {
  const { agentsDB } = deps;
  const agentId = c.req.param("id");

  try {
    const agent = agentsDB.getAgentById(agentId);
    if (!agent) {
      return c.json({ error: `Agent ${agentId} not found` }, 404);
    }

    const harness = getHarnessForAgent(deps, agent);
    const messages = await harness.getMessages(agent.session_id, 100);

    if (messages.length === 0) {
      return c.json<AgentSnippetResponse>({
        lastMessageAt: null,
        lastUserMessage: null,
        lastAgentMessage: null,
      });
    }

    const lastMessage = messages[messages.length - 1];
    const lastMessageAt = lastMessage.info.time.created;

    // Find last user message (search from end)
    let lastUserMessage: AgentSnippetResponse["lastUserMessage"] = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.info.role === "user") {
        const text = extractMessageText(msg, MAX_SNIPPET_LENGTH);
        const firstTextPart = msg.parts.find((p) => p.type === "text") as
          | { type: "text"; text: string; metadata?: Record<string, unknown> }
          | undefined;
        const metadata = firstTextPart?.metadata;
        const isAgentSent = !!(metadata?.sent_by_agent_id || metadata?.sent_by_agent_title);
        lastUserMessage = {
          text,
          isAgentSent,
          sentByAgentTitle: metadata?.sent_by_agent_title as string | undefined,
        };
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

    return c.json<AgentSnippetResponse>({
      lastMessageAt,
      lastUserMessage,
      lastAgentMessage,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
