// ABOUTME: API service for remote access authentication operations
// ABOUTME: Handles device listing, revocation, and QR pairing initiation

import { API_ENDPOINT_BASE } from "../config/api";

// Auth endpoints use window.location.origin so they work same-origin in dev
// (Vite proxies /api/auth/* to the backend, avoiding cross-origin CORS issues).
const AUTH_BASE = typeof window !== "undefined"
  ? `${window.location.origin}/api/auth`
  : `${API_ENDPOINT_BASE}/auth`;

export interface Device {
  token_hash: string;
  device_label: string | null;
  created_at: string;
  last_used: string | null;
  is_active: number;
  user_agent: string | null;
  origin_host: string | null;
}

export interface PairingSession {
  url: string;
  qrSvg: string;
}

/**
 * Fetches all active paired devices.
 */
export async function listDevices(): Promise<Device[]> {
  const response = await fetch(`${API_ENDPOINT_BASE}/auth/devices`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to list devices: ${response.statusText}`);
  }

  const body = (await response.json()) as { devices: Device[] };
  return body.devices;
}

/**
 * Revokes a device by its token hash.
 */
export async function revokeDevice(tokenHash: string): Promise<void> {
  const response = await fetch(`${API_ENDPOINT_BASE}/auth/devices/${encodeURIComponent(tokenHash)}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to revoke device: ${response.statusText}`);
  }
}

/**
 * Redeems a pasted token — tries the launch token endpoint first, then
 * the pairing token endpoint. This lets users paste either type of token
 * from the unauthorized screen without knowing which kind they have.
 * Returns true on success, false if neither endpoint accepts the token.
 */
export async function completePairingWithToken(token: string): Promise<boolean> {
  // Try launch token first (from dev.ts output or CLI).
  // Uses AUTH_BASE (same origin) so the request and resulting cookie are
  // same-origin — avoids cross-origin CORS issues on mobile browsers.
  const launchRes = await fetch(`${AUTH_BASE}/launch-token`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (launchRes.ok) return true;

  // Fall back to pairing token (from QR modal)
  const pairRes = await fetch(`${AUTH_BASE}/pair/complete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return pairRes.ok;
}

/**
 * Updates the display label for a paired device.
 */
export async function updateDeviceLabel(tokenHash: string, label: string): Promise<void> {
  const response = await fetch(`${API_ENDPOINT_BASE}/auth/devices/${encodeURIComponent(tokenHash)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update device label: ${response.statusText}`);
  }
}

/**
 * Initiates a QR pairing session and returns the URL and SVG.
 * Pass externalBaseUrl when the phone needs to reach the server via a
 * different address (Tailscale IP, custom domain, tunnel URL, etc.).
 */
export async function initiatePairing(externalBaseUrl?: string): Promise<PairingSession> {
  const response = await fetch(`${API_ENDPOINT_BASE}/auth/pair/initiate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ externalBaseUrl: externalBaseUrl ?? "" }),
  });

  if (!response.ok) {
    throw new Error(`Failed to initiate pairing: ${response.statusText}`);
  }

  return response.json() as Promise<PairingSession>;
}
