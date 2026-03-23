// ABOUTME: Unit tests for workspace management routes
// ABOUTME: Tests workspace health check endpoints for single and batch operations

import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { DataDB, Workspace } from "../lib/data-db";
import type { OpenCodeManager } from "../lib/opencode-manager";
import { createWorkspaceRoutes } from "./workspaces";

// Type definitions for health responses
interface WorkspaceHealthResponse {
  workspaceId: string;
  opencodeRunning: boolean;
  port: number | null;
  pid: number | null;
  error: string | null;
}

type BatchHealthResponse = WorkspaceHealthResponse[];

interface ErrorResponse {
  error: string;
}

interface RestartResponse {
  success: boolean;
  message?: string;
  port?: number;
  pid?: number;
}

// Mock implementations
function createMockDataDB(): DataDB {
  const workspaces = new Map<string, Workspace>();

  return {
    getAllWorkspaces: () => Array.from(workspaces.values()),
    getWorkspaceById: (id: string) => workspaces.get(id) || null,
    getWorkspaceByDirectory: (directory: string) =>
      Array.from(workspaces.values()).find((w) => w.directory === directory) || null,
    insertWorkspace: (workspace: Workspace) => {
      workspaces.set(workspace.workspace_id, workspace);
    },
    updateWorkspace: (id: string, updates: Partial<Workspace>) => {
      const workspace = workspaces.get(id);
      if (workspace) {
        workspaces.set(id, { ...workspace, ...updates });
      }
    },
    deleteWorkspace: (id: string) => {
      workspaces.delete(id);
    },
  } as DataDB;
}

function createMockOpenCodeManager(
  verifyFn?: (port: number, pid: number, workspaceId: string) => Promise<boolean>,
  shutdownFn?: (workspaceId: string) => Promise<void>,
  restartFn?: (workspaceId: string) => Promise<{ port: number; pid: number }>,
  spawnFn?: (workspaceId: string) => Promise<{ port: number; pid: number }>,
): OpenCodeManager {
  return {
    verifyOpenCodeInstance: verifyFn || (async () => true),
    shutdownOpenCode: shutdownFn || (async () => {}),
    restartOpenCode: restartFn || (async () => ({ port: 3001, pid: 12345 })),
    getOrSpawnOpenCode: spawnFn || (async () => ({ port: 3001, pid: 12345 })),
  } as OpenCodeManager;
}

describe("GET /api/workspace/:id/health", () => {
  test("returns 404 when workspace doesn't exist", async () => {
    const dataDb = createMockDataDB();
    const opencodeManager = createMockOpenCodeManager();
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/nonexistent-workspace/health");

    expect(res.status).toBe(404);
    const data = (await res.json()) as ErrorResponse;
    expect(data).toEqual({ error: "Workspace not found" });
  });

  test("returns opencodeRunning:false when OpenCode not started", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: null,
      opencode_pid: null,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    const opencodeManager = createMockOpenCodeManager();
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/test-workspace/health");

    expect(res.status).toBe(200);
    const data = (await res.json()) as WorkspaceHealthResponse;
    expect(data).toEqual({
      workspaceId: "test-workspace",
      opencodeRunning: false,
      port: null,
      pid: null,
      error: "Workspace environment not started for this workspace",
    });
  });

  test("returns opencodeRunning:true when OpenCode is valid and responding", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: 3001,
      opencode_pid: 12345,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    const opencodeManager = createMockOpenCodeManager(async () => true);
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/test-workspace/health");

    expect(res.status).toBe(200);
    const data = (await res.json()) as WorkspaceHealthResponse;
    expect(data).toEqual({
      workspaceId: "test-workspace",
      opencodeRunning: true,
      port: 3001,
      pid: 12345,
      error: null,
    });
  });

  test("returns opencodeRunning:false when OpenCode verification fails", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: 3001,
      opencode_pid: 12345,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    const opencodeManager = createMockOpenCodeManager(async () => false);
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/test-workspace/health");

    expect(res.status).toBe(200);
    const data = (await res.json()) as WorkspaceHealthResponse;
    expect(data).toEqual({
      workspaceId: "test-workspace",
      opencodeRunning: false,
      port: 3001,
      pid: 12345,
      error: "Workspace environment not responding or workspace ID mismatch",
    });
  });

  test("returns 500 when verification throws an error", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: 3001,
      opencode_pid: 12345,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    const opencodeManager = createMockOpenCodeManager(async () => {
      throw new Error("Network timeout");
    });
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/test-workspace/health");

    expect(res.status).toBe(500);
    const data = (await res.json()) as WorkspaceHealthResponse;
    expect(data).toEqual({
      workspaceId: "test-workspace",
      opencodeRunning: false,
      port: 3001,
      pid: 12345,
      error: "Network timeout",
    });
  });
});

