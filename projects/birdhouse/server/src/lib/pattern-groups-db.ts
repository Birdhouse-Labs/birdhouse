// ABOUTME: Pattern group and pattern persistence with file-based storage
// ABOUTME: Handles user, workspace, and Birdhouse-seeded pattern groups with metadata management

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import * as yaml from "js-yaml";
import { nanoid } from "nanoid";
import { log } from "./logger";

// ============================================================================
// Type Definitions
// ============================================================================

export type PatternGroupScope = "user" | "workspace" | "birdhouse";

/**
 * Pattern group metadata as stored in group.yml
 */
export interface PatternGroup {
  id: string;
  title: string;
  description: string;
  scope: PatternGroupScope;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Pattern metadata as stored in metadata.yml
 */
export interface PatternMetadata {
  id: string;
  title: string;
  description?: string; // From description.md (optional, loaded when needed)
  trigger_phrases: string[];
  created_at?: string; // Optional for user-created patterns
  updated_at?: string; // Optional for user-created patterns
}

/**
 * Full pattern including content files
 */
export interface Pattern extends PatternMetadata {
  group_id: string;
  description?: string; // From description.md (optional)
  prompt: string; // From prompt.md
}

/**
 * Query filters for loading patterns
 */
export interface PatternQuery {
  scope?: PatternGroupScope;
  workspace_id?: string;
  group_id?: string;
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a new pattern group ID in the format: grp_xxxxx
 * Uses nanoid for unique identifiers similar to agent IDs
 */
export function generateGroupId(): string {
  return `grp_${nanoid(18)}`;
}

/**
 * Generate a new pattern ID in the format: pat_xxxxx
 * Uses nanoid for unique identifiers similar to agent IDs
 */
export function generatePatternId(): string {
  return `pat_${nanoid(18)}`;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates pattern group metadata structure
 */
function isValidPatternGroup(data: unknown): data is PatternGroup {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (typeof obj.id !== "string" || obj.id.trim() === "") return false;
  if (typeof obj.title !== "string" || obj.title.trim() === "") return false;
  if (typeof obj.description !== "string") return false;
  if (obj.scope !== "user" && obj.scope !== "workspace" && obj.scope !== "birdhouse") return false;
  if (typeof obj.created_at !== "string" || !isValidISO8601(obj.created_at)) return false;
  if (typeof obj.updated_at !== "string" || !isValidISO8601(obj.updated_at)) return false;

  // workspace_id must be string for workspace scope, null otherwise
  if (obj.scope === "workspace") {
    if (typeof obj.workspace_id !== "string" || obj.workspace_id.trim() === "") return false;
  } else {
    if (obj.workspace_id !== null) return false;
  }

  return true;
}

/**
 * Validates pattern metadata structure
 */
function isValidPatternMetadata(data: unknown): data is PatternMetadata {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (typeof obj.id !== "string" || obj.id.trim() === "") return false;
  if (typeof obj.title !== "string" || obj.title.trim() === "") return false;
  if (!Array.isArray(obj.trigger_phrases)) return false;

  // Check optional timestamp fields if present
  if (obj.created_at !== undefined && (typeof obj.created_at !== "string" || !isValidISO8601(obj.created_at)))
    return false;
  if (obj.updated_at !== undefined && (typeof obj.updated_at !== "string" || !isValidISO8601(obj.updated_at)))
    return false;

  return true;
}

/**
 * Basic ISO 8601 timestamp validation
 * Accepts both with and without milliseconds
 */
function isValidISO8601(dateString: string): boolean {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;

  const isoWithMs = date.toISOString();
  const isoWithoutMs = isoWithMs.replace(".000Z", "Z");

  return dateString === isoWithMs || dateString === isoWithoutMs;
}

// ============================================================================
// Pattern Group Persistence
// ============================================================================

export class PatternGroupsPersistence {
  constructor(private basePath: string) {
    // basePath = ~/Library/Application Support/Birdhouse/patterns
  }

  // ==================== Path Helpers ====================

  /**
   * Get the directory path for a pattern group
   */
  private getGroupPath(groupId: string, scope: PatternGroupScope, workspaceId?: string): string {
    if (scope === "user") {
      return join(this.basePath, "user", groupId);
    } else if (scope === "workspace") {
      if (!workspaceId) throw new Error("workspace_id required for workspace scope");
      return join(this.basePath, "workspace", workspaceId, groupId);
    } else {
      return join(this.basePath, "birdhouse", groupId);
    }
  }

  /**
   * Get the directory path for a pattern
   */
  private getPatternPath(patternId: string, groupId: string, scope: PatternGroupScope, workspaceId?: string): string {
    const groupPath = this.getGroupPath(groupId, scope, workspaceId);
    return join(groupPath, "patterns", patternId);
  }

  /**
   * Get the path to the embedded pattern-bundles directory
   * Handles both dev mode and compiled binary contexts
   */
  private getEmbeddedPatternsPath(): string {
    const isCompiledBinary = import.meta.dir.startsWith("/$bunfs");

    if (isCompiledBinary) {
      // In compiled binary, pattern-bundles are at sibling path to the binary
      // Binary: cli-dist/dist/server
      // Bundles: cli-dist/dist/pattern-bundles
      return join(dirname(process.execPath), "pattern-bundles");
    }

    // Dev mode: navigate from server/src/lib → pattern-bundles
    return join(import.meta.dir, "..", "..", "..", "pattern-bundles");
  }

  // ==================== Group Operations ====================

  /**
   * Get a single pattern group by ID
   */
  async getGroup(groupId: string, scope: PatternGroupScope, workspaceId?: string): Promise<PatternGroup | null> {
    const groupPath = this.getGroupPath(groupId, scope, workspaceId);
    const groupYmlPath = join(groupPath, "group.yml");

    if (!existsSync(groupYmlPath)) return null;

    try {
      const content = readFileSync(groupYmlPath, "utf-8");
      const data = yaml.load(content);

      if (!isValidPatternGroup(data)) {
        log.server.warn({ groupId, scope, path: groupYmlPath }, "Invalid group metadata");
        return null;
      }

      return data;
    } catch (error) {
      log.server.error({ groupId, scope, error }, "Error loading group");
      return null;
    }
  }

  /**
   * Get all pattern groups matching the query
   */
  async getAllGroups(query?: PatternQuery): Promise<PatternGroup[]> {
    const groups: PatternGroup[] = [];

    // Determine which scopes to search
    const scopes: PatternGroupScope[] = query?.scope ? [query.scope] : ["user", "workspace", "birdhouse"];

    for (const scope of scopes) {
      if (scope === "user") {
        const userPath = join(this.basePath, "user");
        if (existsSync(userPath)) {
          const groupDirs = readdirSync(userPath, { withFileTypes: true }).filter((d) => d.isDirectory());
          for (const dir of groupDirs) {
            const group = await this.getGroup(dir.name, "user");
            if (group) groups.push(group);
          }
        }
      } else if (scope === "workspace") {
        const workspacePath = join(this.basePath, "workspace");
        if (existsSync(workspacePath)) {
          const workspaceDirs = readdirSync(workspacePath, { withFileTypes: true }).filter((d) => d.isDirectory());
          for (const workspaceDir of workspaceDirs) {
            // If query specifies workspace_id, skip others
            if (query?.workspace_id && workspaceDir.name !== query.workspace_id) continue;

            const groupDirs = readdirSync(join(workspacePath, workspaceDir.name), { withFileTypes: true }).filter((d) =>
              d.isDirectory(),
            );
            for (const groupDir of groupDirs) {
              const group = await this.getGroup(groupDir.name, "workspace", workspaceDir.name);
              if (group) groups.push(group);
            }
          }
        }
      } else if (scope === "birdhouse") {
        const birdhousePath = join(this.basePath, "birdhouse");
        if (existsSync(birdhousePath)) {
          const groupDirs = readdirSync(birdhousePath, { withFileTypes: true }).filter((d) => d.isDirectory());
          for (const dir of groupDirs) {
            const group = await this.getGroup(dir.name, "birdhouse");
            if (group) groups.push(group);
          }
        }
      }
    }

    return groups;
  }

  /**
   * Create a new pattern group
   */
  async createGroup(group: Omit<PatternGroup, "created_at" | "updated_at">): Promise<PatternGroup> {
    const now = new Date().toISOString().replace(".000Z", "Z");
    const fullGroup: PatternGroup = {
      ...group,
      created_at: now,
      updated_at: now,
    };

    const groupPath = this.getGroupPath(group.id, group.scope, group.workspace_id || undefined);
    const groupYmlPath = join(groupPath, "group.yml");

    // Create directory structure
    mkdirSync(groupPath, { recursive: true });
    mkdirSync(join(groupPath, "patterns"), { recursive: true });

    // Write group.yml
    const yamlContent = yaml.dump(fullGroup, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
      sortKeys: false,
    });

    writeFileSync(groupYmlPath, yamlContent, "utf-8");

    log.server.info({ groupId: group.id, scope: group.scope }, "Pattern group created");

    return fullGroup;
  }

  /**
   * Update a pattern group
   */
  async updateGroup(
    groupId: string,
    scope: PatternGroupScope,
    workspaceId: string | undefined,
    updates: Partial<Omit<PatternGroup, "id" | "scope" | "workspace_id" | "created_at">>,
  ): Promise<PatternGroup | null> {
    const existing = await this.getGroup(groupId, scope, workspaceId);
    if (!existing) return null;

    const updated: PatternGroup = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString().replace(".000Z", "Z"),
    };

    const groupPath = this.getGroupPath(groupId, scope, workspaceId);
    const groupYmlPath = join(groupPath, "group.yml");

    this.safeWriteYaml(groupYmlPath, updated);

    log.server.info({ groupId, scope, updates }, "Pattern group updated");

    return updated;
  }

