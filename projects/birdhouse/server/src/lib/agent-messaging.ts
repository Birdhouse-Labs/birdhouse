// ABOUTME: Domain logic for sending first message to agents with Birdhouse system prompt
// ABOUTME: Encapsulates blocking vs fire-and-forget modes and model parsing

import { getDefaultHarness, type Deps } from "../dependencies";
import type { AgentHarness, BirdhouseFilePart } from "../harness";
import { BIRDHOUSE_SYSTEM_PROMPT } from "./birdhouse-system-prompt";
import { buildPromptParts } from "./message-parts";
import { parseModelId } from "./model-validator";
import { buildSkillAttachmentPreview, enrichMessageWithSkillAttachments } from "./skill-attachments";

export interface SendFirstMessageOptions {
  agentId: string;
  sessionId: string;
  model: string; // Format: "provider/model-id"
  prompt: string;
  wait: boolean;
  agent?: string;
  attachments?: BirdhouseFilePart[];
  senderMetadata?: {
    sent_by_agent_id: string;
    sent_by_agent_title: string;
  };
}

export interface SendFirstMessageResult {
  success: true;
  parts?: unknown[]; // Only present if wait=true
}

/**
 * Send first message to a newly created agent with Birdhouse system prompt
 * Handles both blocking (wait=true) and fire-and-forget (wait=false) modes
 *
 * @param deps - Dependencies (opencode, agentsDB, log)
 * @param options - Message sending options
 * @returns Result with optional parts (only in blocking mode)
 * @throws Error if model format is invalid
 */

export async function sendFirstMessage(
  deps: Pick<Deps, "agentsDB" | "harnesses" | "log" | "telemetry">,
  options: SendFirstMessageOptions,
  harnessArg?: Pick<AgentHarness, "capabilities" | "sendMessage">,
): Promise<SendFirstMessageResult> {
  const { agentId, sessionId, model, prompt, wait, agent, attachments = [], senderMetadata } = options;
  const { agentsDB, log, telemetry } = deps;
  const harness = harnessArg ?? getDefaultHarness(deps);

  const visibleSkills = (await harness.capabilities.skills?.listSkills()) ?? [];
  const enrichedPrompt = enrichMessageWithSkillAttachments(
    prompt,
    buildSkillAttachmentPreview(
      prompt,
      visibleSkills.map((skill) => ({
        name: skill.name,
        content: skill.content,
      })),
    ),
  );

  const { providerID, modelID } = parseModelId(model);
  const promptParts = buildPromptParts(enrichedPrompt, attachments, senderMetadata);

  if (wait) {
    // Blocking mode: Wait for agent to complete before returning
    log.server.info({ agent_id: agentId, session_id: sessionId, wait }, "Sending first message (blocking)");

    const messageResponse = await harness.sendMessage(sessionId, enrichedPrompt, {
      model: { providerID, modelID },
      system: BIRDHOUSE_SYSTEM_PROMPT,
      parts: promptParts,
      ...(agent && { agent }),
    });

    agentsDB.updateAgentTimestamp(agentId);
    try {
      telemetry.recordMessageTokens(agentId, messageResponse);
    } catch {
      // Never let telemetry errors affect message sending
    }
    log.server.info({ agent_id: agentId }, "First message completed (blocking)");

    return {
      success: true,
      parts: messageResponse.parts,
    };
  } else {
    // Async mode: Fire-and-forget (return immediately, process in background)
    log.server.info({ agent_id: agentId, session_id: sessionId, wait }, "Sending first message (async)");

    harness
      .sendMessage(sessionId, enrichedPrompt, {
        model: { providerID, modelID },
        system: BIRDHOUSE_SYSTEM_PROMPT,
        parts: promptParts,
        ...(agent && { agent }),
        noReply: true,
      })
      .then((messageResponse) => {
        agentsDB.updateAgentTimestamp(agentId);
        telemetry.recordMessageTokens(agentId, messageResponse);
        log.server.info({ agent_id: agentId }, "First message completed (async)");
      })
      .catch((error) => {
        log.server.error({ agent_id: agentId, error: error.message }, "First message failed (async)");
      });

    // Return immediately without waiting
    return { success: true };
  }
}
