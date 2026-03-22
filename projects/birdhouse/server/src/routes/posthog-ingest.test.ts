// ABOUTME: Verifies PostHog ingest proxy forwards requests correctly
// ABOUTME: Verifies PostHog ingest proxy behavior
// ABOUTME: Ensures proxy preserves method, path, headers, and response body

import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { createTestDeps, withDeps } from "../dependencies";
import { createPosthogRoutes } from "./posthog-ingest";

describe("POST /ingest", () => {
  test("proxies ingestion requests to PostHog", async () => {
    let capturedPath: string | undefined;
    let capturedMethod: string | undefined;
    let capturedHeaders: Record<string, string> | undefined;
    let capturedBody: ArrayBuffer | undefined;

    const deps = await createTestDeps();
    deps.posthog = {
      proxyIngest: async ({ path, method, headers, body }) => {
        capturedPath = path;
        capturedMethod = method;
        capturedHeaders = headers;
        capturedBody = body;

        return new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      },
    };

    const app = new Hono();
    app.route("/ingest", createPosthogRoutes());

    const payload = JSON.stringify({ event: "$pageview" });
    const response = await withDeps(deps, () =>
      app.request("/ingest/e/?ip=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "posthog-test",
        },
        body: payload,
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    expect(capturedPath).toBe("/e/?ip=1");
    expect(capturedMethod).toBe("POST");
    expect(capturedHeaders).toEqual({
      "Content-Type": "application/json",
      "User-Agent": "posthog-test",
    });
    expect(new TextDecoder().decode(capturedBody)).toBe(payload);
  });
});
