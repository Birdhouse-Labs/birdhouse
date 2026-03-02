// ABOUTME: Generate agent title using pattern-based prompts via OpenCode
// ABOUTME: Used by POST /api/title/generate endpoint

import type { Context } from "hono";
import type { Deps } from "../../dependencies";
import { generateTitle as generateTitleService } from "../../lib/title-generator";

/**
 * POST /api/title/generate - Generate a title for a message using a pattern
 */
export async function generateTitle(c: Context, deps: Pick<Deps, "opencode" | "log">) {
  const { log } = deps;

  try {
    // Parse and validate request body
    const body = await c.req.json();
    const { message, pattern_id, source_agent_title } = body;

    // Validate required fields
    if (!message || typeof message !== "string" || message.trim() === "") {
      return c.json({ error: "message is required and must be a non-empty string" }, 400);
    }

    // Validate optional pattern_id
    if (pattern_id !== undefined && (typeof pattern_id !== "string" || pattern_id.trim() === "")) {
      return c.json({ error: "pattern_id must be a non-empty string if provided" }, 400);
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
      patternId: pattern_id?.trim(),
      sourceAgentTitle: source_agent_title?.trim(),
    });

    // Return generated title
    return c.json({
      title: result.title,
      pattern_id: result.patternId,
    });
  } catch (error) {
    log.server.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to generate title",
    );

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("Pattern") && error.message.includes("not found")) {
        return c.json({ error: error.message }, 404);
      }
      if (error.message.includes("no prompt content")) {
        return c.json({ error: error.message }, 400);
      }
    }

    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate title",
      },
      500,
    );
  }
}
