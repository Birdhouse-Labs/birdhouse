// ABOUTME: API service for composer draft persistence
// ABOUTME: Handles get, save, and clear draft operations via backend endpoint

import { buildWorkspaceUrl } from "../config/api";

export interface DraftAttachment {
  filename: string;
  mime: string;
  url: string;
}

export interface Draft {
  text: string;
  attachments: DraftAttachment[];
}

/**
 * Fetch a saved draft for a given draftId.
 * Returns null on 404 (no draft saved yet). Throws on other errors.
 */
export async function getDraft(workspaceId: string, draftId: string): Promise<Draft | null> {
  const url = buildWorkspaceUrl(workspaceId, `/drafts/${draftId}`);
  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to get draft: ${response.statusText}`);
  }

  return (await response.json()) as Draft;
}

/**
 * Save a draft for a given draftId.
 * Throws on non-2xx responses.
 */
export async function saveDraft(workspaceId: string, draftId: string, draft: Draft): Promise<void> {
  const url = buildWorkspaceUrl(workspaceId, `/drafts/${draftId}`);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });

  if (!response.ok) {
    throw new Error(`Failed to save draft: ${response.statusText}`);
  }
}

/**
 * Delete a saved draft for a given draftId.
 * Throws on non-2xx responses.
 */
export async function clearDraft(workspaceId: string, draftId: string): Promise<void> {
  const url = buildWorkspaceUrl(workspaceId, `/drafts/${draftId}`);
  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to clear draft: ${response.statusText}`);
  }
}
