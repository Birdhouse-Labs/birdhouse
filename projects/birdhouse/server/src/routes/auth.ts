// ABOUTME: Authentication routes for remote access
// ABOUTME: Handles launch token exchange, QR pairing initiation, and pairing completion

import { getConnInfo } from "hono/bun";
import { Hono } from "hono";
import QRCode from "qrcode";
import {
  AUTH_COOKIE_NAME,
  buildSessionCookieHeader,
  consumeLaunchToken,
  consumePairingToken,
  createPairingSession,
  createSessionToken,
  getLaunchToken,
} from "../lib/auth";
import { log } from "../lib/logger";
import type { DataDB } from "../lib/data-db";

/**
 * Determines whether the request came over HTTPS.
 * Checks X-Forwarded-Proto header (for reverse proxies) and falls back to false.
 */
function isSecureRequest(req: Request): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded === "https";
  }
  return req.url.startsWith("https://");
}

/**
 * Extracts the base URL (scheme + host) from a request, for building pairing URLs.
 */
function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function createAuthRoutes(dataDb: DataDB) {
  const app = new Hono();

  /**
   * GET /api/auth/launch-token
   * Returns the current launch token without consuming it.
   * Called by the CLI after the health check to construct the browser URL.
   *
   * Restricted to loopback connections only — the CLI always connects via
   * 127.0.0.1, and this token must never be readable by remote clients.
   * Returns 404 (not 401) to remote callers to avoid confirming the endpoint exists.
   */
  app.get("/launch-token", (c) => {
    // Restrict to loopback connections only — the CLI always connects via 127.0.0.1.
    // getConnInfo throws when no real Bun server context exists (e.g. tests), in which
    // case we allow through. In production the check always runs.
    try {
      const info = getConnInfo(c);
      const remoteAddr = info.remote.address ?? "";
      const isLoopback =
        remoteAddr === "127.0.0.1" ||
        remoteAddr === "::1" ||
        remoteAddr === "::ffff:127.0.0.1";

      if (!isLoopback) {
        log.server.warn({ remoteAddr }, "Remote attempt to read launch token — blocked");
        return c.json({ error: "Not found" }, 404);
      }
    } catch {
      // No server context (test environment) — allow through
    }

    const token = getLaunchToken();
    if (!token) {
      return c.json({ error: "No active launch token" }, 404);
    }
    return c.json({ token });
  });

  /**
   * POST /api/auth/launch-token
   * Exchanges a launch token for a persistent session cookie.
   * The launch token is single-use and expires after LAUNCH_TOKEN_TTL_MS.
   *
   * Body: { token: string }
   * Response: 200 with Set-Cookie on success, 401 on failure
   */
  app.post("/launch-token", async (c) => {
    let body: { token?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { token } = body;
    if (!token || typeof token !== "string") {
      return c.json({ error: "token is required" }, 400);
    }

    if (!consumeLaunchToken(token)) {
      log.server.warn("Launch token exchange failed — invalid or expired token");
      return c.json({ error: "Invalid or expired launch token" }, 401);
    }

    const userAgent = c.req.header("User-Agent") ?? null;
    const sessionToken = createSessionToken(dataDb, null, userAgent);
    const isSecure = isSecureRequest(c.req.raw);
    const cookieHeader = buildSessionCookieHeader(sessionToken, isSecure);

    log.server.info("Launch token exchanged for session cookie");

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieHeader,
      },
    });
  });

  /**
   * POST /api/auth/pair/initiate
   * Creates a pairing session and returns a QR-encodable URL and SVG.
   * Requires an authenticated session (enforced by auth middleware).
   *
   * Body (optional): { externalBaseUrl?: string }
   *   When provided, the pairing URL uses externalBaseUrl so QR codes work
   *   for phones that cannot reach the server via its local address.
   *
   * Response: { url: string, qrSvg: string }
   */
  app.post("/pair/initiate", async (c) => {
    const body = await c.req.json().catch(() => ({})) as { externalBaseUrl?: unknown };
    const rawExternal = typeof body?.externalBaseUrl === "string" ? body.externalBaseUrl.trim() : "";
    // Strip a trailing slash so the appended path doesn't produce double slashes
    const baseUrl = rawExternal
      ? rawExternal.replace(/\/+$/, "")
      : getBaseUrl(c.req.raw);
    const { url } = createPairingSession(baseUrl);

    let qrSvg: string;
    try {
      qrSvg = await QRCode.toString(url, { type: "svg" });
    } catch (error) {
      log.server.error(
        { error: error instanceof Error ? error.message : "Unknown" },
        "Failed to generate QR code",
      );
      return c.json({ error: "Failed to generate QR code" }, 500);
    }

    log.server.info("Pairing session created");

    return c.json({ url, qrSvg });
  });

  /**
   * GET /api/auth/devices
   * Lists all active access tokens (paired devices).
   * Requires an authenticated session (enforced by auth middleware).
   *
   * Response: { devices: AccessToken[] }
   */
  app.get("/devices", (c) => {
    const all = dataDb.getAllAccessTokens();
    const active = all.filter((t) => t.is_active === 1);
    return c.json({ devices: active });
  });

  /**
   * DELETE /api/auth/devices/:hash
   * Revokes an active device by its token hash.
   * Requires an authenticated session (enforced by auth middleware).
   *
   * Response: 200 on success, 404 if not found or already revoked
   */
  app.delete("/devices/:hash", (c) => {
    const hash = c.req.param("hash");
    const record = dataDb.getAccessToken(hash);

    if (!record || record.is_active === 0) {
      return c.json({ error: "Device not found" }, 404);
    }

    dataDb.revokeAccessToken(hash);
    log.server.info({ hash: hash.slice(0, 8) + "..." }, "Device revoked via settings");
    return c.json({ ok: true });
  });

  /**
   * GET /api/auth/pair/complete
   * Completes the QR pairing flow — the phone hits this URL after scanning.
   * Validates the pairing token, creates a session, and redirects to /.
   *
   * Query: ?token=<pairing-token>
   * Response: 302 redirect to / with Set-Cookie on success, 401 on failure
   */
  app.get("/pair/complete", async (c) => {
    const token = c.req.query("token");
    if (!token) {
      return c.json({ error: "token query parameter is required" }, 400);
    }

    if (!consumePairingToken(token)) {
      log.server.warn("Pairing token completion failed — invalid or expired token");
      return c.json({ error: "Invalid or expired pairing token" }, 401);
    }

    const userAgent = c.req.header("User-Agent") ?? null;
    const sessionToken = createSessionToken(dataDb, null, userAgent);
    const isSecure = isSecureRequest(c.req.raw);
    const cookieHeader = buildSessionCookieHeader(sessionToken, isSecure);

    log.server.info("Pairing completed — session cookie set");

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": cookieHeader,
      },
    });
  });

  /**
   * POST /api/auth/pair/complete
   * Completes pairing via a pasted token (fetch-friendly alternative to the GET redirect).
   * Used by the unauthorized screen so the user can paste a token in any browser.
   *
   * Body: { token: string }
   * Response: 200 { ok: true } with Set-Cookie on success, 401 on failure
   */
  app.post("/pair/complete", async (c) => {
    let body: { token?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { token } = body;
    if (!token || typeof token !== "string") {
      return c.json({ error: "token is required" }, 400);
    }

    if (!consumePairingToken(token)) {
      log.server.warn("Pairing token paste failed — invalid or expired token");
      return c.json({ error: "Invalid or expired pairing token" }, 401);
    }

    const userAgent = c.req.header("User-Agent") ?? null;
    const sessionToken = createSessionToken(dataDb, null, userAgent);
    const isSecure = isSecureRequest(c.req.raw);
    const cookieHeader = buildSessionCookieHeader(sessionToken, isSecure);

    log.server.info("Pairing completed via token paste — session cookie set");

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookieHeader,
      },
    });
  });

  /**
   * PATCH /api/auth/devices/:hash
   * Updates the label of an active device.
   * Requires an authenticated session (enforced by auth middleware).
   *
   * Body: { label: string }  (non-empty, max 100 chars)
   * Response: 200 { ok: true } on success, 404 if device not found/revoked
   */
  app.patch("/devices/:hash", async (c) => {
    const hash = c.req.param("hash");

    let body: { label?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const label = body?.label;
    if (typeof label !== "string" || label.trim() === "") {
      return c.json({ error: "label must be a non-empty string" }, 400);
    }
    if (label.trim().length > 100) {
      return c.json({ error: "label must be 100 characters or fewer" }, 400);
    }

    const record = dataDb.getAccessToken(hash);
    if (!record || record.is_active === 0) {
      return c.json({ error: "Device not found" }, 404);
    }

    dataDb.updateAccessTokenLabel(hash, label.trim());
    log.server.info({ hash: hash.slice(0, 8) + "..." }, "Device label updated");
    return c.json({ ok: true });
  });

  return app;
}