describe("GET /api/workspaces/health", () => {
  test("returns empty array when no workspaces exist", async () => {
    const dataDb = createMockDataDB();
    const opencodeManager = createMockOpenCodeManager();
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const data = (await res.json()) as BatchHealthResponse;
    expect(data).toEqual([]);
  });

  test("returns health status for single workspace", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: 3001,
      opencode_pid: 12345,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    const opencodeManager = createMockOpenCodeManager(async () => true);
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const data = (await res.json()) as BatchHealthResponse;
    expect(data).toEqual([
      {
        workspaceId: "test-workspace",
        opencodeRunning: true,
        port: 3001,
        pid: 12345,
        error: null,
      },
    ]);
  });

  test("returns health status for multiple workspaces with mixed states", async () => {
    const dataDb = createMockDataDB();

    const workspace1: Workspace = {
      workspace_id: "workspace-1",
      directory: "/test1",
      opencode_port: 3001,
      opencode_pid: 12345,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace1);

    const workspace2: Workspace = {
      workspace_id: "workspace-2",
      directory: "/test2",
      opencode_port: null,
      opencode_pid: null,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace2);

    const workspace3: Workspace = {
      workspace_id: "workspace-3",
      directory: "/test3",
      opencode_port: 3003,
      opencode_pid: 54321,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace3);

    // workspace-1: valid and running
    // workspace-2: not started
    // workspace-3: started but verification fails
    const opencodeManager = createMockOpenCodeManager(async (_port: number, _pid: number, workspaceId: string) => {
      if (workspaceId === "workspace-1") return true;
      if (workspaceId === "workspace-3") return false;
      return false;
    });

    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const data = (await res.json()) as BatchHealthResponse;
    expect(data).toHaveLength(3);

    // Find each workspace in response (order might vary)
    const ws1 = data.find((w) => w.workspaceId === "workspace-1");
    const ws2 = data.find((w) => w.workspaceId === "workspace-2");
    const ws3 = data.find((w) => w.workspaceId === "workspace-3");

    expect(ws1).toEqual({
      workspaceId: "workspace-1",
      opencodeRunning: true,
      port: 3001,
      pid: 12345,
      error: null,
    });

    expect(ws2).toEqual({
      workspaceId: "workspace-2",
      opencodeRunning: false,
      port: null,
      pid: null,
      error: "Workspace environment not started for this workspace",
    });

    expect(ws3).toEqual({
      workspaceId: "workspace-3",
      opencodeRunning: false,
      port: 3003,
      pid: 54321,
      error: "Workspace environment not responding or workspace ID mismatch",
    });
  });

  test("handles verification errors gracefully for individual workspaces", async () => {
    const dataDb = createMockDataDB();

    const workspace1: Workspace = {
      workspace_id: "workspace-1",
      directory: "/test1",
      opencode_port: 3001,
      opencode_pid: 12345,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace1);

    const workspace2: Workspace = {
      workspace_id: "workspace-2",
      directory: "/test2",
      opencode_port: 3002,
      opencode_pid: 54321,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace2);

    // workspace-1: throws error
    // workspace-2: valid
    const opencodeManager = createMockOpenCodeManager(async (_port: number, _pid: number, workspaceId: string) => {
      if (workspaceId === "workspace-1") {
        throw new Error("Connection refused");
      }
      return true;
    });

    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const data = (await res.json()) as BatchHealthResponse;
    expect(data).toHaveLength(2);

    const ws1 = data.find((w) => w.workspaceId === "workspace-1");
    const ws2 = data.find((w) => w.workspaceId === "workspace-2");

    expect(ws1).toEqual({
      workspaceId: "workspace-1",
      opencodeRunning: false,
      port: 3001,
      pid: 12345,
      error: "Connection refused",
    });

    expect(ws2).toEqual({
      workspaceId: "workspace-2",
      opencodeRunning: true,
      port: 3002,
      pid: 54321,
      error: null,
    });
  });
});

describe("POST /api/workspace/:id/restart", () => {
  test("returns 404 when workspace doesn't exist", async () => {
    const dataDb = createMockDataDB();
    const opencodeManager = createMockOpenCodeManager();
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/nonexistent-workspace/restart", { method: "POST" });

    expect(res.status).toBe(404);
    const data = (await res.json()) as ErrorResponse;
    expect(data).toEqual({ error: "Workspace not found" });
  });

  test("returns success when OpenCode is running and gets shut down", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: 3001,
      opencode_pid: 12345,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    let restartCalled = false;
    const opencodeManager = createMockOpenCodeManager(undefined, undefined, async (workspaceId: string) => {
      restartCalled = true;
      expect(workspaceId).toBe("test-workspace");
      return { port: 3001, pid: 12345 };
    });

    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/test-workspace/restart", { method: "POST" });

    expect(res.status).toBe(200);
    const data = (await res.json()) as RestartResponse;
    expect(data).toEqual({
      success: true,
      message: "Workspace environment restarted",
      port: 3001,
      pid: 12345,
    });
    expect(restartCalled).toBe(true);
  });

  test("returns success even when OpenCode is not running (no-op)", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: null,
      opencode_pid: null,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    let restartCalled = false;
    const opencodeManager = createMockOpenCodeManager(undefined, undefined, async () => {
      restartCalled = true;
      return { port: 3002, pid: 54321 };
    });

    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/test-workspace/restart", { method: "POST" });

    expect(res.status).toBe(200);
    const data = (await res.json()) as RestartResponse;
    expect(data).toEqual({
      success: true,
      message: "Workspace environment restarted",
      port: 3002,
      pid: 54321,
    });
    expect(restartCalled).toBe(true);
  });

  test("returns 500 when restart fails", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: 3001,
      opencode_pid: 12345,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    const opencodeManager = createMockOpenCodeManager(undefined, undefined, async () => {
      throw new Error("Failed to kill process");
    });

    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/test-workspace/restart", { method: "POST" });

    expect(res.status).toBe(500);
    const data = (await res.json()) as RestartResponse;
    expect(data).toEqual({
      success: false,
      message: "Failed to kill process",
    });
  });
});

