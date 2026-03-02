// ABOUTME: Tests for the runtime config endpoint
// ABOUTME: Verifies BIRDHOUSE_ENABLE_PLAYGROUND flag is correctly reflected in API response

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { ServerConfig } from "./config";
import { createConfigRoutes } from "./config";

function buildApp() {
  const app = new Hono();
  app.route("/api/config", createConfigRoutes());
  return app;
}

describe("GET /api/config", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.BIRDHOUSE_ENABLE_PLAYGROUND;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.BIRDHOUSE_ENABLE_PLAYGROUND;
    } else {
      process.env.BIRDHOUSE_ENABLE_PLAYGROUND = originalEnv;
    }
  });

  test("returns playgroundEnabled: false when env var is unset", async () => {
    delete process.env.BIRDHOUSE_ENABLE_PLAYGROUND;

    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/config"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as ServerConfig;
    expect(body.playgroundEnabled).toBe(false);
  });

  test("returns playgroundEnabled: false when env var is empty string", async () => {
    process.env.BIRDHOUSE_ENABLE_PLAYGROUND = "";

    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/config"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as ServerConfig;
    expect(body.playgroundEnabled).toBe(false);
  });

  test("returns playgroundEnabled: false when env var is 'false'", async () => {
    process.env.BIRDHOUSE_ENABLE_PLAYGROUND = "false";

    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/config"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as ServerConfig;
    expect(body.playgroundEnabled).toBe(false);
  });

  test("returns playgroundEnabled: true when env var is 'true'", async () => {
    process.env.BIRDHOUSE_ENABLE_PLAYGROUND = "true";

    const app = buildApp();
    const res = await app.fetch(new Request("http://localhost/api/config"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as ServerConfig;
    expect(body.playgroundEnabled).toBe(true);
  });
});
