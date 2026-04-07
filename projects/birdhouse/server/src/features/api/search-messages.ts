// ABOUTME: Handles GET /api/workspace/:workspaceId/agents/search for message content search
// ABOUTME: Searches text parts, tool outputs, and tool inputs across the OpenCode database

import type { Context } from "hono";
import type { Deps } from "../../dependencies";

export async function searchMessages(c: Context, deps: Pick<Deps, "agentsDB" | "searchMessages">) {
  const q = c.req.query("q");
  if (!q || q.trim().length === 0) {
    return c.json({ error: "q parameter is required and must not be empty" }, 400);
  }

  const limitParam = c.req.query("limit");
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 20) : 20;

  const workspace = c.get("workspace");
  const workspaceId: string = workspace?.workspace_id ?? "";

  const rawResults = deps.searchMessages(workspaceId, q, limit);
  const matches = rawResults ?? [];

  const results = matches.map((match) => {
    const agent = deps.agentsDB.getAgentBySessionId(match.sessionId);

    return {
      agentId: agent?.id ?? null,
      sessionId: match.sessionId,
      title: agent?.title ?? null,
      matchedMessage: match.matchedMessage,
      contextMessage: match.contextMessage,
      matchedAt: match.matchedAt,
      sessionCreatedAt: match.sessionCreatedAt,
      sessionUpdatedAt: match.sessionUpdatedAt,
    };
  });

  return c.json({ results });
}
