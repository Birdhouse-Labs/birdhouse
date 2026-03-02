// ABOUTME: Integration tests for pattern groups API routes
// ABOUTME: Tests GET, POST, and PATCH endpoints for pattern groups and patterns

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DataDB } from "../lib/data-db";
import { runMigrations } from "../lib/migrations/run-migrations";
import type { PatternGroup, PatternGroupsPersistence, PatternMetadata } from "../lib/pattern-groups-db";
import { createPatternGroupRoutes } from "./pattern-groups";

const TEST_DB_PATH_BASE = join(import.meta.dir, "..", "lib", "__fixtures__", "test-pattern-groups-routes");

// ============================================================================
// Response Interfaces
// ============================================================================

interface ErrorResponse {
  error: string;
}

// biome-ignore lint/suspicious/noExplicitAny: Test helper needs flexible typing
interface SuccessResponse extends Record<string, any> {}

// ============================================================================
// Test Helpers
// ============================================================================

function createTestDb(dbPath: string): DataDB {
  return new DataDB(dbPath);
}

function setupTestData(testDb: DataDB) {
  testDb.setUserName("Test User");

  testDb.insertWorkspace({
    workspace_id: "workspace-1",
    directory: "/test/workspace-1",
    title: "Workspace One",
    opencode_port: null,
    opencode_pid: null,
    created_at: "2026-02-20T10:00:00Z",
    last_used: "2026-02-23T10:00:00Z",
  });

  testDb.insertWorkspace({
    workspace_id: "workspace-2",
    directory: "/test/workspace-2",
    title: "Workspace Two",
    opencode_port: null,
    opencode_pid: null,
    created_at: "2026-02-21T10:00:00Z",
    last_used: "2026-02-22T10:00:00Z",
  });
}

function cleanupTestData(testDb: DataDB) {
  const workspaces = testDb.getAllWorkspaces();
  for (const workspace of workspaces) {
    testDb.deleteWorkspace(workspace.workspace_id);
  }
  testDb.close();
}

// ============================================================================
// Mock Persistence Layer
// ============================================================================

interface MockPattern {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  prompt: string;
  trigger_phrases: string[];
  created_at: string;
  updated_at: string;
}