  // ==================== Pattern Operations ====================

  /**
   * Get pattern metadata (lightweight, no content files)
   */
  async getPatternMetadata(
    patternId: string,
    groupId: string,
    scope: PatternGroupScope,
    workspaceId?: string,
  ): Promise<PatternMetadata | null> {
    const patternPath = this.getPatternPath(patternId, groupId, scope, workspaceId);
    const metadataPath = join(patternPath, "metadata.yml");

    if (!existsSync(metadataPath)) return null;

    try {
      const content = readFileSync(metadataPath, "utf-8");
      const data = yaml.load(content);

      if (!isValidPatternMetadata(data)) {
        log.server.warn({ patternId, groupId, scope, path: metadataPath }, "Invalid pattern metadata");
        return null;
      }

      return data;
    } catch (error) {
      log.server.error({ patternId, groupId, scope, error }, "Error loading pattern metadata");
      return null;
    }
  }

  /**
   * Get all patterns in a group (metadata with descriptions, no prompts)
   */
  async getGroupPatterns(groupId: string, scope: PatternGroupScope, workspaceId?: string): Promise<PatternMetadata[]> {
    const groupPath = this.getGroupPath(groupId, scope, workspaceId);
    const patternsPath = join(groupPath, "patterns");

    if (!existsSync(patternsPath)) return [];

    const patterns: PatternMetadata[] = [];
    const patternDirs = readdirSync(patternsPath, { withFileTypes: true }).filter((d) => d.isDirectory());

    for (const dir of patternDirs) {
      const metadata = await this.getPatternMetadata(dir.name, groupId, scope, workspaceId);
      if (metadata) {
        // Load description if it exists
        const patternPath = this.getPatternPath(dir.name, groupId, scope, workspaceId);
        const descriptionPath = join(patternPath, "description.md");

        let description: string | undefined;
        if (existsSync(descriptionPath)) {
          try {
            description = readFileSync(descriptionPath, "utf-8");
          } catch (error) {
            log.server.error({ patternId: dir.name, error }, "Error reading description.md");
          }
        }

        patterns.push({
          ...metadata,
          description,
        });
      }
    }

    return patterns;
  }

