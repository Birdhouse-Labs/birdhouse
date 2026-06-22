// ABOUTME: Tests for AAPI middleware authentication check
// ABOUTME: Verifies loopback fallback and cookie-based access for plugin routes

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { AUTH_COOKIE_NAME, createSessionToken } from "../lib/auth";
import { TestDataDB } from "../test-utils/data-db-test";
import { createAAPIAuthCheck } from "./aapi";

/**
 * Creates a minimal test app that only applies the AAPI auth check,
 * not the full workspace resolution middleware (which requires OpenCode running).
 */
function createAuthCheckApp(dataDb: TestDataDB) {
  const app = new Hono();
  app.use("/aapi/*", createAAPIAuthCheck(dataDb));
  app.get("/aapi/test", (c) => c.json({ ok: true }));
  return app;
}

describe("AAPI auth check", () => {
  let dataDb: TestDataDB;
  let app: ReturnType<typeof createAuthCheckApp>;

  beforeEach(() => {
    dataDb = new TestDataDB();
    app = createAuthCheckApp(dataDb);
  });

  afterEach(() => {
    dataDb.close();
  });

  test("passes with a valid session cookie", async () => {
    const token = createSessionToken(dataDb, "test-device", null);

    const res = await app.request("/aapi/test", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${token}` },
    });

    expect(res.status).toBe(200);
  });

  test("passes without a cookie in test context (getConnInfo throws, fallback allows local)", async () => {
    // In unit tests there is no real Bun server context, so getConnInfo throws.
    // The middleware catches that and allows the request through — same as a loopback connection.
    // Socket-level loopback enforcement is verified by the production Bun server binding.
    const res = await app.request("/aapi/test");
    expect(res.status).toBe(200);
  });

  test("returns 401 for an invalid session cookie", async () => {
    const res = await app.request("/aapi/test", {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=not-a-valid-token`,
      },
    });
    expect(res.status).toBe(401);
  });

  test("passes with valid cookie regardless of other headers", async () => {
    const token = createSessionToken(dataDb, "test-device", null);

    const res = await app.request("/aapi/test", {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${token}`,
        "X-Forwarded-For": "203.0.113.42",
      },
    });

    expect(res.status).toBe(200);
  });
});
