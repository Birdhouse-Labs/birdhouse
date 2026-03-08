// ABOUTME: Tests startup workspace warmup behavior for recent workspaces.
// ABOUTME: Verifies warmup is limited, sequential, and resilient to workspace failures.

import { describe, expect, test } from "bun:test";
import type { Workspace } from "./data-db";
import { warmRecentWorkspacesInBackground } from "./startup-warmup";

function createWorkspace(workspaceId: string): Workspace {
  const now = new Date().toISOString();
  return {
    workspace_id: workspaceId,
    directory: `/tmp/${workspaceId}`,
    opencode_port: null,
    opencode_pid: null,
    created_at: now,
    last_used: now,
  };
}

async function flushMicrotasks(count = 5): Promise<void> {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
}

describe("warmRecentWorkspacesInBackground", () => {
  test("warms only the five most recent workspaces", async () => {
    const started: string[] = [];
    const workspaces = ["ws-1", "ws-2", "ws-3", "ws-4", "ws-5", "ws-6"].map(createWorkspace);

    warmRecentWorkspacesInBackground(
      {
        getAllWorkspaces: () => workspaces,
      },
      {
        getOrSpawnOpenCode: async (workspaceId: string) => {
          started.push(workspaceId);
          return { port: 1, pid: 1 };
        },
      },
    );

    await flushMicrotasks();

    expect(started).toEqual(["ws-1", "ws-2", "ws-3", "ws-4", "ws-5"]);
  });

  test("defers warmup work until after startup returns", async () => {
    const started: string[] = [];

    warmRecentWorkspacesInBackground(
      {
        getAllWorkspaces: () => [createWorkspace("ws-1")],
      },
      {
        getOrSpawnOpenCode: async (workspaceId: string) => {
          started.push(workspaceId);
          return { port: 1, pid: 1 };
        },
      },
    );

    expect(started).toEqual([]);

    await flushMicrotasks();

    expect(started).toEqual(["ws-1"]);
  });

  test("warms workspaces sequentially in the background", async () => {
    const started: string[] = [];
    const workspaces = [createWorkspace("ws-1"), createWorkspace("ws-2")];
    let releaseFirst: (() => void) | undefined;

    warmRecentWorkspacesInBackground(
      {
        getAllWorkspaces: () => workspaces,
      },
      {
        getOrSpawnOpenCode: async (workspaceId: string) => {
          started.push(workspaceId);

          if (workspaceId === "ws-1") {
            await new Promise<void>((resolve) => {
              releaseFirst = resolve;
            });
          }

          return { port: 1, pid: 1 };
        },
      },
    );

    await flushMicrotasks(1);

    expect(started).toEqual(["ws-1"]);

    releaseFirst?.();
    await flushMicrotasks();

    expect(started).toEqual(["ws-1", "ws-2"]);
  });

  test("continues warming later workspaces after a failure", async () => {
    const started: string[] = [];
    const workspaces = [createWorkspace("ws-1"), createWorkspace("ws-2"), createWorkspace("ws-3")];

    warmRecentWorkspacesInBackground(
      {
        getAllWorkspaces: () => workspaces,
      },
      {
        getOrSpawnOpenCode: async (workspaceId: string) => {
          started.push(workspaceId);

          if (workspaceId === "ws-2") {
            throw new Error("boom");
          }

          return { port: 1, pid: 1 };
        },
      },
    );

    await flushMicrotasks();

    expect(started).toEqual(["ws-1", "ws-2", "ws-3"]);
  });
});