  /**
   * Get all patterns matching the query (metadata only)
   */
  async getAllPatterns(query?: PatternQuery): Promise<PatternMetadata[]> {
    const groups = await this.getAllGroups(query);
    const patterns: PatternMetadata[] = [];

    for (const group of groups) {
      if (query?.group_id && group.id !== query.group_id) continue;

      const groupPatterns = await this.getGroupPatterns(group.id, group.scope, group.workspace_id || undefined);
      patterns.push(...groupPatterns);
    }

    return patterns;
  }

  /**
   * Get full pattern with content files
   */
  async getPattern(
    patternId: string,
    groupId: string,
    scope: PatternGroupScope,
    workspaceId?: string,
  ): Promise<Pattern | null> {
    const metadata = await this.getPatternMetadata(patternId, groupId, scope, workspaceId);
    if (!metadata) return null;

    const patternPath = this.getPatternPath(patternId, groupId, scope, workspaceId);
    const promptPath = join(patternPath, "prompt.md");
    const descriptionPath = join(patternPath, "description.md");

    let prompt = "";
    let description: string | undefined;

    // Read prompt.md (required)
    if (existsSync(promptPath)) {
      try {
        prompt = readFileSync(promptPath, "utf-8");
      } catch (error) {
        log.server.error({ patternId, error }, "Error reading prompt.md");
      }
    }

    // Read description.md (optional)
    if (existsSync(descriptionPath)) {
      try {
        description = readFileSync(descriptionPath, "utf-8");
      } catch (error) {
        log.server.error({ patternId, error }, "Error reading description.md");
      }
    }

    return {
      ...metadata,
      group_id: groupId,
      description,
      prompt,
    };
  }

