// ABOUTME: Tests for aapi export markdown endpoint
// ABOUTME: Verifies file writing, directory creation, and response format

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Hono } from "hono";
import { createTestDeps, withDeps } from "../../dependencies";
import { createAgentsDB } from "../../lib/agents-db";
import type { Message } from "../../lib/opencode-client";
import { createRootAgent } from "../../test-utils/agent-factories";
import { exportMarkdown } from "./export-markdown";

describe("AAPI export-markdown", () => {
  let agentsDB: ReturnType<typeof createAgentsDB>;
  let tmpDir: string;
  let originalWorkspaceRoot: string | undefined;

  beforeEach(async () => {
    agentsDB = createAgentsDB(":memory:");

    // Create temporary directory for test files
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "birdhouse-test-"));

    // Store original env var
    originalWorkspaceRoot = process.env.BIRDHOUSE_WORKSPACE_ROOT;

    // Set workspace root to tmp directory
    process.env.BIRDHOUSE_WORKSPACE_ROOT = tmpDir;
  });

  afterEach(async () => {
    // Restore original env var
    if (originalWorkspaceRoot === undefined) {
      delete process.env.BIRDHOUSE_WORKSPACE_ROOT;
    } else {
      process.env.BIRDHOUSE_WORKSPACE_ROOT = originalWorkspaceRoot;
    }

    // Clean up temporary directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("POST /aapi/agents/:id/export - Success scenarios", () => {
    test("returns JSON with filepath, filename, and agent_id", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
      });

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toContain("application/json");

        const body = (await response.json()) as {
          filepath: string;
          filename: string;
          agent_id: string;
        };

        expect(body.filepath).toBeDefined();
        expect(body.filename).toBe(`${agent.id}.md`);
        expect(body.agent_id).toBe(agent.id);
        expect(body.filepath).toContain(body.filename);
      });
    });

    test("writes file to disk with correct markdown content", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
        title: "Content Test Agent",
        created_at: 1704067200000,
        updated_at: 1704153600000,
      });

      const userMessage: Message = {
        info: {
          id: "msg_user",
          sessionID: agent.session_id,
          role: "user",
          time: { created: 1704067200000 },
          model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
          agent: "birdhouse",
        },
        parts: [
          {
            type: "text",
            text: "Hello test",
            id: "part_1",
            sessionID: agent.session_id,
            messageID: "msg_user",
          },
        ],
      };

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;
      deps.opencode.getMessages = async () => [userMessage];

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { filepath: string };

        // Verify file exists
        const fileExists = await fs
          .access(body.filepath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);

        // Read and verify file content
        const content = await fs.readFile(body.filepath, "utf-8");
        expect(content).toContain("# Content Test Agent");
        expect(content).toContain(`**Agent ID:** ${agent.id}`);
        expect(content).toContain("## User");
        expect(content).toContain("Hello test");
      });
    });

    test("creates directory if it doesn't exist (mkdir -p behavior)", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
      });

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const nestedDir = "deeply/nested/directory/structure";

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: nestedDir }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { filepath: string };

        // Verify directory was created
        const dirPath = path.join(tmpDir, nestedDir);
        const dirExists = await fs
          .access(dirPath)
          .then(() => true)
          .catch(() => false);
        expect(dirExists).toBe(true);

        // Verify file was written
        const fileExists = await fs
          .access(body.filepath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);
      });
    });

    test("resolves relative paths against BIRDHOUSE_WORKSPACE_ROOT", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
      });

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "relative/path" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { filepath: string };

        // Verify filepath is absolute and under workspace root
        expect(path.isAbsolute(body.filepath)).toBe(true);
        expect(body.filepath).toContain(tmpDir);
        expect(body.filepath).toContain("relative/path");
      });
    });

    test("handles absolute paths correctly", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
      });

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const absolutePath = path.join(tmpDir, "absolute-exports");

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: absolutePath }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { filepath: string };

        // Verify filepath uses the absolute path as-is
        expect(body.filepath).toContain(absolutePath);
        expect(body.filepath).not.toContain(path.join(tmpDir, tmpDir)); // No double nesting
      });
    });

    test("overwrites existing file (idempotent exports)", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
      });

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        // First export
        const response1 = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response1.status).toBe(200);

        const body1 = (await response1.json()) as { filepath: string };
        const content1 = await fs.readFile(body1.filepath, "utf-8");

        // Second export (should overwrite)
        const response2 = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response2.status).toBe(200);

        const body2 = (await response2.json()) as { filepath: string };

        // Same filepath
        expect(body2.filepath).toBe(body1.filepath);

        const content2 = await fs.readFile(body2.filepath, "utf-8");

        // Content should be the same (idempotent)
        expect(content2).toBe(content1);
      });
    });

    test("filename format: {agent_id}.md", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
        title: "Fix: API/HTTP Errors!",
      });

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { filename: string; agent_id: string };

        // Verify filename format: agent_id.md
        expect(body.filename).toBe(`${body.agent_id}.md`);
        expect(body.filename).toMatch(/^agent_.+\.md$/);
      });
    });
  });

  describe("POST /aapi/agents/:id/export - Error scenarios", () => {
    test("returns 404 when agent not found", async () => {
      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const response = await app.request("/nonexistent/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(404);
        const body = (await response.json()) as { error: string };
        expect(body.error).toContain("Agent nonexistent not found");
      });
    });

    test("returns 400 when directory parameter is missing", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
      });

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        expect(response.status).toBe(400);
        const body = (await response.json()) as { error: string };
        expect(body.error).toContain("directory parameter is required");
      });
    });

    test("returns 500 on file write errors", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
      });

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        // Use an invalid path that will cause a write error
        // /dev/null is a special file that can't be used as a directory
        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "/dev/null/invalid" }),
        });

        expect(response.status).toBe(500);
        const body = (await response.json()) as { error: string };
        expect(body.error).toBeDefined();
      });
    });
  });

  describe("POST /aapi/agents/:id/export - Validation", () => {
    test("response does NOT contain markdown content", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
      });

      const userMessage: Message = {
        info: {
          id: "msg_user",
          sessionID: agent.session_id,
          role: "user",
          time: { created: 1704067200000 },
          model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
          agent: "birdhouse",
        },
        parts: [
          {
            type: "text",
            text: "This is sensitive content that should not be in the response",
            id: "part_1",
            sessionID: agent.session_id,
            messageID: "msg_user",
          },
        ],
      };

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;
      deps.opencode.getMessages = async () => [userMessage];

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as {
          filepath: string;
          filename: string;
          agent_id: string;
        };

        // Verify response only has metadata (no markdown content)
        expect(Object.keys(body)).toEqual(["filepath", "filename", "agent_id"]);

        const bodyStr = JSON.stringify(body);
        expect(bodyStr).not.toContain("This is sensitive content");
        expect(bodyStr).not.toContain("## User");
        expect(bodyStr).not.toContain("# Test Agent");
      });
    });

    test("filepath is absolute path", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
      });

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { filepath: string };

        // Verify filepath is absolute
        expect(path.isAbsolute(body.filepath)).toBe(true);
      });
    });

    test("file content matches expected markdown format", async () => {
      const agent = createRootAgent(agentsDB, {
        session_id: "ses_test",
        id: "agent_test",
        title: "Format Test Agent",
        created_at: 1704067200000,
        updated_at: 1704153600000,
      });

      const userMessage: Message = {
        info: {
          id: "msg_user",
          sessionID: agent.session_id,
          role: "user",
          time: { created: 1704067200000 },
          model: { providerID: "anthropic", modelID: "claude-sonnet-4" },
          agent: "birdhouse",
        },
        parts: [
          {
            type: "text",
            text: "Test message",
            id: "part_1",
            sessionID: agent.session_id,
            messageID: "msg_user",
          },
        ],
      };

      const deps = createTestDeps();
      deps.agentsDB = agentsDB;
      deps.opencode.getMessages = async () => [userMessage];

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export", (c) => exportMarkdown(c, deps));

        const response = await app.request(`/${agent.id}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { filepath: string };
        const content = await fs.readFile(body.filepath, "utf-8");

        // Verify markdown format follows spec
        expect(content).toContain("# Format Test Agent"); // Title
        expect(content).toContain(`**Agent ID:** ${agent.id}`); // Agent ID
        expect(content).toContain("**Created:**"); // Timestamps
        expect(content).toContain("**Last Updated:**");
        expect(content).toContain("---"); // Separator
        expect(content).toContain("## User"); // Message section
        expect(content).toContain("Test message"); // Message content
      });
    });
  });
});
