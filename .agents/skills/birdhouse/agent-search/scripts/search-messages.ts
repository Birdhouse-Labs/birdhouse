// ABOUTME: CLI script for searching message content across agents in a workspace
// ABOUTME: Usage: bun scripts/search-messages.ts <workspace_id|all> <search_term> [--limit N]

import { Database } from "bun:sqlite";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BIRDHOUSE_DATA_ROOT = join(
  homedir(),
  "Library/Application Support/Birdhouse",
);

function getOpenCodeDbPath(workspaceId: string): string {
  return join(
    BIRDHOUSE_DATA_ROOT,
    "workspaces",
    workspaceId,
    "engine/data/opencode/opencode.db",
  );
}

function getAllWorkspaceIds(): string[] {
  const workspacesDir = join(BIRDHOUSE_DATA_ROOT, "workspaces");
  if (!existsSync(workspacesDir)) return [];
  return readdirSync(workspacesDir).filter((name) => name.startsWith("ws_"));
}

interface SearchMatch {
  workspaceId: string;
  sessionId: string;
  sessionTitle: string | null;
  matchedMessage: {
    id: string;
    role: string;
    parts: Array<{ type: string; text?: string; toolName?: string; output?: string }>;
  };
  contextMessage: {
    id: string;
    role: string;
    parts: Array<{ type: string; text?: string }>;
  } | null;
}

function searchWorkspace(workspaceId: string, query: string, limit: number): SearchMatch[] {
  const dbPath = getOpenCodeDbPath(workspaceId);
  if (!existsSync(dbPath)) return [];

  const db = new Database(dbPath, { readonly: true });
  const likeQuery = `%${query}%`;

  // Find parts that match the search term (text parts or tool output)
  // Return the message_id, session_id, and which field matched
  const matchingParts = db
    .query<
      { message_id: string; session_id: string; time_created: number },
      [string, string]
    >(
      `SELECT DISTINCT p.message_id, p.session_id, m.time_created
       FROM part p
       JOIN message m ON m.id = p.message_id
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

  const results: SearchMatch[] = [];

  for (const match of matchingParts) {
    // Get the session info
    const session = db
      .query<{ id: string; title: string | null }, [string]>(
        `SELECT id, title FROM session WHERE id = ?`,
      )
      .get(match.session_id);

    if (!session) continue;

    // Get all parts for the matched message
    const matchedParts = db
      .query<{ data: string }, [string]>(
        `SELECT data FROM part WHERE message_id = ? ORDER BY time_created ASC`,
      )
      .all(match.message_id);

    // Get the message role
    const matchedMsg = db
      .query<{ id: string; data: string }, [string]>(
        `SELECT id, data FROM message WHERE id = ?`,
      )
      .get(match.message_id);

    if (!matchedMsg) continue;
    const matchedMsgData = JSON.parse(matchedMsg.data);

    // Get the most recent user message before this message
    const contextMsg = db
      .query<{ id: string; data: string; time_created: number }, [number, string]>(
        `SELECT m.id, m.data, m.time_created
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
        .query<{ data: string }, [string]>(
          `SELECT data FROM part WHERE message_id = ? ORDER BY time_created ASC`,
        )
        .all(contextMsg.id);

      contextMessage = {
        id: contextMsg.id,
        role: JSON.parse(contextMsg.data).role ?? "user",
        parts: contextParts
          .map((p) => JSON.parse(p.data))
          .filter((p) => p.type === "text")
          .map((p) => ({ type: p.type, text: p.text })),
      };
    }

    results.push({
      workspaceId,
      sessionId: session.id,
      sessionTitle: session.title,
      matchedMessage: {
        id: matchedMsg.id,
        role: matchedMsgData.role ?? "unknown",
        parts: matchedParts
          .map((p) => JSON.parse(p.data))
          .filter((p) => ["text", "tool"].includes(p.type))
          .map((p) => ({
            type: p.type,
            ...(p.text ? { text: p.text } : {}),
            ...(p.toolName ? { toolName: p.toolName } : {}),
            ...(p.state?.input?.command ? { command: p.state.input.command } : {}),
            ...(p.state?.output ? { output: p.state.output } : {}),
          })),
      },
      contextMessage,
    });
  }

  db.close();
  return results;
}

