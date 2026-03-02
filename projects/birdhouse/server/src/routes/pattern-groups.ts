// ABOUTME: Pattern groups routes for browsing and managing user, workspace, and bundled patterns
// ABOUTME: Handles listing groups by section, viewing group patterns, and CRUD operations on patterns

import { spawn } from "node:child_process";
import { basename } from "node:path";
import type { Context } from "hono";
import { Hono } from "hono";
import type { DataDB } from "../lib/data-db";
import { log } from "../lib/logger";
import { broadcastToAllWorkspaces, getWorkspaceStream } from "../lib/opencode-stream";
import type { Pattern, PatternGroupScope, PatternGroupsPersistence, PatternMetadata } from "../lib/pattern-groups-db";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Section in the pattern groups list response
 */
interface PatternGroupSection {
  id: string;
  title: string;
  subtitle?: string;
  is_current: boolean;
  groups: PatternGroupSummary[];
}

/**
 * Pattern group summary (for list views)
 */
interface PatternGroupSummary {
  id: string;
  title: string;
  description: string;
  scope: PatternGroupScope;
  workspace_id: string | null;
  pattern_count: number;
  readonly: boolean;
}

/**
 * Full pattern group with patterns (for detail view)
 */
interface PatternGroupDetail extends PatternGroupSummary {
  patterns: PatternMetadata[];
}

/**
 * Full pattern with readonly flag
 */
interface PatternDetail extends Pattern {
  readonly: boolean;
}

// ============================================================================
// Group ID Encoding/Decoding
// ============================================================================

/**
 * Decoded group identifier
 */
interface DecodedGroupId {
  scope: PatternGroupScope;
  groupId: string;
  workspaceId?: string;
}

/**
 * Encode group coordinates into a single ID string
 * Examples:
 * - user-default → scope=user, groupId=default
 * - workspace-abc123-default → scope=workspace, workspaceId=abc123, groupId=default
 * - birdhouse-core → scope=birdhouse, groupId=birdhouse-core
 */
function encodeGroupId(scope: PatternGroupScope, groupId: string, workspaceId?: string): string {
  if (scope === "user") {
    return `user-${groupId}`;
  }
  if (scope === "workspace") {
    if (!workspaceId) throw new Error("workspace_id required for workspace scope");
    return `workspace-${workspaceId}-${groupId}`;
  }
  // Birdhouse scope: use groupId as-is (already contains "birdhouse-" prefix in slug)
  return groupId;
}

/**
 * Decode a group ID string into its components
 * Returns null if format is invalid
 */
function decodeGroupId(encodedId: string): DecodedGroupId | null {
  // User scope: user-{groupId}
  if (encodedId.startsWith("user-")) {
    const groupId = encodedId.slice(5); // Remove "user-" prefix
    if (!groupId) return null;
    return { scope: "user", groupId };
  }

  // Workspace scope: workspace-{workspaceId}-{groupId}
  if (encodedId.startsWith("workspace-")) {
    const parts = encodedId.slice(10).split("-"); // Remove "workspace-" prefix and split
    if (parts.length < 2) return null;

    // Last part is groupId, everything before is workspaceId
    const groupId = parts[parts.length - 1];
    const workspaceId = parts.slice(0, -1).join("-");

    if (!groupId || !workspaceId) return null;
    return { scope: "workspace", groupId, workspaceId };
  }

  // Birdhouse scope: no prefix, use as-is
  // Validate it looks like a birdhouse group (contains "birdhouse-" or other known patterns)
  if (encodedId.includes("-")) {
    return { scope: "birdhouse", groupId: encodedId };
  }

  return null;
}

// ============================================================================
// Event Emission Helper
// ============================================================================

/**
 * Emit a pattern change event via SSE
 *
 * - If workspaceId is null/undefined: Pattern is cross-workspace (user/birdhouse) → broadcast to ALL workspaces
 * - If workspaceId is provided: Pattern is workspace-scoped → emit to that workspace only
 *
 * @param c - Hono context (for workspace access - only needed for workspace-scoped patterns)
 * @param eventType - Event type (pattern.created, pattern.updated, pattern.deleted)
 * @param patternId - Pattern ID
 * @param groupId - Encoded group ID
 * @param workspaceId - Workspace ID (null/undefined for cross-workspace patterns)
 * @param pattern - Optional pattern metadata (for created/updated events)
 */
