// ABOUTME: API service for fetching agent messages
// ABOUTME: Handles API communication and maps responses using adapter layer

import { mapMessages } from "../adapters";
import { mapAgentTrees } from "../adapters/agent-tree-adapter";
import type { TreeNode } from "../components/TreeView";
import { API_ENDPOINT_BASE, buildWorkspaceUrl } from "../config/api";

import type { Message } from "../types/messages";

const _API_BASE = API_ENDPOINT_BASE;

/**
 * Fetch messages for a given agent ID
 * @param workspaceId The workspace ID
 * @param agentId The agent ID
 * @returns Array of UI-ready messages (newest-at-top)
 */
export async function fetchMessages(workspaceId: string, agentId: string): Promise<Message[]> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/messages`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.statusText}`);
  }

  const opencodeMessages = await response.json();
  return mapMessages(opencodeMessages);
}

/**
 * Fetch agent metadata
 * @param workspaceId The workspace ID
 * @param agentId The agent ID
 * @returns Agent metadata
 */
export async function fetchAgent(workspaceId: string, agentId: string) {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch agent: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Generate a title based on a message
 * @param workspaceId The workspace ID
 * @param message The message content to generate a title from
 * @param patternId Optional pattern ID (defaults to title_generation_default)
 * @param sourceAgentTitle Optional source agent title for context
 * @returns The generated title
 */
export async function generateTitle(
  workspaceId: string,
  message: string,
  patternId?: string,
  sourceAgentTitle?: string,
): Promise<string> {
  const url = buildWorkspaceUrl(workspaceId, "/title/generate");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      pattern_id: patternId,
      source_agent_title: sourceAgentTitle,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Failed to generate title: ${response.statusText}`;

    // Try to extract error from JSON response
    try {
      const errorData = JSON.parse(responseBody);
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Response wasn't JSON, use status text
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.title;
}

export async function stopAgent(workspaceId: string, agentId: string) {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/stop`);
  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(`Failed to stop agent: ${error}`);
  }

  return response.json();
}

/**
 * Enhanced error with additional debug information
 */
export class SendMessageError extends Error {
  statusCode: number;
  responseBody: string;
  url: string;

  constructor(message: string, statusCode: number, responseBody: string, url: string) {
    super(message);
    this.name = "SendMessageError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.url = url;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      responseBody: this.responseBody,
      url: this.url,
    };
  }
}

/**
 * Send a message to an agent (async mode - returns immediately)
 * @param workspaceId The workspace ID
 * @param agentId The agent ID
 * @param text The message text to send
 * @returns Response confirming message was queued
 */
export async function sendMessage(
  workspaceId: string,
  agentId: string,
  text: string,
  opencodePromptOptions: {
    agent?: string;
    cloneAndSend?: boolean;
  },
): Promise<{ sent: boolean; async: boolean; cloned_agent?: unknown }> {
  const url = `${buildWorkspaceUrl(workspaceId, `/agents/${agentId}/messages`)}?wait=false`;
  const body: {
    text: string;
    agent: string | undefined;
    clone_and_send?: boolean;
  } = {
    text,
    agent: opencodePromptOptions.agent,
  };

  if (opencodePromptOptions.cloneAndSend) {
    body.clone_and_send = true;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Failed to send message: ${response.statusText}`;

    // Try to extract error from JSON response
    try {
      const errorData = JSON.parse(responseBody);
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Response wasn't JSON, use status text
    }

    throw new SendMessageError(errorMessage, response.status, responseBody, url);
  }

  return response.json();
}

/**
 * Model information returned from the API
 */
export interface Model {
  id: string;
  name: string;
  provider: string;
  contextLimit: number;
  outputLimit: number;
}

/**
 * Fetch available models from the server
 * @param workspaceId The workspace ID
 * @returns Array of available models
 */
export async function fetchModels(workspaceId: string): Promise<Model[]> {
  const url = buildWorkspaceUrl(workspaceId, "/models");
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new agent with optional first message
 * @param workspaceId The workspace ID
 * @param title Optional agent title
 * @param modelId Optional model ID (e.g., "anthropic/claude-sonnet-4")
 * @param prompt Optional first message to send to the agent
 * @param agent Optional agent parameter for OpenCode Prompt API
 * @returns The new agent with ID (and parts if prompt was provided)
 */
export async function createAgent(
  workspaceId: string,
  title?: string,
  modelId?: string,
  prompt?: string,
  agent?: string,
): Promise<{ id: string; parts?: unknown[] }> {
  const body: {
    model?: string | undefined;
    prompt?: string | undefined;
    title?: string;
    agent?: string;
  } = {
    model: modelId,
    prompt,
  };

  if (title !== undefined) {
    body.title = title;
  }

  if (agent !== undefined) {
    body.agent = agent;
  }

  const url = buildWorkspaceUrl(workspaceId, "/agents");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to create agent: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all agent trees
 * @param workspaceId The workspace ID
 * @returns Array of root TreeNodes ready for TreeView component
 */
export async function fetchAgentTrees(workspaceId: string): Promise<TreeNode[]> {
  const url = buildWorkspaceUrl(workspaceId, "/agents");
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch agent trees: ${response.statusText}`);
  }

  const data = await response.json();
  return mapAgentTrees(data.trees);
}

/**
 * Update an agent's title
 * @param workspaceId The workspace ID
 * @param agentId The agent ID
 * @param title The new title
 * @returns The updated agent metadata
 */
export async function updateAgentTitle(workspaceId: string, agentId: string, title: string): Promise<unknown> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Failed to update agent title: ${response.statusText}`;

    // Try to extract error from JSON response
    try {
      const errorData = JSON.parse(responseBody);
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Response wasn't JSON, use status text
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Clone an agent from a specific message
 * @param workspaceId The workspace ID
 * @param agentId The agent ID to clone
 * @param messageId Optional message ID to clone from
 * @returns The new cloned agent
 */
export async function cloneAgent(
  workspaceId: string,
  agentId: string,
  messageId?: string,
): Promise<{ id: string; title: string }> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/clone`);
  const body: { messageId?: string } = {};

  if (messageId !== undefined) {
    body.messageId = messageId;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Failed to clone agent: ${response.statusText}`;

    // Try to extract error from JSON response
    try {
      const errorData = JSON.parse(responseBody);
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Response wasn't JSON, use status text
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Revert an agent to a specific message
 * @param workspaceId The workspace ID
 * @param agentId The agent ID
 * @param messageId The message ID to revert to
 * @returns Success status and the message text to pre-populate
 */
export async function revertAgent(
  workspaceId: string,
  agentId: string,
  messageId: string,
): Promise<{ success: boolean; messageText: string }> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/revert`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Failed to revert agent: ${response.statusText}`;

    // Try to extract error from JSON response
    try {
      const errorData = JSON.parse(responseBody);
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Response wasn't JSON, use status text
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Unrevert an agent (clear revert state)
 * @param workspaceId The workspace ID
 * @param agentId The agent ID
 * @returns Success status
 */
export async function unrevertAgent(workspaceId: string, agentId: string): Promise<{ success: boolean }> {
  const url = buildWorkspaceUrl(workspaceId, `/agents/${agentId}/unrevert`);
  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const responseBody = await response.text();
    let errorMessage = `Failed to unrevert agent: ${response.statusText}`;

    // Try to extract error from JSON response
    try {
      const errorData = JSON.parse(responseBody);
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Response wasn't JSON, use status text
    }

    throw new Error(errorMessage);
  }

  return response.json();
}
