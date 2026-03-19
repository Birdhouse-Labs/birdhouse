// ABOUTME: Integration tests for workspace-scoped skills API routes.
// ABOUTME: Verifies skill normalization, detail loading, and trigger phrase persistence.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createTestDeps, withDeps } from "../dependencies";
import { DataDB, type Workspace } from "../lib/data-db";
import { runMigrations } from "../lib/migrations/run-migrations";
import type { Skill } from "../lib/opencode-client";
import { captureStreamEvents, createTestApp } from "../test-utils";
import { createSkillRoutes } from "./skills";

const TEST_DB_PATH_BASE = join(import.meta.dir, "..", "lib", "__fixtures__", "test-skills-routes");

interface SkillsListResponse {
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    scope: "workspace" | "global";
    trigger_phrases: string[];
    readonly: boolean;
  }>;
}

interface SkillDetailResponse {
  id: string;
  name: string;
  description: string;
  tags: string[];
  scope: "workspace" | "global";
  trigger_phrases: string[];
  readonly: boolean;
  content: string;
  location: string;
  display_location: string;
  files: string[];
  metadata: Record<string, unknown>;
}

interface SkillAttachmentsPreviewResponse {
  attachments: Array<{
    name: string;
    content: string;
  }>;
}

function createWorkspace(workspaceId: string, directory: string): Workspace {
  const now = new Date().toISOString();
  return {
    workspace_id: workspaceId,
    directory,
    title: workspaceId,
    opencode_port: null,
    opencode_pid: null,
    created_at: now,
    last_used: now,
  };
}

function createSkillsApp(testDb: DataDB, workspace: Workspace) {
  const app = createTestApp({ workspace });
  app.route("/", createSkillRoutes(testDb));
  return app;
}

