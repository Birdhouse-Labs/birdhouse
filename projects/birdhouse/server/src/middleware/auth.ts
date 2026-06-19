// ABOUTME: Authentication middleware for all API routes
// ABOUTME: Validates session cookie, exempts health and auth handshake routes

import type { Context, Next } from "hono";
import { AUTH_COOKIE_NAME, isValidSessionCookie } from "../lib/auth";
import type { DataDB } from "../lib/data-db";
import { log } from "../lib/logger";

/**
 * Paths that are exempt from cookie authentication.
 * These must be accessible before a session exists.
 */
const EXEMPT_PATHS: Array<{ method: string; path: string }> = [
  { method: "GET", path: "/api/health" },
  { method: "GET", path: "/api/auth/launch-token" },
  { method: "POST", path: "/api/auth/launch-token" },
  { method: "GET", path: "/api/auth/pair/complete" },
  { method: "POST", path: "/api/auth/pair/complete" },
];

/**
 * Checks whether a request matches an exempt path.
 */
function isExempt(method: string, path: string): boolean {
  return EXEMPT_PATHS.some((entry) => entry.method === method && path === entry.path);
}

/**
 * Parses a cookie string and returns the value for the given name.
 */
function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key.trim() === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

/**
 * Auth middleware — validates session cookie on all /api/* routes.
 *
 * Exempt routes (no cookie required):
 *   GET  /api/health
 *   GET  /api/auth/launch-token  (CLI reads this)
 *   POST /api/auth/launch-token  (browser exchanges launch token)
 *   GET  /api/auth/pair/complete (phone completes QR pairing)
 *
 * All /ingest/* routes are registered before this middleware in index.ts
 * and are not affected.
 */
export function createAuthMiddleware(dataDb: DataDB) {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const method = c.req.method;
    const path = c.req.path;

    // Allow exempt routes through unconditionally
    if (isExempt(method, path)) {
      await next();
      return;
    }

    // Validate session cookie
    const cookieHeader = c.req.header("Cookie") ?? null;
    const sessionToken = parseCookie(cookieHeader, AUTH_COOKIE_NAME);

    if (!sessionToken) {
      log.server.debug({ path, method }, "Auth rejected — no session cookie");
      return c.json({ error: "Unauthorized" }, 401);
    }

    const valid = await isValidSessionCookie(sessionToken, dataDb);
    if (!valid) {
      log.server.warn({ path, method }, "Auth rejected — invalid or revoked session cookie");
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
    return;
  };
}
