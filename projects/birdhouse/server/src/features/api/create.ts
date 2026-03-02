// ABOUTME: Create a new agent (root or child) with tree metadata calculation
// ABOUTME: Used by /api/agents POST endpoint with optional prompt for first message

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { createAgent } from "../../domain/agent-lifecycle";
import { sendFirstMessage } from "../../lib/agent-messaging";
import type { AgentRow } from "../../lib/agents-db";
import { generateAgentId } from "../../lib/agents-db";
import { getWorkspaceStream } from "../../lib/opencode-stream";
import { syncAgentTitle } from "../../lib/sync-agent-title";
import { generateTitle as generateTitleService } from "../../lib/title-generator";
import "../../types/context";

/**
 * POST /agents - Create a new agent with optional first message
 */
export async function create(c: Context, deps: Pick<Deps, "opencode" | "agentsDB" | "dataDb" | "log" | "telemetry">) {
  const {
    opencode: { createSession },
    agentsDB,
    log,
    telemetry,
  } = deps;

  try {
    // 1. Parse and validate request body
    const body = await c.req.json();
    const { title: rawTitle, model: requestModel, parent_id, prompt, wait, agent: requestAgent } = body;

    // Determine initial title
    // If user provides explicit title, use it (no auto-generation)
    // Otherwise, use temp title that will be replaced after message sent
    const hasExplicitTitle = rawTitle && typeof rawTitle === "string" && rawTitle.trim();
    const title = hasExplicitTitle ? rawTitle.trim() : "Creating Agent...";

    // Default model if not provided
    const model =
      requestModel && typeof requestModel === "string" && requestModel.trim()
        ? requestModel.trim()
        : "anthropic/claude-sonnet-4-5";

    if (typeof model !== "string") {
      return c.json({ error: "model must be a string if provided" }, 400);
    }

    // Validate parent_id if provided
    if (parent_id !== undefined && parent_id !== null && typeof parent_id !== "string") {
      return c.json({ error: "parent_id must be a string if provided" }, 400);
    }

    // 2. Calculate tree metadata (root vs child)
    let tree_id: string;
    let level: number;
    let agent_id: string | undefined;

    if (parent_id) {
      // Child agent - lookup parent
      const parent = agentsDB.getAgentById(parent_id);
      if (!parent) {
        return c.json({ error: `Parent agent with id "${parent_id}" not found` }, 400);
      }

      tree_id = parent.tree_id;
      level = parent.level + 1;

      log.server.info({ parent_id, tree_id, level, title }, "Creating child agent");
    } else {
      // Root agent - generate ID first so tree_id can equal agent.id
      agent_id = generateAgentId();
      tree_id = agent_id; // Root agent is its own tree root
      level = 0;

      log.server.info({ agent_id, title, level }, "Creating root agent");
    }

    // 3. Create OpenCode session via API
    log.server.info({ title }, "Creating OpenCode session");
    const session = await createSession(title);
    log.server.info(
      {
        sessionId: session.id,
        projectID: session.projectID,
        directory: session.directory,
      },
      "OpenCode session created",
    );

    // 4. Insert into agents database
    const now = Date.now();

    const agentData: Omit<AgentRow, "id"> & { id?: string } = {
      id: agent_id, // Defined for root agents, undefined for children (auto-generated)
      session_id: session.id,
      parent_id: parent_id || null,
      tree_id,
      level,
      title,
      project_id: session.projectID,
      directory: session.directory,
      model,
      created_at: now,
      updated_at: now,
      cloned_from: null, // Not a clone
      cloned_at: null,
      archived_at: null,
    };

    // Create stream for event emission
    const opencodeBase = c.get("opencodeBase");
    const workspace = c.get("workspace");
    if (!opencodeBase || !workspace || !workspace.directory) {
      throw new Error("Workspace context not available");
    }
    const workspaceDir = workspace.directory;
    const stream = getWorkspaceStream(opencodeBase, workspaceDir);

    const agent = createAgent(agentsDB, agentData, stream, telemetry, deps.dataDb);

    log.server.info(
      {
        agentId: agent.id,
        sessionId: agent.session_id,
        tree_id: agent.tree_id,
        level: agent.level,
      },
      "Agent inserted into database",
    );

    // 5. Send initial prompt if provided
    if (prompt && typeof prompt === "string" && prompt.trim()) {
      const shouldWait = wait === true; // Default to false (async) for frontend

      try {
        const result = await sendFirstMessage(deps, {
          agentId: agent.id,
          sessionId: agent.session_id,
          model,
          prompt: prompt.trim(),
          wait: shouldWait,
          ...(requestAgent && { agent: requestAgent }),
        });

        // 6. Generate title if user didn't provide one
        if (!hasExplicitTitle) {
          // Get workspace ID from context
          const workspace = c.get("workspace");
          const workspaceId = workspace.workspace_id;

          // Fire-and-forget title generation (don't block response)
          generateAndUpdateTitle(
            deps,
            agent.id,
            prompt.trim(),
            workspaceId,
            opencodeBase,
            workspaceDir,
            deps.opencode,
          ).catch((error) => {
            log.server.error(
              {
                agentId: agent.id,
                error: error instanceof Error ? error.message : "Unknown error",
              },
              "Failed to generate title",
            );
          });
        }

        if (result.parts) {
          // Blocking mode - return agent with response parts
          return c.json({ ...agent, parts: result.parts }, 201);
        }
        // Async mode falls through to return agent without parts
      } catch (error) {
        // Handle errors from sendFirstMessage (e.g., invalid model format)
        if (error instanceof Error && error.message.includes("Invalid model format")) {
          return c.json({ error: error.message }, 500);
        }
        throw error;
      }
    }

    // 7. Return complete agent record (no prompt or async mode)
    return c.json(agent, 201);
  } catch (error) {
    log.server.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to create agent",
    );

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("Parent agent")) {
        return c.json({ error: error.message }, 400);
      }
      if (error.message.includes("already exists")) {
        return c.json({ error: error.message }, 409);
      }
      if (error.message.includes("Failed to create session")) {
        return c.json({ error: error.message }, 502);
      }
    }

    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to create agent",
      },
      500,
    );
  }
}

/**
 * Generate title and update agent (async helper)
 */
async function generateAndUpdateTitle(
  deps: Pick<Deps, "agentsDB" | "log" | "opencode">,
  agentId: string,
  message: string,
  _workspaceId: string,
  opencodeBase: string,
  workspaceDir: string,
  opencodeClient: import("../../lib/opencode-client").OpenCodeClient,
  _sourceTitle?: string,
): Promise<void> {
  const { agentsDB, log } = deps;

  try {
    log.server.info({ agentId, messageLength: message.length }, "Generating title for new agent");

    // Call title generation service directly (no HTTP request needed)
    const result = await generateTitleService(deps, {
      message: message.trim(),
      patternId: "title_generation_default",
    });

    const generatedTitle = result.title;

    log.server.info({ agentId, generatedTitle }, "Title generated successfully");

    // Update agent title in Birdhouse, sync to OpenCode, and emit SSE event
    await syncAgentTitle(
      {
        agentsDB,
        opencodeClient,
        opencodeBase,
        workspaceDir,
        log,
      },
      agentId,
      generatedTitle,
    );

    log.server.info({ agentId, title: generatedTitle }, "Agent title updated and event emitted");
  } catch (error) {
    log.server.error(
      {
        agentId,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to generate and update title",
    );
    throw error;
  }
}