describe("workspace skills routes", () => {
  let testDb: DataDB;
  let testDbPath: string;
  let tempDirs: string[];

  beforeEach(async () => {
    tempDirs = [];
    testDbPath = `${TEST_DB_PATH_BASE}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }

    await runMigrations(testDbPath);
    testDb = new DataDB(testDbPath);
  });

  afterEach(() => {
    testDb.close();
    for (const tempDir of tempDirs) {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  function createSkillDirectory(files: Record<string, string>): string {
    const tempDir = mkdtempSync(join(tmpdir(), "birdhouse-skill-"));
    tempDirs.push(tempDir);

    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = join(tempDir, relativePath);
      mkdirSync(join(filePath, ".."), { recursive: true });
      writeFileSync(filePath, content, "utf-8");
    }

    return tempDir;
  }

  test("lists visible skills with normalized scope and stored trigger phrases", async () => {
    const workspace = createWorkspace("ws_1", "/repo/current-workspace");
    testDb.insertWorkspace(workspace);
    testDb.setSkillTriggerPhrases("find-docs", ["look up framework docs"]);

    const deps = createTestDeps({
      listSkills: async () =>
        [
          {
            name: "git/spotlight-worktree",
            description: "Keep a main clone aligned with a worktree.",
            location: "/repo/current-workspace/.agents/skills/git/spotlight-worktree/SKILL.md",
            content: "# Workspace skill",
          },
          {
            name: "find-docs",
            description: "Retrieve current library docs.",
            location: "/Users/test/.claude/skills/find-docs/SKILL.md",
            content: "# Shared skill",
          },
        ] satisfies Skill[],
    });

    await withDeps(deps, async () => {
      const app = createSkillsApp(testDb, workspace);
      const response = await app.request("/");

      expect(response.status).toBe(200);
      const data = (await response.json()) as SkillsListResponse;
      expect(data).toEqual({
        skills: [
          {
            id: "find-docs",
            name: "find-docs",
            description: "Retrieve current library docs.",
            tags: [],
            scope: "global",
            trigger_phrases: ["look up framework docs"],
            readonly: true,
          },
          {
            id: "git/spotlight-worktree",
            name: "git/spotlight-worktree",
            description: "Keep a main clone aligned with a worktree.",
            tags: [],
            scope: "workspace",
            trigger_phrases: [],
            readonly: true,
          },
        ],
      });
    });
  });

  test("loads a single skill detail using an encoded skill name", async () => {
    const skillDir = createSkillDirectory({
      "SKILL.md": `---
name: git/spotlight-worktree
description: Keep a main clone aligned with a worktree.
license: MIT
compatibility: opencode
tags:
  - git
  - release
metadata:
  audience: maintainers
  workflow: git
---

# Git Spotlight`,
      "scripts/spotlight.sh": "echo spotlight",
      "reference/notes.md": "notes",
      "examples/demo.txt": "demo",
    });
    const workspace = createWorkspace("ws_1", dirname(skillDir));
    testDb.insertWorkspace(workspace);
    testDb.setSkillTriggerPhrases("git/spotlight-worktree", ["spotlight this branch"]);

    const deps = createTestDeps({
      listSkills: async () =>
        [
          {
            name: "git/spotlight-worktree",
            description: "Keep a main clone aligned with a worktree.",
            location: join(skillDir, "SKILL.md"),
            content: "# Git Spotlight",
          },
        ] satisfies Skill[],
    });

    await withDeps(deps, async () => {
      const app = createSkillsApp(testDb, workspace);
      const response = await app.request(`/${encodeURIComponent("git/spotlight-worktree")}`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as SkillDetailResponse;
      expect(data).toEqual({
        id: "git/spotlight-worktree",
        name: "git/spotlight-worktree",
        description: "Keep a main clone aligned with a worktree.",
        tags: ["git", "release"],
        scope: "workspace",
        trigger_phrases: ["spotlight this branch"],
        readonly: true,
        content: "# Git Spotlight",
        location: join(skillDir, "SKILL.md"),
        display_location: join(skillDir, "SKILL.md"),
        files: ["examples/demo.txt", "reference/notes.md", "scripts/spotlight.sh"],
        metadata: {
          name: "git/spotlight-worktree",
          description: "Keep a main clone aligned with a worktree.",
          license: "MIT",
          compatibility: "opencode",
          tags: ["git", "release"],
          metadata: {
            audience: "maintainers",
            workflow: "git",
          },
        },
      });
    });
  });

  test("returns an empty file list when the skill directory only contains SKILL.md", async () => {
    const workspace = createWorkspace("ws_1", "/repo/current-workspace");
    testDb.insertWorkspace(workspace);
    const skillDir = createSkillDirectory({
      "SKILL.md": "# Find Docs",
    });

    const deps = createTestDeps({
      listSkills: async () =>
        [
          {
            name: "find-docs",
            description: "Retrieve current library docs.",
            location: join(skillDir, "SKILL.md"),
            content: "# Find Docs",
          },
        ] satisfies Skill[],
    });

    await withDeps(deps, async () => {
      const app = createSkillsApp(testDb, workspace);
      const response = await app.request(`/${encodeURIComponent("find-docs")}`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as SkillDetailResponse;
      expect(data.files).toEqual([]);
      expect(data.display_location).toBe(join(skillDir, "SKILL.md"));
    });
  });

  test("updates trigger phrases for a visible skill", async () => {
    const workspace = createWorkspace("ws_1", "/repo/current-workspace");
    testDb.insertWorkspace(workspace);

    const deps = createTestDeps({
      listSkills: async () =>
        [
          {
            name: "find-docs",
            description: "Retrieve current library docs.",
            location: "/Users/test/.claude/skills/find-docs/SKILL.md",
            content: "# Shared skill",
          },
        ] satisfies Skill[],
    });

    await withDeps(deps, async () => {
      const app = createSkillsApp(testDb, workspace);
      const updateResponse = await app.request(`/${encodeURIComponent("find-docs")}/trigger-phrases`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["  docs please  ", "reference the docs"],
        }),
      });

      expect(updateResponse.status).toBe(200);
      expect(await updateResponse.json()).toEqual({
        name: "find-docs",
        trigger_phrases: ["docs please", "reference the docs"],
      });

      const detailResponse = await app.request(`/${encodeURIComponent("find-docs")}`);
      const detail = (await detailResponse.json()) as SkillDetailResponse;
      expect(detail.trigger_phrases).toEqual(["docs please", "reference the docs"]);
    });
  });

  test("reloads workspace skills via the OpenCode skill reload endpoint", async () => {
    const workspace = createWorkspace("ws_1", "/repo/current-workspace");
    testDb.insertWorkspace(workspace);
    let reloadCalled = 0;

    const deps = createTestDeps({
      reloadSkillState: async () => {
        reloadCalled += 1;
      },
    });

    await withDeps(deps, async () => {
      const app = createSkillsApp(testDb, workspace);
      const response = await app.request("/reload", {
        method: "POST",
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(reloadCalled).toBe(1);
    });
  });

  test("emits birdhouse.skill.updated after updating trigger phrases", async () => {
    const workspace = createWorkspace("ws_1", "/repo/current-workspace");
    testDb.insertWorkspace(workspace);

    const deps = createTestDeps({
      listSkills: async () =>
        [
          {
            name: "find-docs",
            description: "Retrieve current library docs.",
            location: "/Users/test/.claude/skills/find-docs/SKILL.md",
            content: "# Shared skill",
          },
        ] satisfies Skill[],
    });

    await withDeps(deps, async () => {
      const { events, cleanup } = await captureStreamEvents();
      const app = createSkillsApp(testDb, workspace);

      const updateResponse = await app.request(`/${encodeURIComponent("find-docs")}/trigger-phrases`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["docs please"],
        }),
      });

      expect(updateResponse.status).toBe(200);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: "birdhouse.skill.updated",
        properties: {
          skillName: "find-docs",
        },
      });

      cleanup();
    });
  });

  test("previews only explicitly linked skill attachments using the shared server parser", async () => {
    const workspace = createWorkspace("ws_1", "/repo/current-workspace");
    testDb.insertWorkspace(workspace);
    testDb.setSkillTriggerPhrases("find-docs", ["docs please"]);
    testDb.setSkillTriggerPhrases("git/spotlight-worktree", ["spotlight this branch"]);

    const deps = createTestDeps({
      listSkills: async () =>
        [
          {
            name: "find-docs",
            description: "Retrieve current library docs.",
            location: "/Users/test/.claude/skills/find-docs/SKILL.md",
            content: "# Find Docs",
          },
          {
            name: "git/spotlight-worktree",
            description: "Keep a main clone aligned with a worktree.",
            location: "/repo/current-workspace/.agents/skills/git/spotlight-worktree/SKILL.md",
            content: "# Spotlight",
          },
        ] satisfies Skill[],
    });

    await withDeps(deps, async () => {
      const app = createSkillsApp(testDb, workspace);
      const response = await app.request("/attachments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Use [docs helper](birdhouse:skill/find-docs) and [spotlight](birdhouse:skill/git%2Fspotlight-worktree).",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as SkillAttachmentsPreviewResponse;
      expect(data).toEqual({
        attachments: [
          {
            name: "find-docs",
            content: "# Find Docs",
          },
          {
            name: "git/spotlight-worktree",
            content: "# Spotlight",
          },
        ],
      });
    });
  });

  test("does not preview raw trigger phrase text without explicit skill links", async () => {
    const workspace = createWorkspace("ws_1", "/repo/current-workspace");
    testDb.insertWorkspace(workspace);
    testDb.setSkillTriggerPhrases("find-docs", ["docs please"]);

    const deps = createTestDeps({
      listSkills: async () =>
        [
          {
            name: "find-docs",
            description: "Retrieve current library docs.",
            location: "/Users/test/.claude/skills/find-docs/SKILL.md",
            content: "# Find Docs",
          },
        ] satisfies Skill[],
    });

    await withDeps(deps, async () => {
      const app = createSkillsApp(testDb, workspace);
      const response = await app.request("/attachments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "docs please before you start",
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as SkillAttachmentsPreviewResponse;
      expect(data).toEqual({ attachments: [] });
    });
  });

  test("rejects invalid trigger phrase updates", async () => {
    const workspace = createWorkspace("ws_1", "/repo/current-workspace");
    testDb.insertWorkspace(workspace);

    const deps = createTestDeps({
      listSkills: async () =>
        [
          {
            name: "find-docs",
            description: "Retrieve current library docs.",
            location: "/Users/test/.claude/skills/find-docs/SKILL.md",
            content: "# Shared skill",
          },
        ] satisfies Skill[],
    });

    await withDeps(deps, async () => {
      const app = createSkillsApp(testDb, workspace);
      const response = await app.request(`/${encodeURIComponent("find-docs")}/trigger-phrases`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["duplicate", " duplicate "],
        }),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "trigger_phrases must not contain duplicates",
      });
    });
  });

  test("shares trigger phrase metadata across workspaces because skill identity is name-only in v1", async () => {
    const workspaceA = createWorkspace("ws_a", "/repo/workspace-a");
    const workspaceB = createWorkspace("ws_b", "/repo/workspace-b");
    testDb.insertWorkspace(workspaceA);
    testDb.insertWorkspace(workspaceB);

    const deps = createTestDeps({
      listSkills: async () =>
        [
          {
            name: "find-docs",
            description: "Retrieve current library docs.",
            location: "/Users/test/.claude/skills/find-docs/SKILL.md",
            content: "# Shared skill",
          },
        ] satisfies Skill[],
    });

    await withDeps(deps, async () => {
      const appA = createSkillsApp(testDb, workspaceA);
      const appB = createSkillsApp(testDb, workspaceB);

      const updateResponse = await appA.request(`/${encodeURIComponent("find-docs")}/trigger-phrases`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_phrases: ["shared docs trigger"],
        }),
      });
      expect(updateResponse.status).toBe(200);

      const detailResponse = await appB.request(`/${encodeURIComponent("find-docs")}`);
      expect(detailResponse.status).toBe(200);
      const detail = (await detailResponse.json()) as SkillDetailResponse;
      expect(detail.trigger_phrases).toEqual(["shared docs trigger"]);
    });
  });
});
