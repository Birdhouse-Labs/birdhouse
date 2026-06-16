// ABOUTME: Authentication routes for remote access
// ABOUTME: Handles launch token exchange, QR pairing initiation, and pairing completion

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
   * NOTE: This endpoint is exempt from auth middleware and is intended only for
   * the CLI, which runs on localhost. The server is not exposed remotely before
   * auth is configured, so no IP restriction is enforced here.
   */
  app.get("/launch-token", (c) => {
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

    const sessionToken = createSessionToken(dataDb, "local-browser");
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
   * Response: { url: string, qrSvg: string }
   */
  app.post("/pair/initiate", async (c) => {
    const baseUrl = getBaseUrl(c.req.raw);
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

    const sessionToken = createSessionToken(dataDb, "mobile-device");
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

  return app;
}