  /**
   * Create a new pattern
   * @param patternIdOverride Optional ID to use (for seeding Birdhouse patterns with stable IDs)
   */
  async createPattern(
    groupId: string,
    scope: PatternGroupScope,
    workspaceId: string | undefined,
    pattern: Omit<PatternMetadata, "id" | "created_at" | "updated_at">,
    prompt: string,
    description?: string,
    patternIdOverride?: string,
  ): Promise<Pattern> {
    const patternId = patternIdOverride || generatePatternId();
    const now = new Date().toISOString().replace(".000Z", "Z");

    const metadata: PatternMetadata = {
      id: patternId,
      ...pattern,
      created_at: now,
      updated_at: now,
    };

    const patternPath = this.getPatternPath(patternId, groupId, scope, workspaceId);

    // Create directory
    mkdirSync(patternPath, { recursive: true });

    // Write metadata.yml
    const metadataPath = join(patternPath, "metadata.yml");
    this.safeWriteYaml(metadataPath, metadata);

    // Write prompt.md
    const promptPath = join(patternPath, "prompt.md");
    writeFileSync(promptPath, prompt, "utf-8");

    // Write description.md if provided
    if (description) {
      const descriptionPath = join(patternPath, "description.md");
      writeFileSync(descriptionPath, description, "utf-8");
    }

    log.server.info({ patternId, groupId, scope }, "Pattern created");

    return {
      ...metadata,
      group_id: groupId,
      description,
      prompt,
    };
  }

  /**
   * Update pattern metadata and/or content
   */
  async updatePattern(
    patternId: string,
    groupId: string,
    scope: PatternGroupScope,
    workspaceId: string | undefined,
    updates: Partial<Omit<PatternMetadata, "id" | "created_at">>,
    prompt?: string,
    description?: string,
  ): Promise<Pattern | null> {
    const existing = await this.getPatternMetadata(patternId, groupId, scope, workspaceId);
    if (!existing) return null;

    const updatedMetadata: PatternMetadata = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString().replace(".000Z", "Z"),
    };

    const patternPath = this.getPatternPath(patternId, groupId, scope, workspaceId);
    const metadataPath = join(patternPath, "metadata.yml");

    // Update metadata.yml
    this.safeWriteYaml(metadataPath, updatedMetadata);

    // Update prompt.md if provided
    if (prompt !== undefined) {
      const promptPath = join(patternPath, "prompt.md");
      writeFileSync(promptPath, prompt, "utf-8");
    }

    // Update description.md if provided
    if (description !== undefined) {
      const descriptionPath = join(patternPath, "description.md");
      if (description === "") {
        // Remove description.md if empty string provided
        if (existsSync(descriptionPath)) {
          unlinkSync(descriptionPath);
        }
      } else {
        writeFileSync(descriptionPath, description, "utf-8");
      }
    }

