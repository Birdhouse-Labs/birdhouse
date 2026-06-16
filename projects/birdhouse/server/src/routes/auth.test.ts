// ABOUTME: Tests for authentication routes
// ABOUTME: Covers launch token exchange, pairing initiation, and pairing completion

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { AUTH_COOKIE_NAME, generateLaunchToken, hashToken } from "../lib/auth";
import { TestDataDB } from "../test-utils/data-db-test";
import { createAuthRoutes } from "./auth";

function createTestApp(dataDb: TestDataDB) {
  const app = new Hono();
  app.route("/api/auth", createAuthRoutes(dataDb));
  return app;
}

describe("GET /api/auth/launch-token", () => {
  test("returns 200 with token when launch token exists", async () => {
    const dataDb = new TestDataDB();
    const app = createTestApp(dataDb);

    const token = generateLaunchToken();

    const res = await app.request("/api/auth/launch-token");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { token: string };
    expect(body.token).toBe(token);
  });

  test("returns 404 when no launch token has been generated", async () => {
    // Consume any existing token first
    const dataDb = new TestDataDB();
    const app = createTestApp(dataDb);

    // Make a new app with a fresh state — generate then consume to clear it
    const token = generateLaunchToken();
    await app.request("/api/auth/launch-token/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    // Now simulate: consume the token via the exchange endpoint
    await app.request("/api/auth/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const res = await app.request("/api/auth/launch-token");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/auth/launch-token", () => {
  let dataDb: TestDataDB;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    dataDb = new TestDataDB();
    app = createTestApp(dataDb);
  });

  afterEach(() => {
    dataDb.close();
  });

  test("returns 200 and sets session cookie for valid token", async () => {
    const token = generateLaunchToken();

    const res = await app.request("/api/auth/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(200);

    const cookie = res.headers.get("Set-Cookie");
    expect(cookie).not.toBeNull();
    expect(cookie).toContain(AUTH_COOKIE_NAME);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  test("stores token hash in database after exchange", async () => {
    const token = generateLaunchToken();

    await app.request("/api/auth/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const body = (await (
      await app.request("/api/auth/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "something-else" }),
      })
    ).json()) as unknown;

    // Verify DB has an active token (by checking from a fresh exchange that created one)
    const freshToken = generateLaunchToken();
    const res2 = await app.request("/api/auth/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: freshToken }),
    });

    expect(res2.status).toBe(200);

    // Parse cookie to get session token and check DB
    const cookie = res2.headers.get("Set-Cookie") ?? "";
    const match = cookie.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
    expect(match).not.toBeNull();
    const sessionToken = match![1];
    const sessionHash = hashToken(sessionToken);
    const record = dataDb.getAccessToken(sessionHash);
    expect(record).not.toBeNull();
    expect(record!.is_active).toBe(1);
  });

  test("returns 401 for invalid token", async () => {
    generateLaunchToken(); // generate one to ensure state exists

    const res = await app.request("/api/auth/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "definitely-wrong-token" }),
    });

    expect(res.status).toBe(401);
  });

  test("returns 401 when token is reused (single-use)", async () => {
    const token = generateLaunchToken();

    // First use — valid
    const res1 = await app.request("/api/auth/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res1.status).toBe(200);

    // Second use — should fail
    const res2 = await app.request("/api/auth/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res2.status).toBe(401);
  });

  test("returns 400 when token field is missing", async () => {
    const res = await app.request("/api/auth/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/pair/initiate", () => {
  let dataDb: TestDataDB;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    dataDb = new TestDataDB();
    app = createTestApp(dataDb);
  });

  afterEach(() => {
    dataDb.close();
  });

  test("returns 200 with pairing URL", async () => {
    const res = await app.request("/api/auth/pair/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { url: string; qrSvg: string };
    expect(body.url).toContain("/api/auth/pair/complete");
    expect(body.url).toContain("token=");
    expect(body.qrSvg).toContain("<svg");
  });
});

describe("GET /api/auth/pair/complete", () => {
  let dataDb: TestDataDB;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    dataDb = new TestDataDB();
    app = createTestApp(dataDb);
  });

  afterEach(() => {
    dataDb.close();
  });

  test("redirects to / and sets session cookie for valid token", async () => {
    // Create a pairing session
    const initiateRes = await app.request("/api/auth/pair/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const initiateBody = (await initiateRes.json()) as { url: string };
    const pairingUrl = new URL(initiateBody.url);
    const pairingToken = pairingUrl.searchParams.get("token")!;

    const res = await app.request(
      `/api/auth/pair/complete?token=${encodeURIComponent(pairingToken)}`,
    );

    expect(res.status).toBe(302);

    const location = res.headers.get("Location");
    expect(location).toBe("/");

    const cookie = res.headers.get("Set-Cookie");
    expect(cookie).not.toBeNull();
    expect(cookie).toContain(AUTH_COOKIE_NAME);
    expect(cookie).toContain("HttpOnly");
  });

  test("returns 401 for invalid pairing token", async () => {
    const res = await app.request(
      "/api/auth/pair/complete?token=totally-fake-token",
    );

    expect(res.status).toBe(401);
  });

  test("returns 401 for already-used pairing token", async () => {
    const initiateRes = await app.request("/api/auth/pair/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const initiateBody = (await initiateRes.json()) as { url: string };
    const pairingUrl = new URL(initiateBody.url);
    const pairingToken = pairingUrl.searchParams.get("token")!;

    // Use it once
    await app.request(
      `/api/auth/pair/complete?token=${encodeURIComponent(pairingToken)}`,
    );

    // Try again — must fail
    const res2 = await app.request(
      `/api/auth/pair/complete?token=${encodeURIComponent(pairingToken)}`,
    );
    expect(res2.status).toBe(401);
  });

  test("returns 400 when token param is missing", async () => {
    const res = await app.request("/api/auth/pair/complete");
    expect(res.status).toBe(400);
  });
});
