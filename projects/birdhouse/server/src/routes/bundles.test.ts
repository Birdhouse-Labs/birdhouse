// ABOUTME: Integration tests for bundle API routes
// ABOUTME: Tests GET /api/bundles and GET /api/bundles/:id endpoints

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import type { Bundle } from "../lib/bundles-db";
import { DataDB } from "../lib/data-db";
import { runMigrations } from "../lib/migrations/run-migrations";
import { withWorkspaceContext } from "../test-utils";
import { createBundleRoutes } from "./bundles";

const FIXTURES_PATH = join(import.meta.dir, "..", "lib", "__fixtures__", "pattern-bundles-routes");
const TEST_DB_PATH_BASE = join(import.meta.dir, "..", "lib", "__fixtures__", "test-bundles-routes");

interface BundlesListResponse {
  bundles: Bundle[];
}

interface ErrorResponse {
  error: string;
}

// Helper functions for test setup
function createTestDb(dbPath: string): DataDB {
  return new DataDB(dbPath);
}

function setupFixtures(fixturesPath: string) {
  if (!existsSync(fixturesPath)) {
    mkdirSync(fixturesPath, { recursive: true });

    // Create test-bundle-01
    const bundle1Dir = join(fixturesPath, "test-bundle-01");
    mkdirSync(bundle1Dir, { recursive: true });

    const bundle1Metadata = {
      id: "test-bundle-01",
      name: "Test Bundle 01",
      description: "First test bundle",
      author: "Test Author",
      version: "1.0.0",
      created_at: "2026-02-23T00:00:00Z",
      updated_at: "2026-02-23T00:00:00Z",
      installable: true,
    };
    writeFileSync(join(bundle1Dir, "bundle.yml"), yaml.dump(bundle1Metadata), "utf-8");

    // Create a pattern in bundle 01
    const pattern1Dir = join(bundle1Dir, "test-pattern-01");
    mkdirSync(pattern1Dir, { recursive: true });

    const pattern1Metadata = {
      id: "test-pattern-01",
      title: "Test Pattern 01",
      category: "Testing",
      trigger_phrases: ["test pattern"],
      created_at: "2026-02-23T00:00:00Z",
      updated_at: "2026-02-23T00:00:00Z",
    };
    writeFileSync(join(pattern1Dir, "metadata.yml"), yaml.dump(pattern1Metadata), "utf-8");
    writeFileSync(join(pattern1Dir, "prompt.md"), "# Test Pattern 01\n\nTest content", "utf-8");
  }
}

function setupTestData(testDb: DataDB) {
  testDb.setUserName("Test User");

  testDb.insertWorkspace({
    workspace_id: "test-workspace",
    directory: "/test/workspace",
    title: "Test Workspace",
    opencode_port: null,
    opencode_pid: null,
    created_at: new Date().toISOString(),
    last_used: new Date().toISOString(),
  });
}

function cleanupTestData(testDb: DataDB, fixturesPath: string) {
  const workspaces = testDb.getAllWorkspaces();
  for (const workspace of workspaces) {
    testDb.deleteWorkspace(workspace.workspace_id);
  }
  // Close database connection before cleaning up files
  testDb.close();

  if (existsSync(fixturesPath)) {
    rmSync(fixturesPath, { recursive: true });
  }
}

describe("GET /api/bundles", () => {
  let testDb: DataDB;
  let migrationsRun = false;
  const TEST_DB_PATH = `${TEST_DB_PATH_BASE}-list.db`;

  beforeEach(async () => {
    // Run migrations once
    if (!migrationsRun) {
      if (existsSync(TEST_DB_PATH)) {
        rmSync(TEST_DB_PATH);
      }
      await runMigrations(TEST_DB_PATH);
      migrationsRun = true;
    }

    // Create database instance
    testDb = createTestDb(TEST_DB_PATH);

    // Set up test data
    setupTestData(testDb);
    setupFixtures(FIXTURES_PATH);
  });

  afterEach(() => {
    cleanupTestData(testDb, FIXTURES_PATH);
  });

  test("returns 400 when workspaceId query param is missing", async () => {
    const app = withWorkspaceContext(() => createBundleRoutes(testDb, FIXTURES_PATH));
    const res = await app.request("/");

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("workspaceId");
  });

  test("returns personal, workspace, and marketplace bundles", async () => {
    const app = withWorkspaceContext(() => createBundleRoutes(testDb, FIXTURES_PATH));
    const res = await app.request("/?workspaceId=test-workspace");

    expect(res.status).toBe(200);
    const data = (await res.json()) as BundlesListResponse;

    expect(data.bundles).toBeDefined();
    expect(Array.isArray(data.bundles)).toBe(true);
    expect(data.bundles.length).toBe(3); // 1 personal + 1 workspace + 1 marketplace

    // Check personal bundle
    const personalBundle = data.bundles.find((b) => b.id === "user");
    expect(personalBundle).toBeDefined();
    expect(personalBundle?.type).toBe("personal");
    expect(personalBundle?.name).toBe("Test User's Patterns");
    expect(personalBundle?.installed).toBe(true);
    expect(personalBundle?.pattern_count).toBe(0);

    // Check workspace bundle
    const workspaceBundle = data.bundles.find((b) => b.id === "workspace");
    expect(workspaceBundle).toBeDefined();
    expect(workspaceBundle?.type).toBe("workspace");
    expect(workspaceBundle?.name).toBe("Test Workspace Patterns");
    expect(workspaceBundle?.installed).toBe(true);
    expect(workspaceBundle?.pattern_count).toBe(0);

    // Check marketplace bundle
    const marketplaceBundle = data.bundles.find((b) => b.id === "test-bundle-01");
    expect(marketplaceBundle).toBeDefined();
    expect(marketplaceBundle?.type).toBe("marketplace");
    expect(marketplaceBundle?.name).toBe("Test Bundle 01");
    expect(marketplaceBundle?.installed).toBe(false);
    expect(marketplaceBundle?.pattern_count).toBe(1);

    // Bundles no longer include patterns array - use pattern-groups-db to access patterns
  });

  test("omits workspace bundle when workspace does not exist", async () => {
    const app = withWorkspaceContext(() => createBundleRoutes(testDb, FIXTURES_PATH));
    const res = await app.request("/?workspaceId=nonexistent-workspace");

    expect(res.status).toBe(200);
    const data = (await res.json()) as BundlesListResponse;

    expect(data.bundles.length).toBe(2); // 1 personal + 0 workspace + 1 marketplace

    const workspaceBundle = data.bundles.find((b) => b.id === "workspace");
    expect(workspaceBundle).toBeUndefined();
  });
});