    log.server.info({ patternId, groupId, scope, updates }, "Pattern updated");

    return await this.getPattern(patternId, groupId, scope, workspaceId);
  }

  /**
   * Update trigger phrases for a pattern (convenience method)
   */
  async updateTriggerPhrases(
    patternId: string,
    groupId: string,
    scope: PatternGroupScope,
    workspaceId: string | undefined,
    triggerPhrases: string[],
  ): Promise<Pattern | null> {
    return await this.updatePattern(patternId, groupId, scope, workspaceId, { trigger_phrases: triggerPhrases });
  }

  /**
   * Delete a pattern by removing its directory
   * @returns true if deleted, false if not found
   */
  async deletePattern(
    patternId: string,
    groupId: string,
    scope: PatternGroupScope,
    workspaceId: string | undefined,
  ): Promise<boolean> {
    const patternPath = this.getPatternPath(patternId, groupId, scope, workspaceId);

    if (!existsSync(patternPath)) return false;

    rmSync(patternPath, { recursive: true, force: true });
    log.server.info({ patternId, groupId, scope }, "Pattern deleted");
    return true;
  }

  /**
   * Get the filesystem path to a group's patterns directory
   * Used for "reveal in finder" functionality
   */
  getGroupPatternsPath(groupId: string, scope: PatternGroupScope, workspaceId?: string): string {
    const groupPath = this.getGroupPath(groupId, scope, workspaceId);
    return join(groupPath, "patterns");
  }

  // ==================== Pattern Lookup Operations ====================

  /**
   * Find a Birdhouse pattern by its stable ID
   * Searches across all birdhouse-scoped groups
   *
   * @param patternId - Stable pattern ID (e.g., "title_generation_default")
   * @returns Full pattern with prompt, or null if not found
   *
   * @example
   * const pattern = await persistence.findBirdhousePatternById('title_generation_default');
   * if (pattern) {
   *   console.log(pattern.prompt); // Use for LLM generation
   * }
   */
  async findBirdhousePatternById(patternId: string): Promise<Pattern | null> {
    const groups = await this.getAllGroups({ scope: "birdhouse" });

    for (const group of groups) {
      const pattern = await this.getPattern(patternId, group.id, "birdhouse");
      if (pattern) {
        return pattern;
      }
    }

    return null;
  }

  /**
   * Find pattern by ID across all groups for a workspace
   * Searches in priority order: user scope → workspace scope → birdhouse scope
   * This allows user patterns to "shadow" birdhouse patterns with the same ID
   *
   * @param patternId - Pattern ID to search for
   * @param workspaceId - Workspace context for searching workspace-scoped patterns
   * @returns Full pattern with prompt, or null if not found
   *
   * @example
   * const pattern = await persistence.findPatternById('pat_abc123', 'ws_xyz');
   * if (pattern) {
   *   console.log(pattern.group_id); // Which group contains this pattern
   * }
   */
  async findPatternById(patternId: string, workspaceId: string): Promise<Pattern | null> {
    // Search user scope first (highest priority)
    const userGroups = await this.getAllGroups({ scope: "user" });
    for (const group of userGroups) {
      const pattern = await this.getPattern(patternId, group.id, "user");
      if (pattern) {
        return pattern;
      }
    }

    // Search workspace scope second
    const workspaceGroups = await this.getAllGroups({ scope: "workspace", workspace_id: workspaceId });
    for (const group of workspaceGroups) {
      const pattern = await this.getPattern(patternId, group.id, "workspace", workspaceId);
      if (pattern) {
        return pattern;
      }
    }

    // Search birdhouse scope last (lowest priority)
    const birdhouseGroups = await this.getAllGroups({ scope: "birdhouse" });
    for (const group of birdhouseGroups) {
      const pattern = await this.getPattern(patternId, group.id, "birdhouse");
      if (pattern) {
        return pattern;
      }
    }

    return null;
  }

  // ==================== Seeding Operations ====================

