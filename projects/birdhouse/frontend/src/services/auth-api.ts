// ABOUTME: API service for remote access authentication operations
// ABOUTME: Handles device listing, revocation, and QR pairing initiation

import { API_ENDPOINT_BASE } from "../config/api";

export interface Device {
  token_hash: string;
  device_label: string;
  created_at: string;
  last_used: string | null;
  is_active: number;
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
 * Initiates a QR pairing session and returns the URL and SVG.
 */
export async function initiatePairing(): Promise<PairingSession> {
  const response = await fetch(`${API_ENDPOINT_BASE}/auth/pair/initiate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to initiate pairing: ${response.statusText}`);
  }

  return response.json() as Promise<PairingSession>;
}