function printMatch(match: SearchMatch, query: string): void {
  const RESET = "\x1b[0m";
  const BOLD = "\x1b[1m";
  const DIM = "\x1b[2m";
  const YELLOW = "\x1b[33m";
  const CYAN = "\x1b[36m";
  const GREEN = "\x1b[32m";
  const RED = "\x1b[31m";

  console.log(`\n${BOLD}${YELLOW}━━━ Session: ${match.sessionTitle ?? "(no title)"} ${DIM}[${match.sessionId.slice(0, 16)}...]${RESET}`);
  console.log(`${DIM}Workspace: ${match.workspaceId}${RESET}`);

  if (match.contextMessage) {
    console.log(`\n${GREEN}▶ Context (user message):${RESET}`);
    for (const part of match.contextMessage.parts) {
      if (part.text) {
        const preview = part.text.slice(0, 300).replace(/\n/g, " ");
        console.log(`  ${preview}${part.text.length > 300 ? "…" : ""}`);
      }
    }
  }

  console.log(`\n${CYAN}▶ Match (${match.matchedMessage.role}):${RESET}`);
  for (const part of match.matchedMessage.parts) {
    if (part.type === "text" && part.text) {
      // Highlight the matched query (escape special regex chars first)
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const highlighted = part.text
        .replace(new RegExp(escapedQuery, "gi"), (m) => `${RED}${m}${RESET}`)
        .slice(0, 400);
      console.log(`  ${highlighted}${part.text.length > 400 ? "…" : ""}`);
    } else if (part.type === "tool") {
      console.log(`  ${DIM}[tool: ${part.toolName ?? "unknown"}]${RESET}`);
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (part.command) {
        const cmdPreview = String(part.command)
          .replace(new RegExp(escapedQuery, "gi"), (m) => `${RED}${m}${RESET}`)
          .slice(0, 400);
        console.log(`  $ ${cmdPreview}${String(part.command).length > 400 ? "…" : ""}`);
      }
      if (part.output) {
        const outputPreview = String(part.output)
          .replace(new RegExp(escapedQuery, "gi"), (m) => `${RED}${m}${RESET}`)
          .slice(0, 400);
        console.log(`  ${outputPreview}${String(part.output).length > 400 ? "…" : ""}`);
      }
    }
  }
}

// --- Main ---

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: bun search-messages.ts <workspace_id|all> <search_term> [--limit N]");
  console.error("  workspace_id: ws_abc123...  or  'all' to search all workspaces");
  console.error("  --limit N: max results per workspace (default: 20)");
  process.exit(1);
}

const [workspaceArg, ...rest] = args;
const limitIdx = rest.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(rest[limitIdx + 1] ?? "20") : 20;
const queryParts = rest.filter((_, i) => i !== limitIdx && i !== limitIdx + 1);
const query = queryParts.join(" ");

if (!query.trim()) {
  console.error("Error: search term cannot be empty");
  process.exit(1);
}

const workspaceIds =
  workspaceArg === "all" ? getAllWorkspaceIds() : [workspaceArg];

if (workspaceIds.length === 0) {
  console.error("No workspaces found");
  process.exit(1);
}

console.log(
  `Searching ${workspaceIds.length === 1 ? `workspace ${workspaceIds[0]}` : `all ${workspaceIds.length} workspaces`} for: "${query}" (limit: ${limit} per workspace)`,
);

let totalMatches = 0;

for (const wsId of workspaceIds) {
  const matches = searchWorkspace(wsId, query, limit);
  totalMatches += matches.length;
  for (const match of matches) {
    printMatch(match, query);
  }
}

console.log(`\n\nFound ${totalMatches} match${totalMatches === 1 ? "" : "es"} total.`);
