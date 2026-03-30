// ABOUTME: Agent note helpers backed by the existing draft persistence API.
// ABOUTME: Keeps per-agent scratchpad storage namespaced away from reply drafts.

import { clearDraft, getDraft, saveDraft } from "./drafts-api";

const AGENT_NOTE_PREFIX = "agent-note:";

function buildAgentNoteDraftId(agentId: string): string {
  return `${AGENT_NOTE_PREFIX}${agentId}`;
}

export async function getAgentNote(workspaceId: string, agentId: string): Promise<string> {
  const draft = await getDraft(workspaceId, buildAgentNoteDraftId(agentId));
  return draft?.text ?? "";
}

export async function saveAgentNote(workspaceId: string, agentId: string, text: string): Promise<void> {
  await saveDraft(workspaceId, buildAgentNoteDraftId(agentId), {
    text,
    attachments: [],
  });
}

export async function clearAgentNote(workspaceId: string, agentId: string): Promise<void> {
  await clearDraft(workspaceId, buildAgentNoteDraftId(agentId));
}
