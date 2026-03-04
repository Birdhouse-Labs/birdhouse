// ABOUTME: API service for fetching and answering pending questions from AI agents
// ABOUTME: Handles the fetch and reply endpoints for the question tool

import { buildWorkspaceUrl } from "../config/api";
import type { QuestionRequest } from "../types/question";

/**
 * Fetch all pending questions for an agent.
 * Used on initial load to catch questions that arrived before the page was loaded.
 *
 * @param workspaceId The workspace ID
 * @param agentId The agent ID
 * @returns Array of pending question requests
 */
export async function fetchPendingQuestions(workspaceId: string, agentId: string): Promise<QuestionRequest[]> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/questions`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch pending questions: ${response.statusText}`);
  }

  return response.json() as Promise<QuestionRequest[]>;
}

/**
 * Submit answers to a pending question request.
 *
 * @param workspaceId The workspace ID
 * @param agentId The agent ID that asked the question
 * @param requestId The question request ID (from QuestionRequest.id)
 * @param answers One inner array per question, containing selected option labels or free-text strings
 */
export async function replyToQuestion(
  workspaceId: string,
  agentId: string,
  requestId: string,
  answers: string[][],
): Promise<void> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/questions/${requestId}/reply`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Failed to submit answer: ${response.statusText}`;

    try {
      const parsed = JSON.parse(responseBody) as { error?: string };
      if (parsed.error) {
        errorMessage = parsed.error;
      }
    } catch {
      // Not JSON — use statusText
    }

    throw new Error(errorMessage);
  }
}
