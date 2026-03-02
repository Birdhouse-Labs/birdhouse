// ABOUTME: Integration tests for pattern SSE event emission on CRUD operations
// ABOUTME: Tests event payload structure and emission triggers for pattern lifecycle events

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createTestDeps, withDeps } from "../dependencies";
import { DataDB } from "../lib/data-db";
import { runMigrations } from "../lib/migrations/run-migrations";
import type { PatternGroup, PatternGroupsPersistence, PatternMetadata } from "../lib/pattern-groups-db";
import { captureStreamEvents, createTestApp } from "../test-utils";
import { createPatternGroupRoutes } from "./pattern-groups";

const TEST_DB_PATH_BASE = join(import.meta.dir, "..", "lib", "__fixtures__", "test-pattern-events");

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
      id: "birdhouse-core",
      title: "Birdhouse Core",
      description: "Essential development patterns",
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
    async getGroup(groupId: string, scope: string, workspaceId?: string) {
      return (
        mockGroups.find((g) => g.id === groupId && g.scope === scope && g.workspace_id === (workspaceId || null)) ||
        null
      );
    },

    async getPattern(patternId: string, groupId: string, _scope: string, _workspaceId?: string) {
      const pattern = mockPatterns.find((p) => p.id === patternId && p.group_id === groupId);
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

    async deletePattern(patternId: string, groupId: string, _scope: string, _workspaceId?: string) {
      const index = mockPatterns.findIndex((p) => p.id === patternId && p.group_id === groupId);
      if (index === -1) return false;

      mockPatterns.splice(index, 1);
      return true;
    },
  } as unknown as PatternGroupsPersistence;
}

// ============================================================================
// Tests - Pattern Creation Events
// ============================================================================

describe("Pattern Creation Events (POST /:groupId/patterns)", () => {
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

  test("emits birdhouse.pattern.created event on successful creation", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns?workspaceId=workspace-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Pattern",
          description: "Test description",
          prompt: "Test prompt",
          trigger_phrases: ["test"],
        }),
      });

      expect(response.status).toBe(201);

      // Verify event was emitted
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("birdhouse.pattern.created");

      cleanup();
    });
  });

  test("event payload includes correct patternId, groupId, scope, workspaceId", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns?workspaceId=workspace-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Pattern",
          prompt: "Test prompt",
          trigger_phrases: ["test"],
        }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as { id: string };

      // Verify event payload structure
      expect(events).toHaveLength(1);
      expect(events[0].properties.patternId).toBe(body.id);
      expect(events[0].properties.groupId).toBe("user-default");
      expect(events[0].properties.workspaceId).toBeNull();

      cleanup();
    });
  });

  test("event payload includes full PatternMetadata", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns?workspaceId=workspace-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Complete Pattern",
          description: "Pattern description",
          prompt: "Pattern prompt",
          trigger_phrases: ["trigger1", "trigger2"],
        }),
      });

      expect(response.status).toBe(201);

      // Verify pattern metadata in event
      expect(events).toHaveLength(1);
      const pattern = events[0].properties.pattern as PatternMetadata;
      expect(pattern).toBeDefined();
      expect(pattern.id).toBeDefined();
      expect(pattern.title).toBe("Complete Pattern");
      expect(pattern.description).toBe("Pattern description");
      expect(pattern.trigger_phrases).toEqual(["trigger1", "trigger2"]);
      expect(pattern.created_at).toBeDefined();
      expect(pattern.updated_at).toBeDefined();

      cleanup();
    });
  });

  test("no event on validation failure (missing title)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns?workspaceId=workspace-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Test prompt",
        }),
      });

      expect(response.status).toBe(400);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });

  test("no event on validation failure (invalid body)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns?workspaceId=workspace-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          // Missing prompt
        }),
      });

      expect(response.status).toBe(400);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });

  test("no event when creating in birdhouse group (returns 400)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/birdhouse-core/patterns?workspaceId=workspace-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Pattern",
          prompt: "Test prompt",
        }),
      });

      expect(response.status).toBe(400);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });
});

// ============================================================================
// Tests - Pattern Update Events
// ============================================================================

