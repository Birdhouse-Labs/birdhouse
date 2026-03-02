// ABOUTME: Unit tests for pattern groups persistence layer
// ABOUTME: Tests group and pattern CRUD operations, seeding, and validation

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { generateGroupId, generatePatternId, PatternGroupsPersistence } from "./pattern-groups-db";

// Test fixtures path
const FIXTURES_PATH = join(import.meta.dir, "__fixtures__", "pattern-groups");
const EMBEDDED_PATH = join(FIXTURES_PATH, "embedded");

describe("pattern-groups-db", () => {
  let persistence: PatternGroupsPersistence;

  beforeEach(() => {
    // Clean up fixtures
    if (existsSync(FIXTURES_PATH)) {
      rmSync(FIXTURES_PATH, { recursive: true });
    }

    // Create fresh fixtures
    mkdirSync(FIXTURES_PATH, { recursive: true });
    mkdirSync(EMBEDDED_PATH, { recursive: true });

    // Initialize persistence
    persistence = new PatternGroupsPersistence(FIXTURES_PATH);
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(FIXTURES_PATH)) {
      rmSync(FIXTURES_PATH, { recursive: true });
    }
  });

  // ==================== ID Generation ====================

  describe("ID generation", () => {
    test("generateGroupId creates valid format", () => {
      const id = generateGroupId();
      expect(id).toMatch(/^grp_[a-zA-Z0-9_-]{18}$/);
    });

    test("generatePatternId creates valid format", () => {
      const id = generatePatternId();
      expect(id).toMatch(/^pat_[a-zA-Z0-9_-]{18}$/);
    });

    test("IDs are unique", () => {
      const id1 = generateGroupId();
      const id2 = generateGroupId();
      expect(id1).not.toBe(id2);
    });
  });

  // ==================== Group Operations ====================

  describe("createGroup", () => {
    test("creates user-scoped group", async () => {
      const group = await persistence.createGroup({
        id: "default",
        title: "Default Patterns",
        description: "User default patterns",
        scope: "user",
        workspace_id: null,
      });

      expect(group.id).toBe("default");
      expect(group.title).toBe("Default Patterns");
      expect(group.scope).toBe("user");
      expect(group.workspace_id).toBeNull();
      expect(group.created_at).toBeDefined();
      expect(group.updated_at).toBeDefined();

      // Verify file structure
      const groupPath = join(FIXTURES_PATH, "user", "default");
      expect(existsSync(groupPath)).toBe(true);
      expect(existsSync(join(groupPath, "group.yml"))).toBe(true);
      expect(existsSync(join(groupPath, "patterns"))).toBe(true);
    });

    test("creates workspace-scoped group", async () => {
      const workspaceId = "ws_test123";
      const group = await persistence.createGroup({
        id: "default",
        title: "Workspace Patterns",
        description: "Workspace default patterns",
        scope: "workspace",
        workspace_id: workspaceId,
      });

      expect(group.scope).toBe("workspace");
      expect(group.workspace_id).toBe(workspaceId);

      // Verify file structure
      const groupPath = join(FIXTURES_PATH, "workspace", workspaceId, "default");
      expect(existsSync(groupPath)).toBe(true);
    });

    test("creates birdhouse-scoped group", async () => {
      const group = await persistence.createGroup({
        id: "birdhouse-core",
        title: "Birdhouse Core",
        description: "Core patterns",
        scope: "birdhouse",
        workspace_id: null,
      });

      expect(group.scope).toBe("birdhouse");

      // Verify file structure
      const groupPath = join(FIXTURES_PATH, "birdhouse", "birdhouse-core");
      expect(existsSync(groupPath)).toBe(true);
    });
  });

  describe("getGroup", () => {
    test("loads existing group", async () => {
      await persistence.createGroup({
        id: "test-group",
        title: "Test Group",
        description: "Test description",
        scope: "user",
        workspace_id: null,
      });

      const loaded = await persistence.getGroup("test-group", "user");

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe("test-group");
      expect(loaded?.title).toBe("Test Group");
    });

    test("returns null for non-existent group", async () => {
      const loaded = await persistence.getGroup("nonexistent", "user");
      expect(loaded).toBeNull();
    });

    test("returns null for invalid group.yml", async () => {
      const groupPath = join(FIXTURES_PATH, "user", "invalid");
      mkdirSync(groupPath, { recursive: true });

      // Write invalid YAML
      writeFileSync(join(groupPath, "group.yml"), "invalid: yaml: structure:", "utf-8");

      const loaded = await persistence.getGroup("invalid", "user");
      expect(loaded).toBeNull();
    });
  });

  describe("getAllGroups", () => {
    beforeEach(async () => {
      // Create test groups
      await persistence.createGroup({
        id: "user-group-1",
        title: "User Group 1",
        description: "First user group",
        scope: "user",
        workspace_id: null,
      });

      await persistence.createGroup({
        id: "user-group-2",
        title: "User Group 2",
        description: "Second user group",
        scope: "user",
        workspace_id: null,
      });

      await persistence.createGroup({
        id: "ws-group-1",
        title: "Workspace Group 1",
        description: "First workspace group",
        scope: "workspace",
        workspace_id: "ws_test123",
      });

      await persistence.createGroup({
        id: "bh-group-1",
        title: "Birdhouse Group 1",
        description: "First birdhouse group",
        scope: "birdhouse",
        workspace_id: null,
      });
    });

    test("loads all groups without filter", async () => {
      const groups = await persistence.getAllGroups();
      expect(groups.length).toBe(4);
    });

    test("filters by scope", async () => {
      const userGroups = await persistence.getAllGroups({ scope: "user" });
      expect(userGroups.length).toBe(2);
      expect(userGroups.every((g) => g.scope === "user")).toBe(true);

      const workspaceGroups = await persistence.getAllGroups({ scope: "workspace" });
      expect(workspaceGroups.length).toBe(1);
      expect(workspaceGroups[0].scope).toBe("workspace");
    });

    test("filters by workspace_id", async () => {
      const groups = await persistence.getAllGroups({
        scope: "workspace",
        workspace_id: "ws_test123",
      });

      expect(groups.length).toBe(1);
      expect(groups[0].workspace_id).toBe("ws_test123");
    });
  });

  describe("updateGroup", () => {
    test("updates group metadata", async () => {
      const created = await persistence.createGroup({
        id: "test-group",
        title: "Original Title",
        description: "Original description",
        scope: "user",
        workspace_id: null,
      });

      // Small delay to ensure updated_at is different
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await persistence.updateGroup("test-group", "user", undefined, {
        title: "Updated Title",
        description: "Updated description",
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe("Updated Title");
      expect(updated?.description).toBe("Updated description");
      expect(updated?.updated_at).not.toBe(created.created_at);
    });

    test("returns null for non-existent group", async () => {
      const updated = await persistence.updateGroup("nonexistent", "user", undefined, {
        title: "New Title",
      });

      expect(updated).toBeNull();
    });
  });

  // ==================== Pattern Operations ====================

  describe("createPattern", () => {
    beforeEach(async () => {
      // Create a group to hold patterns
      await persistence.createGroup({
        id: "test-group",
        title: "Test Group",
        description: "Test group for patterns",
        scope: "user",
        workspace_id: null,
      });
    });

    test("creates pattern with all fields", async () => {
      const pattern = await persistence.createPattern(
        "test-group",
        "user",
        undefined,
        {
          title: "Test Pattern",
          trigger_phrases: ["test pattern", "pattern test"],
        },
        "# Test Pattern\n\nThis is the prompt content.",
        "This is the description.",
      );

      expect(pattern.id).toMatch(/^pat_/);
      expect(pattern.title).toBe("Test Pattern");
      expect(pattern.trigger_phrases).toEqual(["test pattern", "pattern test"]);
      expect(pattern.prompt).toBe("# Test Pattern\n\nThis is the prompt content.");
      expect(pattern.description).toBe("This is the description.");
      expect(pattern.created_at).toBeDefined();
      expect(pattern.updated_at).toBeDefined();

      // Verify file structure
      const patternPath = join(FIXTURES_PATH, "user", "test-group", "patterns", pattern.id);
      expect(existsSync(join(patternPath, "metadata.yml"))).toBe(true);
      expect(existsSync(join(patternPath, "prompt.md"))).toBe(true);
      expect(existsSync(join(patternPath, "description.md"))).toBe(true);
    });

    test("creates pattern without description", async () => {
      const pattern = await persistence.createPattern(
        "test-group",
        "user",
        undefined,
        {
          title: "Test Pattern",
          trigger_phrases: [],
        },
        "Prompt content",
      );

      expect(pattern.description).toBeUndefined();

      // Verify description.md does not exist
      const patternPath = join(FIXTURES_PATH, "user", "test-group", "patterns", pattern.id);
      expect(existsSync(join(patternPath, "description.md"))).toBe(false);
    });
  });

  describe("getPatternMetadata", () => {
    let patternId: string;

    beforeEach(async () => {
      await persistence.createGroup({
        id: "test-group",
        title: "Test Group",
        description: "Test",
        scope: "user",
        workspace_id: null,
      });

      const pattern = await persistence.createPattern(
        "test-group",
        "user",
        undefined,
        {
          title: "Test Pattern",
          trigger_phrases: ["test"],
        },
        "Prompt",
      );

      patternId = pattern.id;
    });

    test("loads pattern metadata", async () => {
      const metadata = await persistence.getPatternMetadata(patternId, "test-group", "user");

      expect(metadata).not.toBeNull();
      expect(metadata?.id).toBe(patternId);
      expect(metadata?.title).toBe("Test Pattern");
      expect(metadata?.trigger_phrases).toEqual(["test"]);
    });

    test("returns null for non-existent pattern", async () => {
      const metadata = await persistence.getPatternMetadata("nonexistent", "test-group", "user");
      expect(metadata).toBeNull();
    });
  });

  describe("getPattern", () => {
    let patternId: string;

    beforeEach(async () => {
      await persistence.createGroup({
        id: "test-group",
        title: "Test Group",
        description: "Test",
        scope: "user",
        workspace_id: null,
      });

      const pattern = await persistence.createPattern(
        "test-group",
        "user",
        undefined,
        {
          title: "Test Pattern",
          trigger_phrases: ["test"],
        },
        "# Test Prompt",
        "Test description",
      );

      patternId = pattern.id;
    });

    test("loads full pattern with content", async () => {
      const pattern = await persistence.getPattern(patternId, "test-group", "user");

      expect(pattern).not.toBeNull();
      expect(pattern?.prompt).toBe("# Test Prompt");
      expect(pattern?.description).toBe("Test description");
      expect(pattern?.group_id).toBe("test-group");
    });
  });

  describe("getGroupPatterns", () => {
    beforeEach(async () => {
      await persistence.createGroup({
        id: "test-group",
        title: "Test Group",
        description: "Test",
        scope: "user",
        workspace_id: null,
      });

      await persistence.createPattern(
        "test-group",
        "user",
        undefined,
        { title: "Pattern 1", trigger_phrases: ["p1"] },
        "Prompt 1",
      );

      await persistence.createPattern(
        "test-group",
        "user",
        undefined,
        { title: "Pattern 2", trigger_phrases: ["p2"] },
        "Prompt 2",
      );
    });

    test("loads all patterns in group", async () => {
      const patterns = await persistence.getGroupPatterns("test-group", "user");

      expect(patterns.length).toBe(2);
      expect(patterns[0].title).toBeDefined();
      expect(patterns[1].title).toBeDefined();
    });

    test("returns empty array for group with no patterns", async () => {
      await persistence.createGroup({
        id: "empty-group",
        title: "Empty",
        description: "Empty",
        scope: "user",
        workspace_id: null,
      });

      const patterns = await persistence.getGroupPatterns("empty-group", "user");
      expect(patterns.length).toBe(0);
    });
  });

  describe("getAllPatterns", () => {
    beforeEach(async () => {
      // User group with patterns
      await persistence.createGroup({
        id: "user-group",
        title: "User Group",
        description: "Test",
        scope: "user",
        workspace_id: null,
      });

      await persistence.createPattern(
        "user-group",
        "user",
        undefined,
        { title: "User Pattern", trigger_phrases: [] },
        "Prompt",
      );

      // Workspace group with patterns
      await persistence.createGroup({
        id: "ws-group",
        title: "Workspace Group",
        description: "Test",
        scope: "workspace",
        workspace_id: "ws_test",
      });

      await persistence.createPattern(
        "ws-group",
        "workspace",
        "ws_test",
        { title: "Workspace Pattern", trigger_phrases: [] },
        "Prompt",
      );
    });

    test("loads all patterns without filter", async () => {
      const patterns = await persistence.getAllPatterns();
      expect(patterns.length).toBe(2);
    });

    test("filters by scope", async () => {
      const userPatterns = await persistence.getAllPatterns({ scope: "user" });
      expect(userPatterns.length).toBe(1);
      expect(userPatterns[0].title).toBe("User Pattern");
    });

    test("filters by group_id", async () => {
      const patterns = await persistence.getAllPatterns({ group_id: "user-group" });
      expect(patterns.length).toBe(1);
      expect(patterns[0].title).toBe("User Pattern");
    });
  });

  describe("updatePattern", () => {
    let patternId: string;

    beforeEach(async () => {
      await persistence.createGroup({
        id: "test-group",
        title: "Test Group",
        description: "Test",
        scope: "user",
        workspace_id: null,
      });

      const pattern = await persistence.createPattern(
        "test-group",
        "user",
        undefined,
        {
          title: "Original Title",
          trigger_phrases: ["original"],
        },
        "Original prompt",
        "Original description",
      );

      patternId = pattern.id;
    });

    test("updates metadata only", async () => {
      const updated = await persistence.updatePattern(patternId, "test-group", "user", undefined, {
        title: "Updated Title",
        trigger_phrases: ["updated"],
      });

      expect(updated).not.toBeNull();
      expect(updated?.title).toBe("Updated Title");
      expect(updated?.trigger_phrases).toEqual(["updated"]);
      expect(updated?.prompt).toBe("Original prompt");
      expect(updated?.description).toBe("Original description");
    });

    test("updates prompt content", async () => {
      const updated = await persistence.updatePattern(patternId, "test-group", "user", undefined, {}, "Updated prompt");

      expect(updated?.prompt).toBe("Updated prompt");
      expect(updated?.title).toBe("Original Title");
    });

    test("updates description content", async () => {
      const updated = await persistence.updatePattern(
        patternId,
        "test-group",
        "user",
        undefined,
        {},
        undefined,
        "Updated description",
      );

      expect(updated?.description).toBe("Updated description");
    });

    test("removes description when empty string provided", async () => {
      const updated = await persistence.updatePattern(patternId, "test-group", "user", undefined, {}, undefined, "");

      expect(updated?.description).toBeUndefined();

      // Verify file is deleted
      const patternPath = join(FIXTURES_PATH, "user", "test-group", "patterns", patternId);
      expect(existsSync(join(patternPath, "description.md"))).toBe(false);
    });
  });

  describe("updateTriggerPhrases", () => {
    let patternId: string;

    beforeEach(async () => {
      await persistence.createGroup({
        id: "test-group",
        title: "Test Group",
        description: "Test",
        scope: "user",
        workspace_id: null,
      });

      const pattern = await persistence.createPattern(
        "test-group",
        "user",
        undefined,
        {
          title: "Test Pattern",
          trigger_phrases: ["old"],
        },
        "Prompt",
      );

      patternId = pattern.id;
    });

    test("updates trigger phrases", async () => {
      const updated = await persistence.updateTriggerPhrases(patternId, "test-group", "user", undefined, [
        "new1",
        "new2",
      ]);

      expect(updated).not.toBeNull();
      expect(updated?.trigger_phrases).toEqual(["new1", "new2"]);
    });
  });

  // ==================== Seeding Operations ====================

  describe("seedBirdhousePatterns", () => {
    beforeEach(() => {
      // Create embedded pattern structure
      const coreGroupPath = join(EMBEDDED_PATH, "birdhouse-core");
      mkdirSync(coreGroupPath, { recursive: true });

      // Create bundle.yml
      const bundleMetadata = {
        id: "birdhouse-core",
        name: "Birdhouse Core",
        description: "Core patterns for Birdhouse",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        installable: true,
      };
      writeFileSync(join(coreGroupPath, "bundle.yml"), yaml.dump(bundleMetadata), "utf-8");

      // Create pattern
      const patternPath = join(coreGroupPath, "test-pattern");
      mkdirSync(patternPath, { recursive: true });

      const patternMetadata = {
        id: "test-pattern",
        title: "Test Pattern",
        trigger_phrases: ["test"],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      writeFileSync(join(patternPath, "metadata.yml"), yaml.dump(patternMetadata), "utf-8");
      writeFileSync(join(patternPath, "prompt.md"), "# Test Prompt", "utf-8");
      writeFileSync(join(patternPath, "description.md"), "Test description", "utf-8");
    });

    test("seeds new groups and patterns", async () => {
      // Override getEmbeddedPatternsPath for test
      const _originalPersistence = persistence;
      persistence = new PatternGroupsPersistence(FIXTURES_PATH);
      // @ts-expect-error - accessing private method for testing
      persistence.getEmbeddedPatternsPath = () => EMBEDDED_PATH;

      const result = await persistence.seedBirdhousePatterns();

      expect(result.seeded).toBeGreaterThan(0);

      // Verify group was created
      const group = await persistence.getGroup("birdhouse-core", "birdhouse");
      expect(group).not.toBeNull();
      expect(group?.title).toBe("Birdhouse Core");

      // Verify pattern was created
      const pattern = await persistence.getPattern("test-pattern", "birdhouse-core", "birdhouse");
      expect(pattern).not.toBeNull();
      expect(pattern?.title).toBe("Test Pattern");
    });

    test("preserves user-edited trigger phrases on re-seed", async () => {
      // @ts-expect-error - accessing private method for testing
      persistence.getEmbeddedPatternsPath = () => EMBEDDED_PATH;

      // First seed
      await persistence.seedBirdhousePatterns();

      // User edits trigger phrases
      await persistence.updateTriggerPhrases("test-pattern", "birdhouse-core", "birdhouse", undefined, [
        "custom trigger",
      ]);

      // Update embedded prompt
      const patternPath = join(EMBEDDED_PATH, "birdhouse-core", "test-pattern");
      writeFileSync(join(patternPath, "prompt.md"), "# Updated Prompt", "utf-8");

      // Re-seed
      const result = await persistence.seedBirdhousePatterns();

      expect(result.updated).toBeGreaterThan(0);

      // Verify trigger phrases were preserved but prompt was updated
      const pattern = await persistence.getPattern("test-pattern", "birdhouse-core", "birdhouse");
      expect(pattern?.trigger_phrases).toEqual(["custom trigger"]);
      expect(pattern?.prompt).toBe("# Updated Prompt");
    });
  });

  describe("ensureUserDefaultGroup", () => {
    test("creates default group if missing", async () => {
      await persistence.ensureUserDefaultGroup();

      const group = await persistence.getGroup("default", "user");
      expect(group).not.toBeNull();
      expect(group?.title).toBe("Default Patterns");
    });

    test("is idempotent - does not recreate if exists", async () => {
      await persistence.ensureUserDefaultGroup();
      const first = await persistence.getGroup("default", "user");

      await persistence.ensureUserDefaultGroup();
      const second = await persistence.getGroup("default", "user");

      expect(first?.created_at).toBe(second?.created_at);
    });
  });

  describe("ensureWorkspaceDefaultGroup", () => {
    test("creates workspace default group if missing", async () => {
      const workspace = {
        workspace_id: "ws_test123",
        title: "Test Workspace",
        directory: "/Users/test/workspace",
      };
      await persistence.ensureWorkspaceDefaultGroup(workspace);

      const group = await persistence.getGroup("default", "workspace", workspace.workspace_id);
      expect(group).not.toBeNull();
      expect(group?.title).toBe("Test Workspace Patterns");
      expect(group?.workspace_id).toBe(workspace.workspace_id);
    });

    test("is idempotent", async () => {
      const workspace = {
        workspace_id: "ws_test123",
        title: "Test Workspace",
        directory: "/Users/test/workspace",
      };
      await persistence.ensureWorkspaceDefaultGroup(workspace);
      const first = await persistence.getGroup("default", "workspace", workspace.workspace_id);

      await persistence.ensureWorkspaceDefaultGroup(workspace);
      const second = await persistence.getGroup("default", "workspace", workspace.workspace_id);

      expect(first?.created_at).toBe(second?.created_at);
    });

    test("falls back to directory basename when title is null", async () => {
      const workspace = {
        workspace_id: "ws_test456",
        title: null,
        directory: "/Users/test/my-cool-project",
      };
      await persistence.ensureWorkspaceDefaultGroup(workspace);

      const group = await persistence.getGroup("default", "workspace", workspace.workspace_id);
      expect(group).not.toBeNull();
      expect(group?.title).toBe("my-cool-project Patterns");
      expect(group?.description).toBe("Patterns specific to the my-cool-project workspace");
    });

    test("falls back to directory basename for path ending with slash", async () => {
      const workspace = {
        workspace_id: "ws_test789",
        title: null,
        directory: "/Users/test/another-project/",
      };
      await persistence.ensureWorkspaceDefaultGroup(workspace);

      const group = await persistence.getGroup("default", "workspace", workspace.workspace_id);
      expect(group).not.toBeNull();
      expect(group?.title).toBe("another-project Patterns");
    });
  });

  describe("ensureAllWorkspaceDefaultGroups", () => {
    test("creates groups for all workspaces", async () => {
      const workspaces = [
        { workspace_id: "ws_1", title: "Workspace 1", directory: "/Users/test/ws1" },
        { workspace_id: "ws_2", title: "Workspace 2", directory: "/Users/test/ws2" },
        { workspace_id: "ws_3", title: null, directory: "/Users/test/fallback-workspace" },
      ];
      await persistence.ensureAllWorkspaceDefaultGroups(workspaces);

      for (const workspace of workspaces) {
        const group = await persistence.getGroup("default", "workspace", workspace.workspace_id);
        expect(group).not.toBeNull();
      }
    });
  });
});
