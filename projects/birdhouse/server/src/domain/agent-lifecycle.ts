// ABOUTME: Domain operations for agent lifecycle management
// ABOUTME: Enforces invariants like event emission when agents are created

import type { BirdhouseSession as Session } from "../harness";
import type { AgentRow, AgentsDB } from "../lib/agents-db";
import type { DataDB } from "../lib/data-db";
import type { OpenCodeStream } from "../lib/opencode-stream";
import type { TelemetryClient } from "../lib/telemetry";

/**
 * Sanitize agent title to prevent XSS attacks
 * Strips HTML tags and dangerous characters while preserving readability
 */
function sanitizeTitle(title: string): string {
  return title
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/&/g, "&amp;");
}

/**
 * Create an agent in the database
 *
 * This is the canonical way to create agents in Birdhouse.
 * Ensures all necessary side effects occur (events, etc.)
 *
 * @param agentsDB Database instance
 * @param agentData Agent data to insert
 * @param stream OpenCode stream for emitting events
 * @returns The created agent
 */
export function createAgent(
  agentsDB: AgentsDB,
  agentData: Omit<AgentRow, "id"> & { id?: string },
  stream: OpenCodeStream,
  telemetry: TelemetryClient,
  dataDb: DataDB,
): AgentRow {
  // Sanitize title to prevent XSS (defense in depth)
  const sanitizedData = {
    ...agentData,
    title: sanitizeTitle(agentData.title),
  };

  const agent = agentsDB.insertAgent(sanitizedData);

  // Notify system that agent was created
  stream.emitCustomEvent("birdhouse.agent.created", {
    agentId: agent.id,
    agent: agent,
  });

  // Anonymous telemetry: count agents created across all installations
  try {
    const installId = dataDb.getOrCreateInstallId();
    telemetry.trackAgentCreated(installId);
  } catch {
    // Never let telemetry errors affect agent creation
  }

  return agent;
}

/**
 * Clone an agent by forking its OpenCode session
 *
 * Creates a new agent as a child of the calling agent by:
 * 1. Forking the OpenCode session (optionally from a specific message ID)
 * 2. Creating a new agent record as a child of the calling agent (if provided) or source agent
 * 3. Setting cloned_from to point to the source agent
 *
 * Tree structure behavior:
 * - If callingAgentId is provided: parent_id = callingAgentId, tree_id/level from calling agent
 * - If callingAgentId is NOT provided: parent_id = sourceAgent.id, tree_id/level from source agent
 * - cloned_from ALWAYS = sourceAgent.id (tracks the cloning relationship)
 *
 * @param sourceAgent The agent to clone from
 * @param deps Dependencies (opencode, agentsDB, log)
 * @param options Optional configuration
 * @param options.messageId Optional message ID to fork from
 * @param options.title Optional title override (defaults to source title)
 * @param options.model Optional model override (defaults to source model)
 * @param options.callingAgentId Optional ID of the agent calling clone (becomes parent)
 * @returns The cloned agent
 */
export async function cloneAgent(
  sourceAgent: AgentRow,
  deps: {
    harness: {
      forkSession: (sessionId: string, messageId?: string) => Promise<Session>;
    };
    agentsDB: AgentsDB;
    dataDb: DataDB;
    log: {
      server: {
        info: (meta: Record<string, unknown>, msg: string) => void;
      };
    };
    stream: OpenCodeStream;
    telemetry: TelemetryClient;
  },
  options?: {
    messageId?: string;
    title?: string;
    model?: string;
    callingAgentId?: string;
  },
): Promise<AgentRow> {
  const { harness, agentsDB, log } = deps;

  // Fork the OpenCode session
  log.server.info(
    {
      source_session: sourceAgent.session_id,
      message_id: options?.messageId,
      title: options?.title,
      calling_agent_id: options?.callingAgentId,
    },
    "Forking OpenCode session for clone",
  );

  const session = await harness.forkSession(sourceAgent.session_id, options?.messageId);

  log.server.info({ original_session: sourceAgent.session_id, forked_session: session.id }, "OpenCode session forked");

  // Determine parent, tree_id, and level based on calling agent (if provided)
  let parent_id: string;
  let tree_id: string;
  let level: number;

  if (options?.callingAgentId) {
    // Clone as child of calling agent
    const callingAgent = agentsDB.getAgentById(options.callingAgentId);
    if (!callingAgent) {
      throw new Error(`Calling agent with id "${options.callingAgentId}" not found`);
    }

    parent_id = callingAgent.id;
    tree_id = callingAgent.tree_id;
    level = callingAgent.level + 1;

    log.server.info(
      {
        calling_agent: callingAgent.id,
        calling_agent_level: callingAgent.level,
        new_level: level,
      },
      "Clone will be child of calling agent",
    );
  } else {
    // Clone as child of source agent (original behavior)
    parent_id = sourceAgent.id;
    tree_id = sourceAgent.tree_id;
    level = sourceAgent.level + 1;

    log.server.info(
      {
        source_agent: sourceAgent.id,
        source_agent_level: sourceAgent.level,
        new_level: level,
      },
      "Clone will be child of source agent",
    );
  }

  // Create cloned agent with cloned_from set to source
  const now = Date.now();
  const agentData: Omit<AgentRow, "id"> = {
    session_id: session.id,
    parent_id,
    tree_id,
    level,
    title: options?.title ?? sourceAgent.title,
    project_id: session.projectID,
    directory: session.directory,
    model: options?.model ?? sourceAgent.model,
    harness_type: sourceAgent.harness_type,
    created_at: now,
    updated_at: now,
    cloned_from: sourceAgent.id, // Always set to source agent
    cloned_at: now, // Same value as created_at
    archived_at: null,
  };

  const clonedAgent = createAgent(agentsDB, agentData, deps.stream, deps.telemetry, deps.dataDb);

  log.server.info(
    {
      source_agent: sourceAgent.id,
      cloned_agent: clonedAgent.id,
      parent_agent: parent_id,
      tree_id: clonedAgent.tree_id,
      level: clonedAgent.level,
      cloned_from: clonedAgent.cloned_from,
      from_message_id: options?.messageId,
    },
    "Agent cloned successfully",
  );

  return clonedAgent;
}