describe("GET /api/bundles/:id", () => {
  let testDb: DataDB;
  let migrationsRun = false;
  const TEST_DB_PATH = `${TEST_DB_PATH_BASE}-detail.db`;

  beforeEach(async () => {
    // Run migrations once
    if (!migrationsRun) {
      if (existsSync(TEST_DB_PATH)) {
        rmSync(TEST_DB_PATH);
      }
      await runMigrations(TEST_DB_PATH);
      migrationsRun = true;
    }

    // Create database instance
    testDb = createTestDb(TEST_DB_PATH);

    // Set up test data
    setupTestData(testDb);
    setupFixtures(FIXTURES_PATH);
  });

  afterEach(() => {
    cleanupTestData(testDb, FIXTURES_PATH);
  });

  test("returns 400 when workspaceId query param is missing", async () => {
    const app = withWorkspaceContext(() => createBundleRoutes(testDb, FIXTURES_PATH));
    const res = await app.request("/user");

    expect(res.status).toBe(400);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("workspaceId");
  });

  test("returns personal bundle metadata only", async () => {
    const app = withWorkspaceContext(() => createBundleRoutes(testDb, FIXTURES_PATH));
    const res = await app.request("/user?workspaceId=test-workspace");

    expect(res.status).toBe(200);
    const bundle = (await res.json()) as Bundle;

    expect(bundle.id).toBe("user");
    expect(bundle.type).toBe("personal");
    expect(bundle.name).toBe("Test User's Patterns");
    expect(bundle.installed).toBe(true);
    // Patterns no longer included - use pattern-groups-db to access patterns
  });

  test("returns workspace bundle metadata only", async () => {
    const app = withWorkspaceContext(() => createBundleRoutes(testDb, FIXTURES_PATH));
    const res = await app.request("/workspace?workspaceId=test-workspace");

    expect(res.status).toBe(200);
    const bundle = (await res.json()) as Bundle;

    expect(bundle.id).toBe("workspace");
    expect(bundle.type).toBe("workspace");
    expect(bundle.name).toBe("Test Workspace Patterns");
    expect(bundle.installed).toBe(true);
    // Patterns no longer included - use pattern-groups-db to access patterns
  });

  test("returns marketplace bundle metadata with pattern count", async () => {
    const app = withWorkspaceContext(() => createBundleRoutes(testDb, FIXTURES_PATH));
    const res = await app.request("/test-bundle-01?workspaceId=test-workspace");

    expect(res.status).toBe(200);
    const bundle = (await res.json()) as Bundle;

    expect(bundle.id).toBe("test-bundle-01");
    expect(bundle.type).toBe("marketplace");
    expect(bundle.name).toBe("Test Bundle 01");
    expect(bundle.installed).toBe(false);
    expect(bundle.pattern_count).toBe(1);
    // Patterns no longer included - use pattern-groups-db to access patterns
  });

  test("returns 404 for non-existent bundle", async () => {
    const app = withWorkspaceContext(() => createBundleRoutes(testDb, FIXTURES_PATH));
    const res = await app.request("/nonexistent?workspaceId=test-workspace");

    expect(res.status).toBe(404);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("not found");
  });

  test("returns 404 for workspace bundle when workspace does not exist", async () => {
    const app = withWorkspaceContext(() => createBundleRoutes(testDb, FIXTURES_PATH));
    const res = await app.request("/workspace?workspaceId=nonexistent-workspace");

    expect(res.status).toBe(404);
    const data = (await res.json()) as ErrorResponse;
    expect(data.error).toContain("not found");
  });
});
