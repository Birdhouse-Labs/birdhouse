// ABOUTME: Local verification script for telemetry token tracking correctness
// ABOUTME: Compares raw Supabase rows and get_telemetry_totals() against live UI token counts

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = "https://hzqxwcbohrtxyvmmamsn.supabase.co";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? "sb_secret_VPjBr9BqB3dZxu62hTyQzA_ccMDo4MW";

const BIRDHOUSE_API = "http://localhost:50121";
const TELEMETRY_ROW_LIMIT = 10;

// ============================================================================
// Supabase helpers
// ============================================================================

function supabaseHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };
}

async function supabaseGet(path: string): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers: supabaseHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase GET ${path} failed ${res.status}: ${body}`);
  }
  return res.json();
}

async function supabaseRpc(fn: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase RPC ${fn} failed ${res.status}: ${body}`);
  }
  return res.json();
}

// ============================================================================
// Type definitions
// ============================================================================

interface TelemetryRow {
  id: string;
  created_at: string;
  install_id: string;
  agent_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
}

interface TelemetryTotals {
  agents_created: number;
  total_tokens: number;
}

interface WorkspaceRecord {
  workspace_id: string;
  directory: string;
  title: string | null;
  opencode_port: number | null;
}

interface AgentRecord {
  id: string;
  title: string;
  session_id: string;
  directory: string;
  model: string;
  opencodePort: number; // resolved from workspace
}

type AgentNode = AgentRecord & { children: AgentNode[] };

interface AgentTree {
  root: AgentNode;
}

interface OpenCodeTokens {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

interface OpenCodeMessage {
  info: {
    role: "user" | "assistant";
    tokens?: OpenCodeTokens;
  };
  parts: unknown[];
}

// ============================================================================
// Section A: Raw telemetry rows
// ============================================================================

async function checkRawRows(): Promise<TelemetryRow[]> {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SECTION A: Raw telemetry_tokens rows (most recent first)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const rows = (await supabaseGet(
    `/rest/v1/telemetry_tokens?order=created_at.desc&limit=${TELEMETRY_ROW_LIMIT}`,
  )) as TelemetryRow[];

  if (rows.length === 0) {
    console.log("  (no rows found)");
    return rows;
  }

  for (const row of rows) {
    const total =
      row.input_tokens +
      row.output_tokens +
      row.cache_read_tokens +
      row.cache_write_tokens +
      row.reasoning_tokens;

    const agentIdOk = row.agent_id !== null ? "✓" : "✗ NULL";
    const cacheOk = row.cache_read_tokens > 0 ? "✓" : "✗ ZERO";

    console.log(`\n  id:           ${row.id}`);
    console.log(`  created_at:   ${row.created_at}`);
    console.log(`  agent_id:     ${row.agent_id ?? "NULL"} [${agentIdOk}]`);
    console.log(
      `  input:        ${row.input_tokens.toLocaleString()}  output: ${row.output_tokens.toLocaleString()}  reasoning: ${row.reasoning_tokens.toLocaleString()}`,
    );
    console.log(
      `  cache_read:   ${row.cache_read_tokens.toLocaleString()} [${cacheOk}]  cache_write: ${row.cache_write_tokens.toLocaleString()}`,
    );
    console.log(`  total:        ${total.toLocaleString()}`);
  }

  const nullAgentIds = rows.filter((r) => r.agent_id === null).length;
  const zeroCacheRead = rows.filter((r) => r.cache_read_tokens === 0).length;

  console.log("\n  ── Summary ──");
  console.log(`  Rows fetched:          ${rows.length}`);
  console.log(`  Null agent_id:         ${nullAgentIds} ${nullAgentIds > 0 ? "⚠️" : "✓"}`);
  console.log(`  Zero cache_read_tokens: ${zeroCacheRead} ${zeroCacheRead > 0 ? "⚠️" : "✓"}`);

  return rows;
}

// ============================================================================
// Section B: get_telemetry_totals()
// ============================================================================

async function checkTotals(): Promise<TelemetryTotals> {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SECTION B: get_telemetry_totals()");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const totals = (await supabaseRpc("get_telemetry_totals")) as TelemetryTotals;

  console.log(`\n  agents_created: ${totals.agents_created.toLocaleString()}`);
  console.log(`  total_tokens:   ${totals.total_tokens.toLocaleString()}`);
  console.log(
    `  (uses DISTINCT ON agent_id ORDER BY created_at DESC — latest row per agent, all token fields summed)`,
  );

  return totals;
}

// ============================================================================
// Section C: UI comparison
// ============================================================================

function flattenAgents(trees: AgentTree[]): AgentRecord[] {
  const result: AgentRecord[] = [];
  function walk(node: AgentNode) {
    result.push(node);
    for (const child of node.children ?? []) {
      walk(child);
    }
  }
  for (const tree of trees) {
    walk(tree.root);
  }
  return result;
}

async function getLastAssistantTokens(
  agent: AgentRecord,
): Promise<{ tokens: OpenCodeTokens; total: number } | null> {
  const opencodeBase = `http://localhost:${agent.opencodePort}`;
  const url = `${opencodeBase}/session/${agent.session_id}/message?directory=${encodeURIComponent(agent.directory)}`;
  let messages: OpenCodeMessage[];
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    messages = (await res.json()) as OpenCodeMessage[];
  } catch {
    return null;
  }

