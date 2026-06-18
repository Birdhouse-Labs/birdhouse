// ABOUTME: Tests for AAPI middleware authentication check
// ABOUTME: Verifies localhost fallback and cookie-based access for plugin routes

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

  test("passes from localhost (127.0.0.1) without a cookie — OpenCode processes", async () => {
    // Simulate localhost by setting X-Forwarded-For to localhost
    // In test context, we can't set the actual socket IP, so we test
    // the fallback heuristic: no cookie + no X-Forwarded-For = treat as local
    const res = await app.request("/aapi/test");
    // Without any auth info at all and no X-Forwarded-For, should pass
    expect(res.status).toBe(200);
  });

  test("returns 401 when no cookie and X-Forwarded-For header is present (remote client)", async () => {
    const res = await app.request("/aapi/test", {
      headers: {
        "X-Forwarded-For": "203.0.113.42", // External IP
      },
    });
    expect(res.status).toBe(401);
  });

  test("returns 401 for invalid session cookie when X-Forwarded-For is set", async () => {
    const res = await app.request("/aapi/test", {
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=not-a-valid-token`,
        "X-Forwarded-For": "203.0.113.42",
      },
    });
    expect(res.status).toBe(401);
  });

  test("passes with valid cookie even when X-Forwarded-For is set", async () => {
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
