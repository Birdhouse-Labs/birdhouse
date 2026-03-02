// ABOUTME: API service for user profile operations (name storage)
// ABOUTME: Fetches and updates the locally-stored user display name

import { API_ENDPOINT_BASE } from "../config/api";

export interface UserProfileResponse {
  name: string | null;
}

export async function fetchUserProfile(): Promise<UserProfileResponse> {
  const response = await fetch(`${API_ENDPOINT_BASE}/user-profile`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }
  return response.json() as Promise<UserProfileResponse>;
}

export async function submitUserName(name: string): Promise<void> {
  const response = await fetch(`${API_ENDPOINT_BASE}/user-profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || "Failed to save name");
  }
}
