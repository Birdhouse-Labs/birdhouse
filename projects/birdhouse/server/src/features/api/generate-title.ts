// ABOUTME: Generate agent title using Birdhouse-owned title rules via OpenCode
// ABOUTME: Used by POST /api/title/generate endpoint

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { generateTitle as generateTitleService } from "../../lib/title-generator";

/**
 * POST /api/title/generate - Generate a title for a message
 */
export async function generateTitle(c: Context, deps: Pick<Deps, "opencode" | "log">) {
  const { log } = deps;

  try {
    // Parse and validate request body
    const body = await c.req.json();
    const { message, source_agent_title } = body;

    // Validate required fields
    if (!message || typeof message !== "string" || message.trim() === "") {
      return c.json({ error: "message is required and must be a non-empty string" }, 400);
    }

    // Validate optional source_agent_title
    if (
      source_agent_title !== undefined &&
      (typeof source_agent_title !== "string" || source_agent_title.trim() === "")
    ) {
      return c.json({ error: "source_agent_title must be a non-empty string if provided" }, 400);
    }

    // Generate title using service
    const result = await generateTitleService(deps, {
      message: message.trim(),
      sourceAgentTitle: source_agent_title?.trim(),
    });

    // Return generated title
    return c.json({
      title: result.title,
    });
  } catch (error) {
    log.server.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to generate title",
    );

    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate title",
      },
      500,
    );
  }
}