describe("Pattern Update Events (PATCH /:groupId/patterns/:patternId)", () => {
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

  test("emits birdhouse.pattern.updated event on successful update", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      expect(response.status).toBe(200);

      // Verify event was emitted
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("birdhouse.pattern.updated");

      cleanup();
    });
  });

  test("event payload structure matches spec", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Title",
          description: "Updated description",
        }),
      });

      expect(response.status).toBe(200);

      // Verify event payload
      expect(events).toHaveLength(1);
      expect(events[0].properties.patternId).toBe("pat_user_1");
      expect(events[0].properties.groupId).toBe("user-default");
      expect(events[0].properties.workspaceId).toBeNull();

      cleanup();
    });
  });

  test("event includes updated PatternMetadata", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Title",
          description: "New description",
        }),
      });

      expect(response.status).toBe(200);

      // Verify updated metadata in event
      expect(events).toHaveLength(1);
      const pattern = events[0].properties.pattern as PatternMetadata;
      expect(pattern).toBeDefined();
      expect(pattern.id).toBe("pat_user_1");
      expect(pattern.title).toBe("New Title");
      expect(pattern.description).toBe("New description");
      expect(pattern.trigger_phrases).toEqual(["user1"]);
      expect(pattern.created_at).toBeDefined();
      expect(pattern.updated_at).toBeDefined();

      cleanup();
    });
  });

  test("no event on 404 (pattern not found)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/nonexistent?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      expect(response.status).toBe(404);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });

  test("no event on validation failure", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // No fields provided
        }),
      });

      expect(response.status).toBe(400);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });
});

// ============================================================================
// Tests - Trigger Phrase Update Events
// ============================================================================

describe("Trigger Phrase Update Events (PATCH /:groupId/patterns/:patternId/trigger-phrases)", () => {
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

  test("emits birdhouse.pattern.updated event on successful trigger phrase update", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["new", "triggers"],
        }),
      });

      expect(response.status).toBe(200);

      // Verify event was emitted
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("birdhouse.pattern.updated");

      cleanup();
    });
  });

  test("event payload structure matches spec", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["updated"],
        }),
      });

      expect(response.status).toBe(200);

      // Verify event payload
      expect(events).toHaveLength(1);
      expect(events[0].properties.patternId).toBe("pat_user_1");
      expect(events[0].properties.groupId).toBe("user-default");
      expect(events[0].properties.workspaceId).toBeNull();

      // Verify pattern metadata includes updated trigger phrases
      const pattern = events[0].properties.pattern as PatternMetadata;
      expect(pattern).toBeDefined();
      expect(pattern.trigger_phrases).toEqual(["updated"]);

      cleanup();
    });
  });

  test("event works for birdhouse-scoped patterns (user can edit triggers on bundled patterns)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/birdhouse-core/patterns/bh-core-1/trigger-phrases?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["custom"],
        }),
      });

      expect(response.status).toBe(200);

      // Verify event was emitted for birdhouse pattern
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("birdhouse.pattern.updated");
      expect(events[0].properties.groupId).toBe("birdhouse-core");

      cleanup();
    });
  });

  test("no event on 404 (pattern not found)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/nonexistent/trigger-phrases?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["test"],
        }),
      });

      expect(response.status).toBe(404);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });

  test("no event on validation failure (empty strings)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["valid", "  ", "another"],
        }),
      });

      expect(response.status).toBe(400);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });

  test("no event on validation failure (duplicates)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1/trigger-phrases?workspaceId=workspace-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["test", "test"],
        }),
      });

      expect(response.status).toBe(400);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });
});

// ============================================================================
// Tests - Pattern Deletion Events
// ============================================================================

describe("Pattern Deletion Events (DELETE /:groupId/patterns/:patternId)", () => {
  let testDb: DataDB;
  let migrationsRun = false;
  const TEST_DB_PATH = `${TEST_DB_PATH_BASE}-delete.db`;

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

  test("emits birdhouse.pattern.deleted event on successful deletion", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
        method: "DELETE",
      });

      expect(response.status).toBe(200);

      // Verify event was emitted
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("birdhouse.pattern.deleted");

      cleanup();
    });
  });

  test("event payload includes patternId, groupId, scope, workspaceId (no pattern metadata)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/pat_user_1?workspaceId=workspace-1", {
        method: "DELETE",
      });

      expect(response.status).toBe(200);

      // Verify event payload
      expect(events).toHaveLength(1);
      expect(events[0].properties.patternId).toBe("pat_user_1");
      expect(events[0].properties.groupId).toBe("user-default");
      expect(events[0].properties.workspaceId).toBeNull();

      // Pattern metadata should NOT be present for deletion events
      expect(events[0].properties.pattern).toBeUndefined();

      cleanup();
    });
  });

  test("no event on 404 (pattern not found)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/user-default/patterns/nonexistent?workspaceId=workspace-1", {
        method: "DELETE",
      });

      expect(response.status).toBe(404);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });

  test("no event when deleting birdhouse pattern (returns 403)", async () => {
    const deps = createTestDeps();

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();

      const mockPersistence = createMockPersistence();
      const app = createTestApp();
      const routes = createPatternGroupRoutes(testDb, mockPersistence);
      app.route("/", routes);

      const response = await app.request("/birdhouse-core/patterns/bh-core-1?workspaceId=workspace-1", {
        method: "DELETE",
      });

      expect(response.status).toBe(403);

      // No event should be emitted
      expect(events).toHaveLength(0);

      cleanup();
    });
  });
});