function createMockPersistence(): PatternGroupsPersistence {
  const mockGroups: PatternGroup[] = [
    {
      id: "default",
      title: "Default Patterns",
      description: "Your personal patterns",
      scope: "user",
      workspace_id: null,
      created_at: "2026-02-20T10:00:00Z",
      updated_at: "2026-02-20T10:00:00Z",
    },
    {
      id: "default",
      title: "Workspace Default Patterns",
      description: "Patterns for Workspace One",
      scope: "workspace",
      workspace_id: "workspace-1",
      created_at: "2026-02-20T10:00:00Z",
      updated_at: "2026-02-20T10:00:00Z",
    },
    {
      id: "default",
      title: "Workspace Default Patterns",
      description: "Patterns for Workspace Two",
      scope: "workspace",
      workspace_id: "workspace-2",
      created_at: "2026-02-20T10:00:00Z",
      updated_at: "2026-02-20T10:00:00Z",
    },
    {
      id: "birdhouse-core",
      title: "Birdhouse Core",
      description: "Essential development patterns",
      scope: "birdhouse",
      workspace_id: null,
      created_at: "2026-02-20T10:00:00Z",
      updated_at: "2026-02-20T10:00:00Z",
    },
    {
      id: "git-github",
      title: "Git & GitHub",
      description: "Version control patterns",
      scope: "birdhouse",
      workspace_id: null,
      created_at: "2026-02-20T10:00:00Z",
      updated_at: "2026-02-20T10:00:00Z",
    },
  ];

  const mockPatterns: MockPattern[] = [
    {
      id: "pat_user_1",
      group_id: "default",
      title: "User Pattern 1",
      description: "First user pattern",
      prompt: "User pattern prompt",
      trigger_phrases: ["user1"],
      created_at: "2026-02-20T10:00:00Z",
      updated_at: "2026-02-20T10:00:00Z",
    },
    {
      id: "pat_ws1_1",
      group_id: "default",
      title: "Workspace 1 Pattern",
      prompt: "Workspace 1 pattern prompt",
      trigger_phrases: ["ws1"],
      created_at: "2026-02-20T10:00:00Z",
      updated_at: "2026-02-20T10:00:00Z",
    },
    {
      id: "bh-core-1",
      group_id: "birdhouse-core",
      title: "Birdhouse Core Pattern",
      description: "Core pattern",
      prompt: "Birdhouse core prompt",
      trigger_phrases: ["core"],
      created_at: "2026-02-20T10:00:00Z",
      updated_at: "2026-02-20T10:00:00Z",
    },
  ];

  return {
    async getAllGroups(query?: { scope?: string; workspace_id?: string }) {
      let filtered = mockGroups;

      if (query?.scope) {
        filtered = filtered.filter((g) => g.scope === query.scope);
      }

      if (query?.workspace_id) {
        filtered = filtered.filter((g) => g.workspace_id === query.workspace_id);
      }

      return filtered;
    },

    async getGroup(groupId: string, scope: string, workspaceId?: string) {
      return (
        mockGroups.find((g) => g.id === groupId && g.scope === scope && g.workspace_id === (workspaceId || null)) ||
        null
      );
    },

    async getGroupPatterns(groupId: string, scope: string, workspaceId?: string) {
      // Find the specific group
      const group = mockGroups.find(
        (g) => g.id === groupId && g.scope === scope && g.workspace_id === (workspaceId || null),
      );

      if (!group) return [];

      // Filter patterns by matching group_id, scope, and workspace
      const patterns = mockPatterns.filter((p) => {
        // For user scope
        if (scope === "user" && p.group_id === groupId) {
          // Only return patterns that don't have workspace-specific info
          return p.id.startsWith("pat_user");
        }
        // For workspace scope
        if (scope === "workspace" && p.group_id === groupId) {
          // Match workspace patterns by ID prefix
          const wsPrefix = `pat_${workspaceId?.replace("workspace-", "ws")}`;
          return p.id.startsWith(wsPrefix);
        }
        // For birdhouse scope
        if (scope === "birdhouse" && p.group_id === groupId) {
          return p.id.startsWith("bh-");
        }
        return false;
      });

      return patterns.map(
        (p): PatternMetadata => ({
          id: p.id,
          title: p.title,
          description: p.description, // Include description in metadata
          trigger_phrases: p.trigger_phrases,
          created_at: p.created_at,
          updated_at: p.updated_at,
        }),
      );
    },

    async getPattern(patternId: string, groupId: string, scope: string, workspaceId?: string) {
      const pattern = mockPatterns.find((p) => {
        const group = mockGroups.find(
          (g) =>
            g.id === groupId && g.scope === scope && g.workspace_id === (workspaceId || null) && g.id === p.group_id,
        );
        return p.id === patternId && !!group;
      });

      return pattern || null;
    },

    async createPattern(
      groupId: string,
      _scope: string,
      _workspaceId: string | undefined,
      pattern: Omit<PatternMetadata, "id" | "created_at" | "updated_at">,
      prompt: string,
      description?: string,
    ) {
      const newPattern: MockPattern = {
        id: `pat_${Date.now()}`,
        group_id: groupId,
        title: pattern.title,
        description,
        prompt,
        trigger_phrases: pattern.trigger_phrases,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockPatterns.push(newPattern);
      return newPattern;
    },

    async updatePattern(
      patternId: string,
      groupId: string,
      _scope: string,
      _workspaceId: string | undefined,
      updates: Partial<PatternMetadata>,
      prompt?: string,
      description?: string,
    ) {
      const pattern = mockPatterns.find((p) => p.id === patternId && p.group_id === groupId);
      if (!pattern) return null;

      if (updates.title) pattern.title = updates.title;
      if (updates.trigger_phrases) pattern.trigger_phrases = updates.trigger_phrases;
      if (prompt !== undefined) pattern.prompt = prompt;
      if (description !== undefined) pattern.description = description;
      pattern.updated_at = new Date().toISOString();

      return pattern;
    },

    async updateTriggerPhrases(
      patternId: string,
      groupId: string,
      _scope: string,
      _workspaceId: string | undefined,
      triggerPhrases: string[],
    ) {
      const pattern = mockPatterns.find((p) => p.id === patternId && p.group_id === groupId);
      if (!pattern) return null;

      pattern.trigger_phrases = triggerPhrases;
      pattern.updated_at = new Date().toISOString();

      return pattern;
    },
  } as unknown as PatternGroupsPersistence;
}

// ============================================================================
// Tests
// ============================================================================

describe("GET /api/pattern-groups", () => {
  let testDb: DataDB;
  let migrationsRun = false;
  const TEST_DB_PATH = `${TEST_DB_PATH_BASE}-list.db`;

  beforeEach(async () => {
    if (!migrationsRun) {
      if (existsSync(TEST_DB_PATH)) {
        rmSync(TEST_DB_PATH);
      }
      await runMigrations(TEST_DB_PATH);
      migrationsRun = true;
    }

    testDb = createTestDb(TEST_DB_PATH);
    setupTestData(testDb);
  });

  afterEach(() => {
    cleanupTestData(testDb);
  });

  test("returns 400 when workspaceId query param is missing", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/");

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("workspaceId");
  });

  test("returns all sections with correct structure", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/?workspaceId=workspace-1");

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.sections).toBeDefined();
    expect(Array.isArray(data.sections)).toBe(true);
    expect(data.sections.length).toBe(4); // user + workspace-1 + workspace-2 + birdhouse

    // Section 1: User patterns
    const userSection = data.sections[0];
    expect(userSection.id).toBe("user");
    expect(userSection.title).toBe("Your Patterns");
    expect(userSection.subtitle).toBe("These patterns come with you to all your workspaces");
    expect(userSection.is_current).toBe(false);
    expect(userSection.groups.length).toBe(1);
    expect(userSection.groups[0].id).toBe("user-default");
    expect(userSection.groups[0].readonly).toBe(false);

    // Section 2: Current workspace
    const currentSection = data.sections[1];
    expect(currentSection.id).toBe("workspace-workspace-1");
    expect(currentSection.title).toBe("Workspace One");
    expect(currentSection.is_current).toBe(true);
    expect(currentSection.groups.length).toBe(1);
    expect(currentSection.groups[0].id).toBe("workspace-workspace-1-default");

    // Section 3: Other workspace
    const otherSection = data.sections[2];
    expect(otherSection.id).toBe("workspace-workspace-2");
    expect(otherSection.is_current).toBe(false);

    // Section 4: Birdhouse
    const birdhouseSection = data.sections[3];
    expect(birdhouseSection.id).toBe("birdhouse");
    expect(birdhouseSection.title).toBe("Birdhouse Bundled Patterns");
    expect(birdhouseSection.is_current).toBe(false);
    expect(birdhouseSection.groups.length).toBe(2);
    expect(birdhouseSection.groups[0].readonly).toBe(true);
    expect(birdhouseSection.groups[1].readonly).toBe(true);
  });

  test("includes pattern counts in group summaries", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/?workspaceId=workspace-1");

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    const userSection = data.sections[0];
    expect(userSection.groups[0].pattern_count).toBe(1); // 1 user pattern

    const currentSection = data.sections[1];
    expect(currentSection.groups[0].pattern_count).toBe(1); // 1 workspace-1 pattern
  });
});

