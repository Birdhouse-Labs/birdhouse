// ABOUTME: Authentication token management for remote access
// ABOUTME: Handles launch tokens, pairing tokens, session tokens, and cookie validation

import type { DataDB } from "./data-db";

// ==================== Constants ====================

/** Name of the HttpOnly session cookie set after authentication */
export const AUTH_COOKIE_NAME = "birdhouse_session";

/** Launch token TTL: 60 seconds (single-use, set during server startup) */
export const LAUNCH_TOKEN_TTL_MS = 60_000;

/** Pairing token TTL: 5 minutes (for QR code phone pairing) */
export const PAIRING_TOKEN_TTL_MS = 5 * 60 * 1000;

/** Session cookie max-age: 10 years (browsers cap this, but treat it as "persist indefinitely") */
export const SESSION_COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60; // seconds

// ==================== Token Utilities ====================

/**
 * Generates a cryptographically random base64url token.
 * 128 bits of entropy from 16 random bytes.
 */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // base64url encode (no padding, URL-safe chars)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Produces a SHA-256 hex digest of the given token.
 * Only the hash is stored in the database — the raw token lives only in the cookie.
 */
export function hashToken(token: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  // Bun has synchronous crypto.subtle.digestSync via Bun global, but Web Crypto requires async.
  // Use the synchronous Bun.hash for this.
  const hashBuffer = new Uint8Array(
    // Use native crypto.subtle sync workaround: compute SHA-256 as hex string
    // We use a manual approach since Bun's crypto.subtle.digestSync isn't standard
    (() => {
      // Use Node-compatible crypto via Bun's built-in
      const { createHash } = require("node:crypto") as typeof import("node:crypto");
      return createHash("sha256").update(data).digest();
    })(),
  );
  return Array.from(hashBuffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ==================== Launch Token ====================

// In-memory launch token state — generated once on server startup.
// The CLI reads it via GET /api/auth/launch-token; the browser consumes it via POST.
let launchTokenValue: string | null = null;
let launchTokenExpiresAt: number | null = null;

/**
 * Generates a new launch token, replacing any existing one.
 * Called once during server startup.
 * Returns the raw token (for embedding in the URL).
 */
export function generateLaunchToken(): string {
  const token = generateSessionToken();
  launchTokenValue = token;
  launchTokenExpiresAt = Date.now() + LAUNCH_TOKEN_TTL_MS;
  return token;
}

/**
 * Returns the current launch token without consuming it.
 * Returns null if no token exists or it has expired.
 *
 * NOTE: This is intended for the CLI to read after server startup.
 * The CLI runs locally and is not exposed remotely at this point.
 */
export function getLaunchToken(): string | null {
  if (!launchTokenValue || !launchTokenExpiresAt) return null;
  if (Date.now() > launchTokenExpiresAt) {
    launchTokenValue = null;
    launchTokenExpiresAt = null;
    return null;
  }
  return launchTokenValue;
}

/**
 * Validates and consumes the launch token (single-use).
 * Returns true if the token was valid and has been consumed.
 * Returns false if invalid, expired, or already used.
 */
export function consumeLaunchToken(token: string): boolean {
  const current = getLaunchToken();
  if (!current || current !== token) return false;
  // Consume it
  launchTokenValue = null;
  launchTokenExpiresAt = null;
  return true;
}

// ==================== Pairing Token ====================

interface PairingSession {
  token: string;
  expiresAt: number;
}

// In-memory map of active pairing sessions (token → session)
const pairingSessions = new Map<string, PairingSession>();

/**
 * Creates a new pairing session and returns the token and QR-encodable URL.
 * The token is short-lived (PAIRING_TOKEN_TTL_MS) and single-use.
 */
export function createPairingSession(baseUrl: string): { token: string; url: string } {
  const token = generateSessionToken();
  const session: PairingSession = {
    token,
    expiresAt: Date.now() + PAIRING_TOKEN_TTL_MS,
  };
  pairingSessions.set(token, session);

  const url = `${baseUrl}/api/auth/pair/complete?token=${encodeURIComponent(token)}`;
  return { token, url };
}

/**
 * Validates and consumes a pairing token (single-use).
 * Returns true if valid and consumed, false if invalid or expired.
 */
export function consumePairingToken(token: string): boolean {
  const session = pairingSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    pairingSessions.delete(token);
    return false;
  }
  pairingSessions.delete(token);
  return true;
}

// ==================== Cookie Parsing ====================

/**
 * Parses a cookie string and returns the value for the given name.
 * Shared by auth middleware and AAPI middleware.
 */
export function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key.trim() === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

// ==================== Session Validation ====================

/**
 * Validates a session token from a cookie against the database.
 * Touches last_used on valid tokens.
 * Returns true if the token is active and valid.
 */
export async function isValidSessionCookie(token: string, dataDb: DataDB): Promise<boolean> {
  const hash = hashToken(token);
  const record = dataDb.getAccessToken(hash);

  if (!record) return false;
  if (!record.is_active) return false;

  // Update last_used timestamp
  dataDb.touchAccessToken(hash);
  return true;
}

/**
 * Creates a persistent access token in the DB and returns the raw token value.
 * The raw token is placed in the cookie; only the hash is stored.
 * userAgent is stored as-is for later display formatting on the frontend.
 */
export function createSessionToken(
  dataDb: DataDB,
  deviceLabel: string | null,
  userAgent: string | null,
  originHost: string | null = null,
): string {
  const token = generateSessionToken();
  const hash = hashToken(token);
  dataDb.createAccessToken(hash, deviceLabel, userAgent, originHost);
  return token;
}

/**
 * Builds a Set-Cookie header value for the session cookie.
 * Sets Secure flag only when the request came over HTTPS.
 */
export function buildSessionCookieHeader(token: string, isSecure: boolean): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    "Path=/",
  ];
  if (isSecure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