  // Messages are oldest-first from the raw OpenCode API; use findLast() for the most recent
  const lastAssistant = messages.findLast((msg) => {
    if (msg.info.role !== "assistant") return false;
    const t = msg.info.tokens;
    if (!t) return false;
    return t.input + t.output + t.reasoning + t.cache.read + t.cache.write > 0;
  });
  if (!lastAssistant || !lastAssistant.info.tokens) return null;
  const t = lastAssistant.info.tokens;
  const total = t.input + t.output + t.reasoning + t.cache.read + t.cache.write;
  return { tokens: t, total };
}

async function checkUIComparison(rows: TelemetryRow[], totals: TelemetryTotals): Promise<void> {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("SECTION C: UI token counts vs get_telemetry_totals()");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Fetch all workspaces, then agents from each workspace
  let workspaces: WorkspaceRecord[];
  try {
    const res = await fetch(`${BIRDHOUSE_API}/api/workspaces`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    workspaces = (await res.json()) as WorkspaceRecord[];
  } catch (err) {
    console.log(`\n  ⚠️  Could not reach Birdhouse API at ${BIRDHOUSE_API}: ${err}`);
    console.log("  (start the dev server and re-run to get UI comparison)");
    return;
  }

  const allAgents: AgentRecord[] = [];
  for (const ws of workspaces) {
    if (!ws.opencode_port) continue; // skip workspaces with no running OpenCode
    try {
      const res = await fetch(`${BIRDHOUSE_API}/api/workspace/${ws.workspace_id}/agents`);
      if (!res.ok) continue;
      const body = (await res.json()) as { trees: AgentTree[] };
      const wsAgents = flattenAgents(body.trees).map((a) => ({
        ...a,
        opencodePort: ws.opencode_port!,
      }));
      allAgents.push(...wsAgents);
    } catch {
      // workspace unreachable, skip
    }
  }

  const agents = allAgents;
  console.log(`\n  Found ${agents.length} agents from Birdhouse API`);

  // Build set of agent_ids that appear in recent telemetry rows
  const telemetryAgentIds = new Set(rows.map((r) => r.agent_id).filter(Boolean) as string[]);

  console.log(
    `  Agent IDs in recent telemetry rows (${TELEMETRY_ROW_LIMIT}): ${telemetryAgentIds.size}`,
  );

  // For each agent that appears in telemetry, get its current UI token count
  let uiSum = 0;
  const matched: Array<{ agent: AgentRecord; uiTotal: number }> = [];
  const notFound: string[] = [];

  for (const agentId of telemetryAgentIds) {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) {
      notFound.push(agentId);
      continue;
    }

    const result = await getLastAssistantTokens(agent);
    if (result) {
      matched.push({ agent, uiTotal: result.total });
      uiSum += result.total;
      console.log(
        `\n  ✓ ${agentId} (${agent.title.slice(0, 40)}...)`,
      );
      console.log(
        `    UI last-msg: input=${result.tokens.input.toLocaleString()} output=${result.tokens.output.toLocaleString()} reasoning=${result.tokens.reasoning.toLocaleString()}`,
      );
      console.log(
        `    cache_read=${result.tokens.cache.read.toLocaleString()} cache_write=${result.tokens.cache.write.toLocaleString()}`,
      );
      console.log(`    UI total: ${result.total.toLocaleString()}`);
    } else {
      console.log(`\n  ? ${agentId} — no messages with tokens found in OpenCode`);
    }
  }

  if (notFound.length > 0) {
    console.log(`\n  Agents in telemetry but not in Birdhouse API: ${notFound.join(", ")}`);
  }

  console.log("\n  ── Comparison ──");
  console.log(`  Sum of UI totals (for ${matched.length} matched agents): ${uiSum.toLocaleString()}`);
  console.log(`  get_telemetry_totals().total_tokens:                    ${totals.total_tokens.toLocaleString()}`);

  if (matched.length === 0) {
    console.log("  (no matched agents — cannot compare)");
    return;
  }

  const diff = Math.abs(uiSum - totals.total_tokens);
  const pct = totals.total_tokens > 0 ? ((diff / totals.total_tokens) * 100).toFixed(1) : "n/a";

  console.log(`  Difference: ${diff.toLocaleString()} (${pct}%)`);
  console.log();

  // Note: UI sum only covers agents in recent rows; totals covers ALL agents with telemetry.
  // Expect UI sum <= totals.total_tokens unless recent rows don't cover all telemetry agents.
  if (uiSum > 0 && totals.total_tokens > 0) {
    const ratio = uiSum / totals.total_tokens;
    if (ratio > 0.1 && ratio < 10) {
      console.log("  ✓ Numbers are in the same order of magnitude — telemetry looks correct");
    } else {
      console.log("  ⚠️  Numbers are very far apart — may indicate a telemetry issue");
    }
  }

  console.log(
    "\n  Note: Exact match is not expected. Telemetry fires per-turn (cumulative context),",
  );
  console.log(
    "  while UI shows the current last-message snapshot. Directional agreement is the goal.",
  );
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("Birdhouse Telemetry Verification");
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Birdhouse: ${BIRDHOUSE_API}`);
  console.log();

  try {
    const rows = await checkRawRows();
    const totals = await checkTotals();
    await checkUIComparison(rows, totals);
  } catch (err) {
    console.error("\nFATAL:", err);
    process.exit(1);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Done.");
}

main();
