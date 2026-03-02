// ABOUTME: Tests for anonymous telemetry module
// ABOUTME: Verifies live client fires correct Supabase inserts; test client is a no-op

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { TestDataDB } from "../test-utils/data-db-test";
import { createLiveTelemetryClient, createTestTelemetryClient } from "./telemetry";

const SUPABASE_URL = "https://hzqxwcbohrtxyvmmamsn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qNuDf5Rh9PIh1hUvWT2GWA_PHi8V_QF";
const TEST_INSTALL_ID = "test-install-id-123";

describe("createLiveTelemetryClient", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("trackAgentCreated", () => {
    it("inserts a row into telemetry_agent_created with correct payload", async () => {
      const client = createLiveTelemetryClient(new TestDataDB());
      client.trackAgentCreated(TEST_INSTALL_ID);

      // Allow the fire-and-forget promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${SUPABASE_URL}/rest/v1/telemetry_agent_created`);
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body as string);
      expect(body.install_id).toBe(TEST_INSTALL_ID);

      const headers = options.headers as Record<string, string>;
      expect(headers.apikey).toBe(SUPABASE_ANON_KEY);
      expect(headers.Authorization).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
      expect(headers.Prefer).toBe("return=minimal");
    });

    it("swallows fetch errors without throwing", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));
      const client = createLiveTelemetryClient(new TestDataDB());

      expect(() => client.trackAgentCreated(TEST_INSTALL_ID)).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
      // No unhandled rejection — test passes if we get here
    });
  });

  describe("trackTokens", () => {
    const TEST_AGENT_ID = "agent_test123";
    const TEST_TOKENS = { input: 100, output: 50, cacheRead: 200, cacheWrite: 10, reasoning: 5 };

    it("inserts a row into telemetry_tokens with correct payload", async () => {
      const client = createLiveTelemetryClient(new TestDataDB());
      client.trackTokens(TEST_INSTALL_ID, TEST_AGENT_ID, TEST_TOKENS);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${SUPABASE_URL}/rest/v1/telemetry_tokens`);
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body as string);
      expect(body.install_id).toBe(TEST_INSTALL_ID);
      expect(body.agent_id).toBe(TEST_AGENT_ID);
      expect(body.input_tokens).toBe(100);
      expect(body.output_tokens).toBe(50);
      expect(body.cache_read_tokens).toBe(200);
      expect(body.cache_write_tokens).toBe(10);
      expect(body.reasoning_tokens).toBe(5);

      const headers = options.headers as Record<string, string>;
      expect(headers.apikey).toBe(SUPABASE_ANON_KEY);
      expect(headers.Authorization).toBe(`Bearer ${SUPABASE_ANON_KEY}`);
      expect(headers.Prefer).toBe("return=minimal");
    });

    it("is a no-op when all token counts are zero", async () => {
      const client = createLiveTelemetryClient(new TestDataDB());
      client.trackTokens(TEST_INSTALL_ID, TEST_AGENT_ID, {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        reasoning: 0,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("swallows fetch errors without throwing", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));
      const client = createLiveTelemetryClient(new TestDataDB());

      expect(() => client.trackTokens(TEST_INSTALL_ID, TEST_AGENT_ID, TEST_TOKENS)).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});

describe("createTestTelemetryClient", () => {
  it("never calls fetch", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    const client = createTestTelemetryClient();
    client.trackAgentCreated("any-install-id");
    client.trackTokens("any-install-id", "agent_123", {
      input: 100,
      output: 50,
      cacheRead: 200,
      cacheWrite: 10,
      reasoning: 5,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