describe("GET /api/pattern-groups/:groupId", () => {
  let testDb: DataDB;
  let migrationsRun = false;
  const TEST_DB_PATH = `${TEST_DB_PATH_BASE}-detail.db`;

  beforeEach(async () => {
    if (!migrationsRun) {
      if (existsSync(TEST_DB_PATH)) {
        rmSync(TEST_DB_PATH);
      }
      await runMigrations(TEST_DB_PATH);
      migrationsRun = true;
    }

    testDb = createTestDb(TEST_DB_PATH);
    setupTestData(testDb);
  });

  afterEach(() => {
    cleanupTestData(testDb);
  });

  test("returns 400 when workspaceId query param is missing", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default");

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("workspaceId");
  });

  test("returns 400 for invalid group ID format", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/invalid?workspaceId=workspace-1");

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("Invalid group ID format");
  });

  test("returns 404 for non-existent group", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-nonexistent?workspaceId=workspace-1");

    expect(res.status).toBe(404);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("not found");
  });

  test("returns user group with patterns", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default?workspaceId=workspace-1");

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.id).toBe("user-default");
    expect(data.title).toBe("Default Patterns");
    expect(data.scope).toBe("user");
    expect(data.readonly).toBe(false);
    expect(data.patterns).toBeDefined();
    expect(Array.isArray(data.patterns)).toBe(true);
    expect(data.patterns.length).toBe(1);

    // Pattern should include description but NOT prompt
    const pattern = data.patterns[0];
    expect(pattern.id).toBeDefined();
    expect(pattern.title).toBeDefined();
    expect(pattern.description).toBe("First user pattern"); // Description included
    expect(pattern.prompt).toBeUndefined(); // Prompt NOT included
  });

  test("returns workspace group with correct encoding", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/workspace-workspace-1-default?workspaceId=workspace-1");

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.id).toBe("workspace-workspace-1-default");
    expect(data.scope).toBe("workspace");
    expect(data.workspace_id).toBe("workspace-1");
    expect(data.readonly).toBe(false);
  });

  test("returns birdhouse group with readonly flag", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/birdhouse-core?workspaceId=workspace-1");

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.id).toBe("birdhouse-core");
    expect(data.scope).toBe("birdhouse");
    expect(data.readonly).toBe(true);
  });
});