  /**
   * Seed Birdhouse patterns from embedded source
   * - Creates groups that don't exist
   * - Creates patterns that don't exist
   * - Updates prompt.md and description.md for existing patterns
   * - PRESERVES user-edited trigger_phrases
   */
  async seedBirdhousePatterns(): Promise<{ seeded: number; updated: number }> {
    const embeddedPath = this.getEmbeddedPatternsPath();

    if (!existsSync(embeddedPath)) {
      log.server.warn({ embeddedPath }, "Embedded patterns directory not found, skipping seed");
      return { seeded: 0, updated: 0 };
    }

    let seeded = 0;
    let updated = 0;

    // Get all directories in pattern-bundles (these are groups)
    const groupDirs = readdirSync(embeddedPath, { withFileTypes: true }).filter((d) => d.isDirectory());

    for (const groupDir of groupDirs) {
      const groupId = groupDir.name; // e.g., "birdhouse-core"
      const embeddedGroupPath = join(embeddedPath, groupId);
      const embeddedGroupYmlPath = join(embeddedGroupPath, "bundle.yml"); // OLD name in source

      // Check if this is a valid bundle/group
      if (!existsSync(embeddedGroupYmlPath)) {
        log.server.warn({ groupId }, "No bundle.yml found in embedded group, skipping");
        continue;
      }

      // Load embedded group metadata
      const embeddedGroupYml = yaml.load(readFileSync(embeddedGroupYmlPath, "utf-8")) as Record<string, unknown>;

      // Check if group exists in App Support
      const existingGroup = await this.getGroup(groupId, "birdhouse");

      if (!existingGroup) {
        // Seed new group
        await this.createGroup({
          id: groupId,
          title: (embeddedGroupYml.name as string) || groupId,
          description: (embeddedGroupYml.description as string) || "",
          scope: "birdhouse",
          workspace_id: null,
        });

        log.server.info({ groupId }, "Seeded new Birdhouse group");
        seeded++;
      }

      // Seed patterns for this group
      const embeddedPatternsPath = embeddedGroupPath; // Patterns are siblings to bundle.yml in old structure
      const patternDirs = readdirSync(embeddedPatternsPath, { withFileTypes: true }).filter((d) => d.isDirectory());

      for (const patternDir of patternDirs) {
        const patternId = patternDir.name;
        const embeddedPatternPath = join(embeddedPatternsPath, patternId);
        const embeddedMetadataPath = join(embeddedPatternPath, "metadata.yml");

        // Skip if no metadata.yml
        if (!existsSync(embeddedMetadataPath)) continue;

        const embeddedMetadata = yaml.load(readFileSync(embeddedMetadataPath, "utf-8")) as Record<string, unknown>;

        // Check if pattern exists
        const existingPattern = await this.getPatternMetadata(patternId, groupId, "birdhouse");

        if (!existingPattern) {
          // Seed new pattern
          const promptPath = join(embeddedPatternPath, "prompt.md");
          const descriptionPath = join(embeddedPatternPath, "description.md");
          const readmePath = join(embeddedPatternPath, "README.md");

          const prompt = existsSync(promptPath) ? readFileSync(promptPath, "utf-8") : "";
          // Use description.md if it exists, otherwise fall back to README.md for backwards compatibility
          const description = existsSync(descriptionPath)
            ? readFileSync(descriptionPath, "utf-8")
            : existsSync(readmePath)
              ? readFileSync(readmePath, "utf-8")
              : undefined;

          await this.createPattern(
            groupId,
            "birdhouse",
            undefined,
            {
              title: (embeddedMetadata.title as string) || patternId,
              trigger_phrases: (embeddedMetadata.trigger_phrases as string[]) || [],
            },
            prompt,
            description,
            patternId, // Use directory name as stable pattern ID
          );

          log.server.info({ patternId, groupId }, "Seeded new Birdhouse pattern");
          seeded++;
        } else {
          // Pattern exists - update prompt and description, PRESERVE trigger_phrases
          const promptPath = join(embeddedPatternPath, "prompt.md");
          const descriptionPath = join(embeddedPatternPath, "description.md");
          const readmePath = join(embeddedPatternPath, "README.md");

          const embeddedPrompt = existsSync(promptPath) ? readFileSync(promptPath, "utf-8") : "";
          const embeddedDescription = existsSync(descriptionPath)
            ? readFileSync(descriptionPath, "utf-8")
            : existsSync(readmePath)
              ? readFileSync(readmePath, "utf-8")
              : undefined;

          // Read existing prompt and description
          const existingFull = await this.getPattern(patternId, groupId, "birdhouse");
          const promptChanged = existingFull && existingFull.prompt !== embeddedPrompt;
          const descriptionChanged = existingFull && existingFull.description !== embeddedDescription;

          if (promptChanged || descriptionChanged) {
            // Update content but preserve trigger_phrases
            await this.updatePattern(
              patternId,
              groupId,
              "birdhouse",
              undefined,
              {}, // No metadata updates - preserve everything
              promptChanged ? embeddedPrompt : undefined,
              descriptionChanged ? embeddedDescription : undefined,
            );

            log.server.info(
              { patternId, groupId, promptChanged, descriptionChanged },
              "Updated Birdhouse pattern content",
            );
            updated++;
          }
        }
      }
    }

    return { seeded, updated };
  }

