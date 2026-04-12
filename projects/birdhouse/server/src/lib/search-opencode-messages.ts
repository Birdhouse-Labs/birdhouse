// ABOUTME: Searches message content in an OpenCode SQLite database
// ABOUTME: Matches text parts, tool outputs, and tool command inputs using LIKE queries

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getOpenCodeDataDir } from "./database-paths";

export interface MessagePart {
  type: "text" | "tool";
  text?: string;
  toolName?: string;
  command?: string;
  output?: string;
}

export interface MatchedMessage {
  id: string;
  role: string;
  parts: MessagePart[];
}

export interface MessageSearchResult {
  sessionId: string;
  matchedMessage: MatchedMessage;
  contextMessage: {
    id: string;
    role: string;
    parts: MessagePart[];
  } | null;
  matchedAt: number;
  sessionCreatedAt: number;
  sessionUpdatedAt: number;
}

/**
 * Search message content in an OpenCode database file.
 * Matches text parts, tool outputs, and tool command inputs.
 * Returns null if the database file does not exist.
 */
export function searchOpenCodeMessages(dbPath: string, query: string, limit: number): MessageSearchResult[] | null {
  if (!existsSync(dbPath)) return null;

  const db = new Database(dbPath, { readonly: true });
  const likeQuery = `%${query}%`;

  try {
    const matchingParts = db
      .query<
        {
          message_id: string;
          session_id: string;
          time_created: number;
          session_created: number;
          session_updated: number;
        },
        [string, number]
      >(
        `SELECT DISTINCT p.message_id, p.session_id, m.time_created,
                s.time_created as session_created, s.time_updated as session_updated
         FROM part p
         JOIN message m ON m.id = p.message_id
         JOIN session s ON s.id = p.session_id
         WHERE (
           (json_extract(p.data, '$.type') = 'text' AND json_extract(p.data, '$.text') LIKE ?1)
           OR
           (json_extract(p.data, '$.type') = 'tool' AND json_extract(p.data, '$.state.output') LIKE ?1)
           OR
           (json_extract(p.data, '$.type') = 'tool' AND json_extract(p.data, '$.state.input.command') LIKE ?1)
         )
         ORDER BY m.time_created DESC
         LIMIT ?2`,
      )
      .all(likeQuery, limit);

    const results: MessageSearchResult[] = [];

    for (const match of matchingParts) {
      const matchedMsg = db
        .query<{ id: string; data: string }, [string]>(`SELECT id, data FROM message WHERE id = ?`)
        .get(match.message_id);

      if (!matchedMsg) continue;

      const matchedParts = db
        .query<{ data: string }, [string]>(`SELECT data FROM part WHERE message_id = ? ORDER BY time_created ASC`)
        .all(match.message_id);

      const contextMsg = db
        .query<{ id: string; data: string }, [number, string]>(
          `SELECT m.id, m.data
           FROM message m
           WHERE m.session_id = ?2
             AND m.time_created < ?1
             AND json_extract(m.data, '$.role') = 'user'
         ORDER BY m.time_created DESC
           LIMIT 1`,
        )
        .get(match.time_created, match.session_id);

      let contextMessage = null;
      if (contextMsg) {
        const contextParts = db
          .query<{ data: string }, [string]>(`SELECT data FROM part WHERE message_id = ? ORDER BY time_created ASC`)
          .all(contextMsg.id);

        contextMessage = {
          id: contextMsg.id,
          role: (JSON.parse(contextMsg.data) as { role?: string }).role ?? "user",
          parts: contextParts
            .map((p) => JSON.parse(p.data) as { type: string; text?: string })
            .filter((p) => p.type === "text")
            .map((p) => ({ type: "text" as const, text: p.text })),
        };
      }

      results.push({
        sessionId: match.session_id,
        matchedMessage: {
          id: matchedMsg.id,
          role: (JSON.parse(matchedMsg.data) as { role?: string }).role ?? "unknown",
          parts: matchedParts
            .map(
              (p) =>
                JSON.parse(p.data) as {
                  type: string;
                  text?: string;
                  tool?: string;
                  state?: { input?: { command?: string }; output?: string };
                },
            )
            .filter((p) => ["text", "tool"].includes(p.type))
            .map((p) => ({
              type: p.type as "text" | "tool",
              ...(p.text ? { text: p.text } : {}),
              ...(p.tool ? { toolName: p.tool } : {}),
              ...(p.state?.input?.command ? { command: p.state.input.command } : {}),
              ...(p.state?.output ? { output: p.state.output } : {}),
            })),
        },
        contextMessage,
        matchedAt: match.time_created,
        sessionCreatedAt: match.session_created,
        sessionUpdatedAt: match.session_updated,
      });
    }

    return results;
  } finally {
    db.close();
  }
}

/**
 * Build the OpenCode database path for a workspace.
 */
export function getOpenCodeDbPath(workspaceId: string): string {
  return join(getOpenCodeDataDir(workspaceId), "data/opencode/opencode.db");
}