describe("GET /api/pattern-groups/:groupId/patterns/:patternId", () => {
  let testDb: DataDB;
  let migrationsRun = false;
  const TEST_DB_PATH = `${TEST_DB_PATH_BASE}-pattern.db`;

  beforeEach(async () => {
    if (!migrationsRun) {
      if (existsSync(TEST_DB_PATH)) {
        rmSync(TEST_DB_PATH);
      }
      await runMigrations(TEST_DB_PATH);
      migrationsRun = true;
    }

    testDb = createTestDb(TEST_DB_PATH);
    setupTestData(testDb);
  });

  afterEach(() => {
    cleanupTestData(testDb);
  });

  test("returns 400 when workspaceId query param is missing", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1");

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("workspaceId");
  });

  test("returns 404 for non-existent pattern", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/nonexistent?workspaceId=workspace-1");

    expect(res.status).toBe(404);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("not found");
  });

  test("returns full pattern with prompt and description", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1");

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.id).toBe("pat_user_1");
    expect(data.group_id).toBe("user-default"); // Encoded group ID
    expect(data.title).toBe("User Pattern 1");
    expect(data.description).toBe("First user pattern");
    expect(data.prompt).toBe("User pattern prompt");
    expect(data.trigger_phrases).toEqual(["user1"]);
    expect(data.readonly).toBe(false);
  });

  test("returns birdhouse pattern with readonly flag", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/birdhouse-core/patterns/bh-core-1?workspaceId=workspace-1");

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.id).toBe("bh-core-1");
    expect(data.group_id).toBe("birdhouse-core"); // Encoded group ID
    expect(data.readonly).toBe(true);
  });
});