  /**
   * Ensure default user group exists
   */
  async ensureUserDefaultGroup(): Promise<void> {
    const defaultGroup = await this.getGroup("default", "user");

    if (!defaultGroup) {
      await this.createGroup({
        id: "default",
        title: "Default Patterns",
        description: "Your default patterns",
        scope: "user",
        workspace_id: null,
      });

      log.server.info("Created user default group");
    }
  }

  /**
   * Ensure default workspace group exists for a workspace
   */
  async ensureWorkspaceDefaultGroup(workspace: {
    workspace_id: string;
    title?: string | null;
    directory: string;
  }): Promise<void> {
    const defaultGroup = await this.getGroup("default", "workspace", workspace.workspace_id);

    if (!defaultGroup) {
      const workspaceTitle = workspace.title || basename(workspace.directory);
      await this.createGroup({
        id: "default",
        title: `${workspaceTitle} Patterns`,
        description: `Patterns specific to the ${workspaceTitle} workspace`,
        scope: "workspace",
        workspace_id: workspace.workspace_id,
      });

      log.server.info(
        { workspaceId: workspace.workspace_id, title: workspaceTitle },
        "Created workspace default group",
      );
    }
  }

  /**
   * Ensure default groups for all existing workspaces
   */
  async ensureAllWorkspaceDefaultGroups(
    workspaces: Array<{ workspace_id: string; title?: string | null; directory: string }>,
  ): Promise<void> {
    for (const workspace of workspaces) {
      await this.ensureWorkspaceDefaultGroup(workspace);
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Safely write YAML to disk using atomic write pattern
   */
  private safeWriteYaml(path: string, data: unknown): void {
    const tempPath = `${path}.tmp`;

    try {
      // Get original file permissions if file exists
      let originalMode: number | undefined;
      if (existsSync(path)) {
        const originalStats = statSync(path);
        originalMode = originalStats.mode;
      }

      // Serialize to YAML
      const yamlContent = yaml.dump(data, {
        indent: 2,
        lineWidth: 100,
        noRefs: true,
        sortKeys: false,
      });

      // Write to temp file
      writeFileSync(tempPath, yamlContent, "utf-8");

      // Restore permissions if we had them
      if (originalMode !== undefined) {
        writeFileSync(tempPath, yamlContent, { mode: originalMode });
      }

      // Atomic rename
      renameSync(tempPath, path);
    } catch (error) {
      // Clean up temp file if it exists
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let patternGroupsPersistence: PatternGroupsPersistence | null = null;

/**
 * Initialize pattern groups persistence with base path
 */
export function initPatternGroupsPersistence(basePath: string): PatternGroupsPersistence {
  patternGroupsPersistence = new PatternGroupsPersistence(basePath);
  return patternGroupsPersistence;
}

/**
 * Get singleton instance of pattern groups persistence
 */
export function getPatternGroupsPersistence(): PatternGroupsPersistence {
  if (!patternGroupsPersistence) {
    throw new Error("Pattern groups persistence not initialized. Call initPatternGroupsPersistence() first");
  }
  return patternGroupsPersistence;
}
