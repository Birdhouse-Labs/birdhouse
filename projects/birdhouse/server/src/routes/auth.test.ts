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

    const _body = (await (
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
    const sessionToken = match?.[1] ?? "";
    const sessionHash = hashToken(sessionToken);
    const record = dataDb.getAccessToken(sessionHash);
    expect(record).not.toBeNull();
    expect(record?.is_active).toBe(1);
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

  test("uses externalBaseUrl when provided", async () => {
    const res = await app.request("/api/auth/pair/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalBaseUrl: "https://example.com" }),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { url: string; qrSvg: string };
    expect(body.url).toMatch(/^https:\/\/example\.com/);
    expect(body.url).toContain("/api/auth/pair/complete");
  });

  test("strips trailing slash from externalBaseUrl", async () => {
    const res = await app.request("/api/auth/pair/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalBaseUrl: "https://example.com/" }),
    });

    const body = (await res.json()) as { url: string };
    expect(body.url).not.toContain("example.com//");
    expect(body.url).toMatch(/^https:\/\/example\.com\//);
  });

  test("falls back to request origin when externalBaseUrl is empty string", async () => {
    const res = await app.request("/api/auth/pair/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalBaseUrl: "" }),
    });

    expect(res.status).toBe(200);

    const body = (await res.json()) as { url: string };
    // Should use the request's own host (localhost in tests)
    expect(body.url).toContain("/api/auth/pair/complete");
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
    const pairingToken = pairingUrl.searchParams.get("token") ?? "";

    const res = await app.request(`/api/auth/pair/complete?token=${encodeURIComponent(pairingToken)}`);

    expect(res.status).toBe(302);

    const location = res.headers.get("Location");
    expect(location).toBe("/");

    const cookie = res.headers.get("Set-Cookie");
    expect(cookie).not.toBeNull();
    expect(cookie).toContain(AUTH_COOKIE_NAME);
    expect(cookie).toContain("HttpOnly");
  });

  test("returns 401 for invalid pairing token", async () => {
    const res = await app.request("/api/auth/pair/complete?token=totally-fake-token");

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
    const pairingToken = pairingUrl.searchParams.get("token") ?? "";

    // Use it once
    await app.request(`/api/auth/pair/complete?token=${encodeURIComponent(pairingToken)}`);

    // Try again — must fail
    const res2 = await app.request(`/api/auth/pair/complete?token=${encodeURIComponent(pairingToken)}`);
    expect(res2.status).toBe(401);
  });

  test("returns 400 when token param is missing", async () => {
    const res = await app.request("/api/auth/pair/complete");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/devices", () => {
  let dataDb: TestDataDB;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    dataDb = new TestDataDB();
    app = createTestApp(dataDb);
  });

  afterEach(() => {
    dataDb.close();
  });

  test("returns empty array when no devices exist", async () => {
    const res = await app.request("/api/auth/devices");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { devices: unknown[] };
    expect(body.devices).toEqual([]);
  });

  test("returns active devices only", async () => {
    dataDb.createAccessToken("hash_active", "my-phone", null);
    dataDb.createAccessToken("hash_revoked", "old-laptop", null);
    dataDb.revokeAccessToken("hash_revoked");

    const res = await app.request("/api/auth/devices");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { devices: Array<{ token_hash: string; device_label: string }> };
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0].token_hash).toBe("hash_active");
    expect(body.devices[0].device_label).toBe("my-phone");
  });

  test("returned device has expected shape", async () => {
    dataDb.createAccessToken("hash_abc", "test-device", null);

    const res = await app.request("/api/auth/devices");
    const body = (await res.json()) as {
      devices: Array<{
        token_hash: string;
        device_label: string;
        created_at: string;
        last_used: string | null;
      }>;
    };

    const device = body.devices[0];
    expect(device.token_hash).toBe("hash_abc");
    expect(device.device_label).toBe("test-device");
    expect(typeof device.created_at).toBe("string");
    expect(device.last_used).toBeNull();
  });
});

describe("DELETE /api/auth/devices/:hash", () => {
  let dataDb: TestDataDB;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    dataDb = new TestDataDB();
    app = createTestApp(dataDb);
  });

  afterEach(() => {
    dataDb.close();
  });

  test("returns 200 and revokes an active device", async () => {
    dataDb.createAccessToken("hash_to_revoke", "my-phone", null);

    const res = await app.request("/api/auth/devices/hash_to_revoke", {
      method: "DELETE",
    });

    expect(res.status).toBe(200);

    // Confirm it's revoked in the DB
    const record = dataDb.getAccessToken("hash_to_revoke");
    expect(record?.is_active).toBe(0);
  });

  test("returns 404 for a non-existent token hash", async () => {
    const res = await app.request("/api/auth/devices/does-not-exist", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  test("returns 404 when trying to revoke an already-revoked device", async () => {
    dataDb.createAccessToken("hash_already_gone", "old-device", null);
    dataDb.revokeAccessToken("hash_already_gone");

    const res = await app.request("/api/auth/devices/hash_already_gone", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/auth/devices/:hash", () => {
  let dataDb: TestDataDB;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    dataDb = new TestDataDB();
    app = createTestApp(dataDb);
  });

  afterEach(() => {
    dataDb.close();
  });

  test("returns 200 and updates device label", async () => {
    dataDb.createAccessToken("hash_patch", "old-label", null);

    const res = await app.request("/api/auth/devices/hash_patch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "My iPhone" }),
    });

    expect(res.status).toBe(200);

    const record = dataDb.getAccessToken("hash_patch");
    expect(record?.device_label).toBe("My iPhone");
  });

  test("trims whitespace from label", async () => {
    dataDb.createAccessToken("hash_trim", "old-label", null);

    await app.request("/api/auth/devices/hash_trim", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "  iPad  " }),
    });

    const record = dataDb.getAccessToken("hash_trim");
    expect(record?.device_label).toBe("iPad");
  });

  test("returns 400 for empty label", async () => {
    dataDb.createAccessToken("hash_empty", "some-label", null);

    const res = await app.request("/api/auth/devices/hash_empty", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "" }),
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 for label over 100 characters", async () => {
    dataDb.createAccessToken("hash_long", "label", null);

    const res = await app.request("/api/auth/devices/hash_long", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "a".repeat(101) }),
    });

    expect(res.status).toBe(400);
  });

  test("returns 404 for non-existent device", async () => {
    const res = await app.request("/api/auth/devices/not-a-real-hash", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "New Name" }),
    });

    expect(res.status).toBe(404);
  });

  test("returns 404 for revoked device", async () => {
    dataDb.createAccessToken("hash_revoked_patch", "label", null);
    dataDb.revokeAccessToken("hash_revoked_patch");

    const res = await app.request("/api/auth/devices/hash_revoked_patch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "New Name" }),
    });

    expect(res.status).toBe(404);
  });
});
