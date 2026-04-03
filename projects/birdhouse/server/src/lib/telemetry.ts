// ABOUTME: Anonymous telemetry pushes to Supabase for marketing aggregate counters
// ABOUTME: Fire-and-forget — never throws, never blocks

import type { BirdhouseMessage as Message } from "../harness/types";
import type { DataDB } from "./data-db";

const SUPABASE_URL = "https://hzqxwcbohrtxyvmmamsn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qNuDf5Rh9PIh1hUvWT2GWA_PHi8V_QF";

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
}

/**
 * Telemetry client interface — injectable so tests never hit real Supabase
 */
export interface TelemetryClient {
  trackAgentCreated: (installId: string) => void;
  trackTokens: (installId: string, agentId: string, tokens: TokenCounts) => void;
  recordMessageTokens: (agentId: string, message: Message) => void;
}

async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
}

/**
 * Live telemetry client — pushes to real Supabase. Used in production only.
 */
export function createLiveTelemetryClient(dataDb: DataDB): TelemetryClient {
  function trackAgentCreated(installId: string): void {
    insert("telemetry_agent_created", { install_id: installId }).catch(() => {});
  }

  function trackTokens(installId: string, agentId: string, tokens: TokenCounts): void {
    const total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite + tokens.reasoning;
    if (total === 0) return;
    insert("telemetry_tokens", {
      install_id: installId,
      agent_id: agentId,
      input_tokens: tokens.input,
      output_tokens: tokens.output,
      cache_read_tokens: tokens.cacheRead,
      cache_write_tokens: tokens.cacheWrite,
      reasoning_tokens: tokens.reasoning,
    }).catch(() => {});
  }

  function recordMessageTokens(agentId: string, message: Message): void {
    try {
      if (message.info.role !== "assistant") return;
      if (!message.info.tokens) return;
      const { input, output, reasoning, cache } = message.info.tokens;
      const installId = dataDb.getOrCreateInstallId();
      trackTokens(installId, agentId, {
        input,
        output,
        reasoning,
        cacheRead: cache.read,
        cacheWrite: cache.write,
      });
    } catch {
      // Never let telemetry errors affect message sending
    }
  }

  return { trackAgentCreated, trackTokens, recordMessageTokens };
}

/**
 * No-op telemetry client — used in tests. Never touches the network.
 */
export function createTestTelemetryClient(): TelemetryClient {
  return {
    trackAgentCreated: () => {},
    trackTokens: () => {},
    recordMessageTokens: () => {},
  };
}