describe("POST /api/pattern-groups/:groupId/patterns", () => {
  let testDb: DataDB;
  let migrationsRun = false;
  const TEST_DB_PATH = `${TEST_DB_PATH_BASE}-create.db`;

  beforeEach(async () => {
    if (!migrationsRun) {
      if (existsSync(TEST_DB_PATH)) {
        rmSync(TEST_DB_PATH);
      }
      await runMigrations(TEST_DB_PATH);
      migrationsRun = true;
    }

    testDb = createTestDb(TEST_DB_PATH);
    setupTestData(testDb);
  });

  afterEach(() => {
    cleanupTestData(testDb);
  });

  test("returns 400 when workspaceId query param is missing", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns", {
      method: "POST",
      body: JSON.stringify({ title: "Test", prompt: "Test prompt" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("workspaceId");
  });

  test("returns 400 for birdhouse group", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/birdhouse-core/patterns?workspaceId=workspace-1", {
      method: "POST",
      body: JSON.stringify({ title: "Test", prompt: "Test prompt" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("bundled");
  });

  test("returns 400 when title is missing", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns?workspaceId=workspace-1", {
      method: "POST",
      body: JSON.stringify({ prompt: "Test prompt" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("title");
  });

  test("returns 400 when prompt is missing", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns?workspaceId=workspace-1", {
      method: "POST",
      body: JSON.stringify({ title: "Test" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("prompt");
  });

  test("creates pattern with all fields", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns?workspaceId=workspace-1", {
      method: "POST",
      body: JSON.stringify({
        title: "New Pattern",
        description: "New pattern description",
        prompt: "New pattern prompt",
        trigger_phrases: ["new", "pattern"],
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as SuccessResponse;

    expect(data.id).toBeDefined();
    expect(data.group_id).toBe("user-default"); // Encoded group ID
    expect(data.title).toBe("New Pattern");
    expect(data.description).toBe("New pattern description");
    expect(data.prompt).toBe("New pattern prompt");
    expect(data.trigger_phrases).toEqual(["new", "pattern"]);
    expect(data.readonly).toBe(false);
  });

  test("creates pattern with minimal fields", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns?workspaceId=workspace-1", {
      method: "POST",
      body: JSON.stringify({
        title: "Minimal Pattern",
        prompt: "Minimal prompt",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(201);
    const data = (await res.json()) as SuccessResponse;

    expect(data.group_id).toBe("user-default"); // Encoded group ID
    expect(data.title).toBe("Minimal Pattern");
    expect(data.prompt).toBe("Minimal prompt");
    expect(data.trigger_phrases).toEqual([]);
  });
});

describe("PATCH /api/pattern-groups/:groupId/patterns/:patternId/trigger-phrases", () => {
  let testDb: DataDB;
  let migrationsRun = false;
  const TEST_DB_PATH = `${TEST_DB_PATH_BASE}-trigger.db`;

  beforeEach(async () => {
    if (!migrationsRun) {
      if (existsSync(TEST_DB_PATH)) {
        rmSync(TEST_DB_PATH);
      }
      await runMigrations(TEST_DB_PATH);
      migrationsRun = true;
    }

    testDb = createTestDb(TEST_DB_PATH);
    setupTestData(testDb);
  });

  afterEach(() => {
    cleanupTestData(testDb);
  });

  test("returns 400 when trigger_phrases is missing", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("trigger_phrases");
  });

  test("returns 400 when trigger_phrases is not an array", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ trigger_phrases: "not-an-array" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("array");
  });

  test("returns 400 when trigger_phrases contains empty string", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ trigger_phrases: ["valid", "  ", "another"] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("empty");
  });

  test("returns 400 when trigger_phrases contains duplicates", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ trigger_phrases: ["test", "test"] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("duplicate");
  });

  test("updates trigger phrases successfully", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ trigger_phrases: ["new", "triggers"] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.id).toBe("pat_user_1");
    expect(data.trigger_phrases).toEqual(["new", "triggers"]);
    expect(data.updated_at).toBeDefined();
  });

  test("allows empty trigger_phrases array", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ trigger_phrases: [] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;
    expect(data.trigger_phrases).toEqual([]);
  });

  test("works for birdhouse patterns", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/birdhouse-core/patterns/bh-core-1/trigger-phrases?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ trigger_phrases: ["custom"] }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;
    expect(data.trigger_phrases).toEqual(["custom"]);
  });
});

describe("PATCH /api/pattern-groups/:groupId/patterns/:patternId", () => {
  let testDb: DataDB;
  let migrationsRun = false;
  const TEST_DB_PATH = `${TEST_DB_PATH_BASE}-update.db`;

  beforeEach(async () => {
    if (!migrationsRun) {
      if (existsSync(TEST_DB_PATH)) {
        rmSync(TEST_DB_PATH);
      }
      await runMigrations(TEST_DB_PATH);
      migrationsRun = true;
    }

    testDb = createTestDb(TEST_DB_PATH);
    setupTestData(testDb);
  });

  afterEach(() => {
    cleanupTestData(testDb);
  });

  test("returns 400 for birdhouse patterns", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/birdhouse-core/patterns/bh-core-1?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "New Title" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("bundled");
  });

  test("returns 400 when no fields provided", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("At least one field");
  });

  test("updates title only", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Title" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.title).toBe("Updated Title");
    expect(data.prompt).toBe("User pattern prompt"); // Unchanged
  });

  test("updates prompt only", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ prompt: "Updated prompt" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.prompt).toBe("Updated prompt");
    expect(data.title).toBe("User Pattern 1"); // Unchanged
  });

  test("updates multiple fields", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({
        title: "New Title",
        description: "New description",
        prompt: "New prompt",
      }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    expect(data.group_id).toBe("user-default"); // Encoded group ID
    expect(data.title).toBe("New Title");
    expect(data.description).toBe("New description");
    expect(data.prompt).toBe("New prompt");
  });

  test("returns full pattern after update", async () => {
    const mockPersistence = createMockPersistence();
    const app = createPatternGroupRoutes(testDb, mockPersistence);
    const res = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated" }),
      headers: { "Content-Type": "application/json" },
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as SuccessResponse;

    // Should return full pattern with all fields
    expect(data.id).toBeDefined();
    expect(data.title).toBeDefined();
    expect(data.prompt).toBeDefined();
    expect(data.trigger_phrases).toBeDefined();
    expect(data.readonly).toBe(false);
  });
});
