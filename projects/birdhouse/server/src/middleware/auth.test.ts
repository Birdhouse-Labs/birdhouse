// ABOUTME: Tests for the auth middleware
// ABOUTME: Verifies cookie validation, exemptions, and 401 rejections

import { beforeEach, afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { AUTH_COOKIE_NAME, createSessionToken } from "../lib/auth";
import { TestDataDB } from "../test-utils/data-db-test";
import { createAuthMiddleware } from "./auth";

function createTestApp(dataDb: TestDataDB) {
  const app = new Hono();

  // Apply auth middleware to /api/* routes
  app.use("/api/*", createAuthMiddleware(dataDb));

  // A protected route
  app.get("/api/protected", (c) => c.json({ ok: true }));

  // Exempt routes (registered separately — middleware skip list handles them)
  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.post("/api/auth/launch-token", (c) => c.json({ ok: true }));
  app.get("/api/auth/pair/complete", (c) => c.json({ ok: true }));

  return app;
}

describe("Auth middleware", () => {
  let dataDb: TestDataDB;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    dataDb = new TestDataDB();
    app = createTestApp(dataDb);
  });

  afterEach(() => {
    dataDb.close();
  });

  test("passes through requests with a valid session cookie", async () => {
    const token = createSessionToken(dataDb, "test-device");

    const res = await app.request("/api/protected", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
    });

    expect(res.status).toBe(200);
  });

  test("returns 401 for requests without a cookie", async () => {
    const res = await app.request("/api/protected");
    expect(res.status).toBe(401);
  });

  test("returns 401 for requests with an invalid cookie", async () => {
    const res = await app.request("/api/protected", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=not-a-real-session-token` },
    });
    expect(res.status).toBe(401);
  });

  test("returns 401 for revoked session tokens", async () => {
    const token = createSessionToken(dataDb, "test-device");
    // Revoke it
    const { hashToken } = await import("../lib/auth");
    dataDb.revokeAccessToken(hashToken(token));

    const res = await app.request("/api/protected", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
    });
    expect(res.status).toBe(401);
  });

  test("GET /api/health is exempt — passes without cookie", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
  });

  test("POST /api/auth/launch-token is exempt — passes without cookie", async () => {
    const res = await app.request("/api/auth/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "any" }),
    });
    expect(res.status).toBe(200);
  });

  test("GET /api/auth/pair/complete is exempt — passes without cookie", async () => {
    const res = await app.request("/api/auth/pair/complete");
    expect(res.status).toBe(200);
  });

  test("GET /api/auth/launch-token (GET) is exempt — passes without cookie", async () => {
    const app2 = new Hono();
    app2.use("/api/*", createAuthMiddleware(dataDb));
    app2.get("/api/auth/launch-token", (c) => c.json({ token: "test" }));

    const res = await app2.request("/api/auth/launch-token");
    expect(res.status).toBe(200);
  });
});