function emitPatternEvent(
  c: Context,
  eventType: "birdhouse.pattern.created" | "birdhouse.pattern.updated" | "birdhouse.pattern.deleted",
  patternId: string,
  groupId: string,
  workspaceId: string | undefined,
  pattern?: PatternMetadata,
): void {
  const properties: Record<string, unknown> = {
    patternId,
    groupId,
    workspaceId: workspaceId || null,
  };

  if (pattern) {
    properties.pattern = pattern;
  }

  // No workspaceId → cross-workspace pattern (user/birdhouse) → broadcast to all
  if (!workspaceId) {
    broadcastToAllWorkspaces(eventType, properties);
    return;
  }

  // Has workspaceId → workspace-scoped pattern → emit to that workspace only
  const opencodeBase = c.get("opencodeBase");
  const workspace = c.get("workspace");

  if (!opencodeBase || !workspace?.directory) {
    log.server.warn({ patternId, workspaceId }, "Skipping workspace pattern event - no workspace context");
    return;
  }

  const stream = getWorkspaceStream(opencodeBase, workspace.directory);
  stream.emitCustomEvent(eventType, properties);
}

// ============================================================================
// Route Factory
// ============================================================================

/**
 * Creates pattern group routes with dependencies
 */
export function createPatternGroupRoutes(dataDb: DataDB, persistence: PatternGroupsPersistence) {
  const app = new Hono();

  // ==================== GET /api/pattern-groups ====================

  /**
   * List all pattern groups organized by section
   * Query params: workspaceId (required)
   */
  app.get("/", async (c) => {
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    try {
      const sections: PatternGroupSection[] = [];

      // Get all workspaces for workspace sections
      const allWorkspaces = dataDb.getAllWorkspaces();
      const currentWorkspace = allWorkspaces.find((w) => w.workspace_id === workspaceId);

      // Section 1: User patterns (always first)
      const userGroups = await persistence.getAllGroups({ scope: "user" });
      const userGroupSummaries = await Promise.all(
        userGroups.map(async (group) => {
          const patterns = await persistence.getGroupPatterns(group.id, "user");
          return {
            id: encodeGroupId("user", group.id),
            title: group.title,
            description: group.description,
            scope: "user" as PatternGroupScope,
            workspace_id: null,
            pattern_count: patterns.length,
            readonly: false,
          };
        }),
      );

      sections.push({
        id: "user",
        title: "Your Patterns",
        subtitle: "These patterns come with you to all your workspaces",
        is_current: false,
        groups: userGroupSummaries,
      });

      // Section 2: Current workspace (if exists)
      if (currentWorkspace) {
        const workspaceGroups = await persistence.getAllGroups({
          scope: "workspace",
          workspace_id: workspaceId,
        });
        const workspaceGroupSummaries = await Promise.all(
          workspaceGroups.map(async (group) => {
            const patterns = await persistence.getGroupPatterns(group.id, "workspace", workspaceId);
            return {
              id: encodeGroupId("workspace", group.id, workspaceId),
              title: group.title,
              description: group.description,
              scope: "workspace" as PatternGroupScope,
              workspace_id: workspaceId,
              pattern_count: patterns.length,
              readonly: false,
            };
          }),
        );

        sections.push({
          id: `workspace-${workspaceId}`,
          title: currentWorkspace.title || basename(currentWorkspace.directory),
          subtitle: currentWorkspace.directory,
          is_current: true,
          groups: workspaceGroupSummaries,
        });
      }

      // Section 3+: Other workspaces (ordered by last_used desc)
      const otherWorkspaces = allWorkspaces
        .filter((w) => w.workspace_id !== workspaceId)
        .sort((a, b) => new Date(b.last_used).getTime() - new Date(a.last_used).getTime());

      for (const workspace of otherWorkspaces) {
        const workspaceGroups = await persistence.getAllGroups({
          scope: "workspace",
          workspace_id: workspace.workspace_id,
        });
        const workspaceGroupSummaries = await Promise.all(
          workspaceGroups.map(async (group) => {
            const patterns = await persistence.getGroupPatterns(group.id, "workspace", workspace.workspace_id);
            return {
              id: encodeGroupId("workspace", group.id, workspace.workspace_id),
              title: group.title,
              description: group.description,
              scope: "workspace" as PatternGroupScope,
              workspace_id: workspace.workspace_id,
              pattern_count: patterns.length,
              readonly: false,
            };
          }),
        );

        sections.push({
          id: `workspace-${workspace.workspace_id}`,
          title: workspace.title || basename(workspace.directory),
          subtitle: workspace.directory,
          is_current: false,
          groups: workspaceGroupSummaries,
        });
      }

      // Final section: Birdhouse bundled patterns
      const birdhouseGroups = await persistence.getAllGroups({ scope: "birdhouse" });
      const birdhouseGroupSummaries = await Promise.all(
        birdhouseGroups.map(async (group) => {
          const patterns = await persistence.getGroupPatterns(group.id, "birdhouse");
          return {
            id: encodeGroupId("birdhouse", group.id),
            title: group.title,
            description: group.description,
            scope: "birdhouse" as PatternGroupScope,
            workspace_id: null,
            pattern_count: patterns.length,
            readonly: true,
          };
        }),
      );

      sections.push({
        id: "birdhouse",
        title: "Birdhouse Bundled Patterns",
        is_current: false,
        groups: birdhouseGroupSummaries,
      });

      return c.json({ sections });
    } catch (error) {
      log.server.error({ error, workspaceId }, "Error listing pattern groups");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // ==================== GET /api/pattern-groups/patterns ====================

  /**
   * Get all patterns flattened across all groups
   * Query params: workspaceId (required)
   * Returns: { patterns: PatternMetadata[] }
   */
  app.get("/patterns", async (c) => {
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    try {
      // Get all patterns across all scopes (user + workspace + birdhouse)
      const patterns = await persistence.getAllPatterns({ workspace_id: workspaceId });

      return c.json({ patterns });
    } catch (error) {
      log.server.error({ error, workspaceId }, "Error fetching all patterns");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // ==================== GET /api/pattern-groups/patterns/:patternId ====================

  /**
   * Get single pattern by ID across all groups
   * Query params:
   * - scope=birdhouse: Search only birdhouse patterns (no workspaceId needed)
   * - workspaceId: Search user + workspace + birdhouse patterns for this workspace
   */
  app.get("/patterns/:patternId", async (c) => {
    const patternId = c.req.param("patternId");
    const scope = c.req.query("scope");
    const workspaceId = c.req.query("workspaceId");

    // Validate: either scope=birdhouse OR workspaceId must be provided
    if (scope !== "birdhouse" && !workspaceId) {
      return c.json({ error: "Either scope=birdhouse or workspaceId query parameter is required" }, 400);
    }

    try {
      let pattern: Pattern | null = null;

      if (scope === "birdhouse") {
        // Search only birdhouse patterns
        pattern = await persistence.findBirdhousePatternById(patternId);
      } else if (workspaceId) {
        // Search user + workspace + birdhouse patterns
        pattern = await persistence.findPatternById(patternId, workspaceId);
      }

      if (!pattern) {
        return c.json({ error: `Pattern ${patternId} not found` }, 404);
      }

      const response: PatternDetail = {
        ...pattern,
        readonly: pattern.group_id.startsWith("birdhouse") || scope === "birdhouse",
      };

      return c.json(response);
    } catch (error) {
      log.server.error({ error, patternId, scope, workspaceId }, "Error fetching pattern by ID");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // ==================== GET /api/pattern-groups/:groupId ====================

  /**
   * Get single pattern group with patterns list
   * Query params: workspaceId (required)
   */
  app.get("/:groupId", async (c) => {
    const encodedGroupId = c.req.param("groupId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    // Decode group ID
    const decoded = decodeGroupId(encodedGroupId);
    if (!decoded) {
      return c.json({ error: `Invalid group ID format: ${encodedGroupId}` }, 400);
    }

    try {
      // Fetch group metadata
      const group = await persistence.getGroup(decoded.groupId, decoded.scope, decoded.workspaceId);

      if (!group) {
        return c.json({ error: `Pattern group ${encodedGroupId} not found` }, 404);
      }

      // Fetch patterns in group (metadata only, no prompt content)
      const patterns = await persistence.getGroupPatterns(decoded.groupId, decoded.scope, decoded.workspaceId);

      const response: PatternGroupDetail = {
        id: encodedGroupId,
        title: group.title,
        description: group.description,
        scope: group.scope,
        workspace_id: group.workspace_id,
        pattern_count: patterns.length,
        readonly: decoded.scope === "birdhouse",
        patterns,
      };

      return c.json(response);
    } catch (error) {
      log.server.error({ error, groupId: encodedGroupId }, "Error fetching pattern group");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // ==================== GET /api/pattern-groups/:groupId/patterns/:patternId ====================

  /**
   * Get single pattern with full details
   * Query params: workspaceId (required)
   */
  app.get("/:groupId/patterns/:patternId", async (c) => {
    const encodedGroupId = c.req.param("groupId");
    const patternId = c.req.param("patternId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    // Decode group ID
    const decoded = decodeGroupId(encodedGroupId);
    if (!decoded) {
      return c.json({ error: `Invalid group ID format: ${encodedGroupId}` }, 400);
    }

    try {
      // Fetch full pattern
      const pattern = await persistence.getPattern(patternId, decoded.groupId, decoded.scope, decoded.workspaceId);

      if (!pattern) {
        return c.json({ error: `Pattern ${patternId} not found in group ${encodedGroupId}` }, 404);
      }

      const response: PatternDetail = {
        ...pattern,
        group_id: encodedGroupId, // Use encoded group ID for frontend
        readonly: decoded.scope === "birdhouse",
      };

      return c.json(response);
    } catch (error) {
      log.server.error({ error, groupId: encodedGroupId, patternId }, "Error fetching pattern");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // ==================== POST /api/pattern-groups/:groupId/patterns ====================

  /**
   * Create a new pattern in a group
   * Query params: workspaceId (required)
   * Body: { title, description?, prompt, trigger_phrases? }
   */
  app.post("/:groupId/patterns", async (c) => {
    const encodedGroupId = c.req.param("groupId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    // Decode group ID
    const decoded = decodeGroupId(encodedGroupId);
    if (!decoded) {
      return c.json({ error: `Invalid group ID format: ${encodedGroupId}` }, 400);
    }

    // Cannot create patterns in birdhouse groups
    if (decoded.scope === "birdhouse") {
      return c.json({ error: "Cannot create patterns in bundled groups" }, 400);
    }

    try {
      // Parse request body
      const body = await c.req.json();

      // Validate required fields
      if (!body.title || typeof body.title !== "string" || body.title.trim() === "") {
        return c.json({ error: "title is required and must be a non-empty string" }, 400);
      }

      if (!body.prompt || typeof body.prompt !== "string") {
        return c.json({ error: "prompt is required and must be a string" }, 400);
      }

      // Validate optional fields
      if (body.description !== undefined && typeof body.description !== "string") {
        return c.json({ error: "description must be a string if provided" }, 400);
      }

      if (body.trigger_phrases !== undefined && !Array.isArray(body.trigger_phrases)) {
        return c.json({ error: "trigger_phrases must be an array if provided" }, 400);
      }

      // Validate trigger phrases if provided
      const triggerPhrases = body.trigger_phrases || [];
      if (!Array.isArray(triggerPhrases) || !triggerPhrases.every((p: unknown) => typeof p === "string")) {
        return c.json({ error: "trigger_phrases must be an array of strings" }, 400);
      }

      // Verify group exists
      const group = await persistence.getGroup(decoded.groupId, decoded.scope, decoded.workspaceId);
      if (!group) {
        return c.json({ error: `Pattern group ${encodedGroupId} not found` }, 404);
      }

      // Create pattern
      const pattern = await persistence.createPattern(
        decoded.groupId,
        decoded.scope,
        decoded.workspaceId,
        {
          title: body.title.trim(),
          trigger_phrases: triggerPhrases,
        },
        body.prompt,
        body.description || undefined,
      );

      const response: PatternDetail = {
        ...pattern,
        group_id: encodedGroupId, // Use encoded group ID for frontend
        readonly: false,
      };

      // Emit SSE event for pattern creation
      emitPatternEvent(c, "birdhouse.pattern.created", pattern.id, encodedGroupId, decoded.workspaceId, {
        id: pattern.id,
        title: pattern.title,
        description: pattern.description,
        trigger_phrases: pattern.trigger_phrases,
        created_at: pattern.created_at,
        updated_at: pattern.updated_at,
      });

      return c.json(response, 201);
    } catch (error) {
      log.server.error({ error, groupId: encodedGroupId }, "Error creating pattern");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // ==================== PATCH /api/pattern-groups/:groupId/patterns/:patternId/trigger-phrases ====================

  /**
   * Update pattern trigger phrases
   * Query params: workspaceId (required)
   * Body: { trigger_phrases: string[] }
   */
  app.patch("/:groupId/patterns/:patternId/trigger-phrases", async (c) => {
    const encodedGroupId = c.req.param("groupId");
    const patternId = c.req.param("patternId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    // Decode group ID
    const decoded = decodeGroupId(encodedGroupId);
    if (!decoded) {
      return c.json({ error: `Invalid group ID format: ${encodedGroupId}` }, 400);
    }

    try {
      // Parse request body
      const body = await c.req.json();

      // Validate trigger_phrases field
      if (!body.trigger_phrases) {
        return c.json({ error: "Missing trigger_phrases field" }, 400);
      }

      if (!Array.isArray(body.trigger_phrases)) {
        return c.json({ error: "trigger_phrases must be an array" }, 400);
      }

      // Trim all phrases and validate
      const trimmedPhrases: string[] = body.trigger_phrases.map((phrase: unknown) => {
        if (typeof phrase !== "string") {
          throw new Error("All trigger phrases must be strings");
        }
        return phrase.trim();
      });

      // Check for empty strings after trim
      if (trimmedPhrases.some((phrase: string) => phrase === "")) {
        return c.json({ error: "trigger_phrases must not contain empty strings" }, 400);
      }

      // Check for duplicates
      const uniquePhrases = new Set(trimmedPhrases);
      if (uniquePhrases.size !== trimmedPhrases.length) {
        return c.json({ error: "trigger_phrases must not contain duplicates" }, 400);
      }

      // Update trigger phrases (works for all scopes including birdhouse)
      const updatedPattern = await persistence.updateTriggerPhrases(
        patternId,
        decoded.groupId,
        decoded.scope,
        decoded.workspaceId,
        trimmedPhrases,
      );

      if (!updatedPattern) {
        return c.json({ error: `Pattern ${patternId} not found in group ${encodedGroupId}` }, 404);
      }

      // Emit SSE event for pattern update
      emitPatternEvent(c, "birdhouse.pattern.updated", patternId, encodedGroupId, decoded.workspaceId, {
        id: updatedPattern.id,
        title: updatedPattern.title,
        description: updatedPattern.description,
        trigger_phrases: updatedPattern.trigger_phrases,
        created_at: updatedPattern.created_at,
        updated_at: updatedPattern.updated_at,
      });

      // Return minimal response (id, trigger_phrases, updated_at)
      return c.json({
        id: updatedPattern.id,
        trigger_phrases: updatedPattern.trigger_phrases,
        updated_at: updatedPattern.updated_at,
      });
    } catch (error) {
      log.server.error({ error, groupId: encodedGroupId, patternId }, "Error updating trigger phrases");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // ==================== PATCH /api/pattern-groups/:groupId/patterns/:patternId ====================

  /**
   * Update pattern metadata (title, description, prompt)
   * Query params: workspaceId (required)
   * Body: { title?, description?, prompt? } (at least one required)
   */
  app.patch("/:groupId/patterns/:patternId", async (c) => {
    const encodedGroupId = c.req.param("groupId");
    const patternId = c.req.param("patternId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    // Decode group ID
    const decoded = decodeGroupId(encodedGroupId);
    if (!decoded) {
      return c.json({ error: `Invalid group ID format: ${encodedGroupId}` }, 400);
    }

    // Cannot edit birdhouse patterns (except trigger phrases)
    if (decoded.scope === "birdhouse") {
      return c.json({ error: "Cannot edit bundled patterns" }, 400);
    }

    try {
      // Parse request body
      const body = await c.req.json();

      // Validate at least one field provided
      const hasTitle = "title" in body;
      const hasDescription = "description" in body;
      const hasPrompt = "prompt" in body;

      if (!hasTitle && !hasDescription && !hasPrompt) {
        return c.json({ error: "At least one field (title, description, prompt) must be provided" }, 400);
      }

      // Validate types
      if (hasTitle && (typeof body.title !== "string" || body.title.trim() === "")) {
        return c.json({ error: "title must be a non-empty string if provided" }, 400);
      }

      if (hasDescription && typeof body.description !== "string") {
        return c.json({ error: "description must be a string if provided" }, 400);
      }

      if (hasPrompt && typeof body.prompt !== "string") {
        return c.json({ error: "prompt must be a string if provided" }, 400);
      }

      // Build updates object
      const updates: Partial<PatternMetadata> = {};
      if (hasTitle) updates.title = body.title.trim();

      // Update pattern
      const updatedPattern = await persistence.updatePattern(
        patternId,
        decoded.groupId,
        decoded.scope,
        decoded.workspaceId,
        updates,
        hasPrompt ? body.prompt : undefined,
        hasDescription ? body.description : undefined,
      );

      if (!updatedPattern) {
        return c.json({ error: `Pattern ${patternId} not found in group ${encodedGroupId}` }, 404);
      }

      const response: PatternDetail = {
        ...updatedPattern,
        group_id: encodedGroupId, // Use encoded group ID for frontend
        readonly: false,
      };

      // Emit SSE event for pattern update
      emitPatternEvent(c, "birdhouse.pattern.updated", patternId, encodedGroupId, decoded.workspaceId, {
        id: updatedPattern.id,
        title: updatedPattern.title,
        description: updatedPattern.description,
        trigger_phrases: updatedPattern.trigger_phrases,
        created_at: updatedPattern.created_at,
        updated_at: updatedPattern.updated_at,
      });

      return c.json(response);
    } catch (error) {
      log.server.error({ error, groupId: encodedGroupId, patternId }, "Error updating pattern");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // ==================== DELETE /api/pattern-groups/:groupId/patterns/:patternId ====================

  /**
   * Delete a pattern permanently
   * Query params: workspaceId (required)
   */
  app.delete("/:groupId/patterns/:patternId", async (c) => {
    const encodedGroupId = c.req.param("groupId");
    const patternId = c.req.param("patternId");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    const decoded = decodeGroupId(encodedGroupId);
    if (!decoded) {
      return c.json({ error: `Invalid group ID format: ${encodedGroupId}` }, 400);
    }

    // Cannot delete birdhouse patterns
    if (decoded.scope === "birdhouse") {
      return c.json({ error: "Cannot delete bundled patterns" }, 403);
    }

    try {
      const deleted = await persistence.deletePattern(patternId, decoded.groupId, decoded.scope, decoded.workspaceId);

      if (!deleted) {
        return c.json({ error: `Pattern ${patternId} not found in group ${encodedGroupId}` }, 404);
      }

      // Emit SSE event for pattern deletion
      emitPatternEvent(c, "birdhouse.pattern.deleted", patternId, encodedGroupId, decoded.workspaceId);

      return c.json({ success: true });
    } catch (error) {
      log.server.error({ error, groupId: encodedGroupId, patternId }, "Error deleting pattern");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // ==================== POST /:groupId/reveal ====================

  /**
   * Open the group's patterns folder in the system file manager (Finder/Explorer/etc)
   */
  app.post("/:groupId/reveal", async (c) => {
    const encodedGroupId = c.req.param("groupId");

    const decoded = decodeGroupId(encodedGroupId);
    if (!decoded) {
      return c.json({ error: `Invalid group ID format: ${encodedGroupId}` }, 400);
    }

    try {
      const patternsPath = persistence.getGroupPatternsPath(decoded.groupId, decoded.scope, decoded.workspaceId);

      // Determine the command based on platform
      const platform = process.platform;
      let command: string;
      let args: string[];

      if (platform === "darwin") {
        // macOS: use 'open' command
        command = "open";
        args = [patternsPath];
      } else if (platform === "win32") {
        // Windows: use 'explorer' command
        command = "explorer";
        args = [patternsPath];
      } else {
        // Linux: use 'xdg-open' command
        command = "xdg-open";
        args = [patternsPath];
      }

      // Spawn the command
      const child = spawn(command, args, {
        detached: true,
        stdio: "ignore",
      });

      // Unref so the process doesn't keep Node.js running
      child.unref();

      log.server.info(
        { groupId: encodedGroupId, path: patternsPath, platform },
        "Revealed pattern group in file manager",
      );

      return c.json({ success: true, path: patternsPath });
    } catch (error) {
      log.server.error({ error, groupId: encodedGroupId }, "Error revealing pattern group");
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  return app;
}