describe("POST /api/workspace/:id/start", () => {
  test("returns 404 when workspace doesn't exist", async () => {
    const dataDb = createMockDataDB();
    const opencodeManager = createMockOpenCodeManager();
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/nonexistent-workspace/start", { method: "POST" });

    expect(res.status).toBe(404);
    const data = (await res.json()) as ErrorResponse;
    expect(data).toEqual({ error: "Workspace not found" });
  });

  test("returns 202 immediately without waiting for spawn", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: null,
      opencode_pid: null,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    // Spawn takes a long time — endpoint should return before it completes
    let spawnCompleted = false;
    const opencodeManager = createMockOpenCodeManager(undefined, undefined, undefined, async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      spawnCompleted = true;
      return { port: 3001, pid: 12345 };
    });

    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/test-workspace/start", { method: "POST" });

    // Should return 202 immediately, before spawn completes
    expect(res.status).toBe(202);
    expect(spawnCompleted).toBe(false);
  });

  test("calls getOrSpawnOpenCode in the background", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: null,
      opencode_pid: null,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    let spawnCalledWith: string | null = null;
    const opencodeManager = createMockOpenCodeManager(undefined, undefined, undefined, async (workspaceId) => {
      spawnCalledWith = workspaceId;
      return { port: 3001, pid: 12345 };
    });

    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    await app.request("/test-workspace/start", { method: "POST" });

    // Wait briefly for the fire-and-forget to run
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(spawnCalledWith).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: checked above
    expect(spawnCalledWith!).toBe("test-workspace");
  });
});

describe("GET /api/workspace/:id/logs", () => {
  test("returns 404 when workspace doesn't exist", async () => {
    const dataDb = createMockDataDB();
    const opencodeManager = createMockOpenCodeManager();
    const app = new Hono();
    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/nonexistent-workspace/logs");

    expect(res.status).toBe(404);
    const data = (await res.json()) as ErrorResponse;
    expect(data).toEqual({ error: "Workspace not found" });
  });

  test("returns available:false when OPENCODE_PATH is not set (prod mode)", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "test-workspace",
      directory: "/test",
      opencode_port: null,
      opencode_pid: null,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    const opencodeManager = createMockOpenCodeManager();
    const app = new Hono();

    // Simulate prod mode: OPENCODE_PATH not set
    const savedEnv = process.env.OPENCODE_PATH;
    delete process.env.OPENCODE_PATH;

    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/test-workspace/logs");

    // Restore env
    if (savedEnv !== undefined) {
      process.env.OPENCODE_PATH = savedEnv;
    }

    expect(res.status).toBe(200);
    const data = (await res.json()) as { lines: string[]; available: boolean; reason?: string };
    expect(data.available).toBe(false);
    expect(data.reason).toBe("logs_in_server_log");
    expect(data.lines).toEqual([]);
  });

  test("returns empty lines when log file does not exist yet (dev mode)", async () => {
    const dataDb = createMockDataDB();
    const workspace: Workspace = {
      workspace_id: "nonexistent-workspace-log",
      directory: "/test",
      opencode_port: null,
      opencode_pid: null,
      created_at: "2024-01-01T00:00:00.000Z",
      last_used: "2024-01-01T00:00:00.000Z",
    };
    dataDb.insertWorkspace(workspace);

    const opencodeManager = createMockOpenCodeManager();
    const app = new Hono();

    // Simulate dev mode
    const savedEnv = process.env.OPENCODE_PATH;
    process.env.OPENCODE_PATH = "/some/path";

    app.route("/", createWorkspaceRoutes(dataDb, opencodeManager));

    const res = await app.request("/nonexistent-workspace-log/logs");

    // Restore env
    if (savedEnv !== undefined) {
      process.env.OPENCODE_PATH = savedEnv;
    } else {
      delete process.env.OPENCODE_PATH;
    }

    expect(res.status).toBe(200);
    const data = (await res.json()) as { lines: string[]; available: boolean };
    expect(data.available).toBe(true);
    expect(data.lines).toEqual([]);
  });
});
