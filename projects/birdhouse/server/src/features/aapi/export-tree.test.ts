// ABOUTME: Tests for aapi export-tree endpoint
// ABOUTME: Verifies tree export, depth-first ordering, file creation, and error handling

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Hono } from "hono";
import { createTestDeps, withDeps } from "../../dependencies";
import type { AgentRow, AgentsDB } from "../../lib/agents-db";
import { initAgentsDB } from "../../lib/agents-db";
import type { Message } from "../../lib/opencode-client";
import { createChildAgent, createRootAgent } from "../../test-utils/agent-factories";
import { exportTree } from "./export-tree";

describe("AAPI export-tree", () => {
  let agentsDB: AgentsDB;
  let tmpDir: string;
  let originalWorkspaceRoot: string | undefined;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");

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

  describe("POST /aapi/agents/:id/export-tree - Success scenarios", () => {
    test("exports single agent tree successfully", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_single",
        session_id: "ses_single",
        title: "Solo Agent",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toContain("application/json");

        const body = (await response.json()) as {
          success: boolean;
          directory: string;
          files_created: {
            tree: string;
            agent_data: string;
            agents: string[];
          };
          summary: {
            total_agents: number;
            exported_count: number;
            failed_count: number;
            failures: Array<{ agent_id: string; error: string }>;
          };
        };

        expect(body.success).toBe(true);
        expect(body.directory).toBeDefined();
        expect(body.files_created.tree).toBe("tree.md");
        expect(body.files_created.agent_data).toBe("agent_data.txt");
        expect(body.files_created.agents).toEqual(["agent_single.md"]);
        expect(body.summary.total_agents).toBe(1);
        expect(body.summary.exported_count).toBe(1);
        expect(body.summary.failed_count).toBe(0);
      });
    });

    test("creates all expected files (tree.md, agent_data.txt, individual agents)", async () => {
      const root = createRootAgent(agentsDB, {
        id: "agent_root",
        session_id: "ses_root",
        title: "Root Agent",
      });

      const child = createChildAgent(agentsDB, root.id, {
        session_id: "ses_child",
        title: "Child Agent",
        model: "anthropic/claude-haiku-4",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${root.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };
        const exportDir = body.directory;

        // Verify tree.md exists
        const treeExists = await fs
          .access(path.join(exportDir, "tree.md"))
          .then(() => true)
          .catch(() => false);
        expect(treeExists).toBe(true);

        // Verify agent_data.txt exists
        const agentDataExists = await fs
          .access(path.join(exportDir, "agent_data.txt"))
          .then(() => true)
          .catch(() => false);
        expect(agentDataExists).toBe(true);

        // Verify individual agent files exist
        const rootFileExists = await fs
          .access(path.join(exportDir, `${root.id}.md`))
          .then(() => true)
          .catch(() => false);
        expect(rootFileExists).toBe(true);

        const childFileExists = await fs
          .access(path.join(exportDir, `${child.id}.md`))
          .then(() => true)
          .catch(() => false);
        expect(childFileExists).toBe(true);
      });
    });

    test("verifies depth-first ordering in agent_data.txt", async () => {
      // Create tree: Root -> Child1 -> Grandchild1
      //                    -> Child2
      const root = createRootAgent(agentsDB, {
        id: "agent_root",
        session_id: "ses_root",
        title: "Root",
      });

      const child1 = createChildAgent(agentsDB, root.id, {
        session_id: "ses_child1",
        title: "Child1",
        model: "anthropic/claude-haiku-4",
      });

      const grandchild1 = createChildAgent(agentsDB, child1.id, {
        session_id: "ses_grandchild1",
        title: "Grandchild1",
      });

      const child2 = createChildAgent(agentsDB, root.id, {
        session_id: "ses_child2",
        title: "Child2",
        model: "anthropic/claude-opus-4",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${root.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };
        const agentDataPath = path.join(body.directory, "agent_data.txt");
        const content = await fs.readFile(agentDataPath, "utf-8");

        const lines = content.trim().split("\n");

        // Verify depth-first order: Root -> Child1 -> Grandchild1 -> Child2
        expect(lines[0]).toContain("Root|agent_root");
        expect(lines[1]).toContain(`Child1|${child1.id}`);
        expect(lines[2]).toContain(`Grandchild1|${grandchild1.id}`);
        expect(lines[3]).toContain(`Child2|${child2.id}`);
      });
    });

    test("sanitizes pipe characters in titles (agent_data.txt)", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_test",
        session_id: "ses_test",
        title: "Agent | With | Pipes",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };
        const agentDataPath = path.join(body.directory, "agent_data.txt");
        const content = await fs.readFile(agentDataPath, "utf-8");

        // Verify pipes are replaced with fullwidth pipes (｜)
        expect(content).toContain("Agent ｜ With ｜ Pipes|agent_test");
        // Verify no regular pipes in title (only delimiter pipe)
        const lines = content.trim().split("\n");
        const titlePart = lines[0].split("|")[0];
        expect(titlePart).not.toContain("|");
        expect(titlePart).toContain("｜");
      });
    });

    test("sanitizes newlines in titles (agent_data.txt)", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_test",
        session_id: "ses_test",
        title: "Agent\nWith\nNewlines",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };
        const agentDataPath = path.join(body.directory, "agent_data.txt");
        const content = await fs.readFile(agentDataPath, "utf-8");

        // Verify newlines are replaced with spaces
        expect(content).toContain("Agent With Newlines|agent_test");
      });
    });

    test("tree.md contains formatted tree structure", async () => {
      const root = createRootAgent(agentsDB, {
        id: "agent_root",
        session_id: "ses_root",
        title: "Root",
      });

      const child = createChildAgent(agentsDB, root.id, {
        session_id: "ses_child",
        title: "Child",
        model: "anthropic/claude-haiku-4",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${root.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };
        const treePath = path.join(body.directory, "tree.md");
        const content = await fs.readFile(treePath, "utf-8");

        // Verify tree structure
        expect(content).toContain(`- [Root](birdhouse:agent/agent_root) **L0** \`claude-sonnet-4\``);
        expect(content).toContain(`  - [Child](birdhouse:agent/${child.id}) **L1** \`claude-haiku-4\``);
      });
    });

    test("individual agent files contain markdown content", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_test",
        session_id: "ses_test",
        title: "Test Agent",
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

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;
      deps.harness.getMessages = async () => [userMessage];

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };
        const agentPath = path.join(body.directory, `${agent.id}.md`);
        const content = await fs.readFile(agentPath, "utf-8");

        // Verify markdown format
        expect(content).toContain("# Test Agent");
        expect(content).toContain(`**Agent ID:** ${agent.id}`);
        expect(content).toContain("## User");
        expect(content).toContain("Test message");
      });
    });

    test("creates directory if it doesn't exist (mkdir -p behavior)", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_test",
        session_id: "ses_test",
        title: "Test Agent",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const nestedDir = "deeply/nested/directory/structure";

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: nestedDir }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };

        // Verify directory was created
        const dirExists = await fs
          .access(body.directory)
          .then(() => true)
          .catch(() => false);
        expect(dirExists).toBe(true);

        // Verify files were written
        const treeExists = await fs
          .access(path.join(body.directory, "tree.md"))
          .then(() => true)
          .catch(() => false);
        expect(treeExists).toBe(true);
      });
    });

    test("resolves relative paths against BIRDHOUSE_WORKSPACE_ROOT", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_test",
        session_id: "ses_test",
        title: "Test Agent",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "relative/path" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };

        // Verify directory is absolute and under workspace root
        expect(path.isAbsolute(body.directory)).toBe(true);
        expect(body.directory).toContain(tmpDir);
        expect(body.directory).toContain("relative/path");
      });
    });

    test("handles absolute paths correctly", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_test",
        session_id: "ses_test",
        title: "Test Agent",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const absolutePath = path.join(tmpDir, "absolute-exports");

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: absolutePath }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };

        // Verify directory uses the absolute path as-is
        expect(body.directory).toBe(absolutePath);
        expect(body.directory).not.toContain(path.join(tmpDir, tmpDir)); // No double nesting
      });
    });

    test("works when querying child agent (exports full tree)", async () => {
      const root = createRootAgent(agentsDB, {
        id: "agent_root",
        session_id: "ses_root",
        title: "Root",
      });

      const child = createChildAgent(agentsDB, root.id, {
        session_id: "ses_child",
        title: "Child",
        model: "anthropic/claude-haiku-4",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        // Query using child ID - should export full tree
        const response = await app.request(`/${child.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as {
          files_created: { agents: string[] };
          summary: { total_agents: number };
        };

        // Should export both agents
        expect(body.summary.total_agents).toBe(2);
        expect(body.files_created.agents).toContain(`${root.id}.md`);
        expect(body.files_created.agents).toContain(`${child.id}.md`);
      });
    });
  });

  describe("POST /aapi/agents/:id/export-tree - Partial failures", () => {
    test("handles partial failures (some agents export, others fail)", async () => {
      const root = createRootAgent(agentsDB, {
        id: "agent_root",
        session_id: "ses_root",
        title: "Root",
      });

      const child = createChildAgent(agentsDB, root.id, {
        session_id: "ses_child",
        title: "Child",
        model: "anthropic/claude-haiku-4",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      // Mock getMessages to fail for child agent
      deps.harness.getMessages = async (sessionId: string) => {
        if (sessionId === child.session_id) {
          throw new Error("Failed to fetch messages");
        }
        return [];
      };

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${root.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as {
          success: boolean;
          files_created: { agents: string[] };
          summary: {
            total_agents: number;
            exported_count: number;
            failed_count: number;
            failures: Array<{ agent_id: string; error: string }>;
          };
        };

        // Should still succeed overall
        expect(body.success).toBe(true);

        // Should have partial success
        expect(body.summary.total_agents).toBe(2);
        expect(body.summary.exported_count).toBe(1);
        expect(body.summary.failed_count).toBe(1);

        // Should list failed agent
        expect(body.summary.failures).toHaveLength(1);
        expect(body.summary.failures[0].agent_id).toBe(child.id);
        expect(body.summary.failures[0].error).toContain("Failed to fetch messages");

        // Should only have root in successful exports
        expect(body.files_created.agents).toEqual([`${root.id}.md`]);
      });
    });

    test("tree.md and agent_data.txt still created even with partial failures", async () => {
      const root = createRootAgent(agentsDB, {
        id: "agent_root",
        session_id: "ses_root",
        title: "Root",
      });

      const child = createChildAgent(agentsDB, root.id, {
        session_id: "ses_child",
        title: "Child",
        model: "anthropic/claude-haiku-4",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      // Mock to fail for child
      deps.harness.getMessages = async (sessionId: string) => {
        if (sessionId === child.session_id) {
          throw new Error("Mock failure");
        }
        return [];
      };

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${root.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };

        // Verify tree.md exists
        const treeExists = await fs
          .access(path.join(body.directory, "tree.md"))
          .then(() => true)
          .catch(() => false);
        expect(treeExists).toBe(true);

        // Verify agent_data.txt exists
        const agentDataExists = await fs
          .access(path.join(body.directory, "agent_data.txt"))
          .then(() => true)
          .catch(() => false);
        expect(agentDataExists).toBe(true);

        // Verify agent_data.txt contains all agents (even failed ones)
        const agentDataContent = await fs.readFile(path.join(body.directory, "agent_data.txt"), "utf-8");
        expect(agentDataContent).toContain("Root|agent_root");
        expect(agentDataContent).toContain(`Child|${child.id}`);
      });
    });
  });

  describe("POST /aapi/agents/:id/export-tree - Error scenarios", () => {
    test("returns 404 when agent not found", async () => {
      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request("/nonexistent/export-tree", {
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
        id: "agent_test",
        session_id: "ses_test",
        title: "Test Agent",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agent.id}/export-tree`, {
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
        id: "agent_test",
        session_id: "ses_test",
        title: "Test Agent",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        // Use an invalid path that will cause a write error
        const response = await app.request(`/${agent.id}/export-tree`, {
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

  describe("POST /aapi/agents/:id/export-tree - Edge cases", () => {
    test("handles large trees efficiently", async () => {
      // Create a tree with 10 agents
      const root = createRootAgent(agentsDB, {
        id: "agent_root",
        session_id: "ses_root",
        title: "Root",
      });

      const agents = [root];
      for (let i = 1; i <= 9; i++) {
        const agent = createChildAgent(agentsDB, root.id, {
          session_id: `ses_agent${i}`,
          title: `Agent ${i}`,
          model: "anthropic/claude-haiku-4",
        });
        agents.push(agent);
      }

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${root.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as {
          summary: { total_agents: number; exported_count: number };
          files_created: { agents: string[] };
        };

        expect(body.summary.total_agents).toBe(10);
        expect(body.summary.exported_count).toBe(10);
        expect(body.files_created.agents).toHaveLength(10);
      });
    });

    test("handles deeply nested trees", async () => {
      // Create a deep tree: 5 levels
      const agents: AgentRow[] = [];

      const root = createRootAgent(agentsDB, {
        id: "agent_level0",
        session_id: "ses_level0",
        title: "Level 0",
      });
      agents.push(root);

      let parent = root.id;
      for (let level = 1; level < 5; level++) {
        const agent = createChildAgent(agentsDB, parent, {
          session_id: `ses_level${level}`,
          title: `Level ${level}`,
        });
        agents.push(agent);
        parent = agent.id;
      }

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agents[0].id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as {
          summary: { total_agents: number };
          directory: string;
        };

        expect(body.summary.total_agents).toBe(5);

        // Verify depth-first ordering in agent_data.txt
        const agentDataPath = path.join(body.directory, "agent_data.txt");
        const content = await fs.readFile(agentDataPath, "utf-8");
        const lines = content.trim().split("\n");

        expect(lines).toHaveLength(5);
        for (let i = 0; i < 5; i++) {
          expect(lines[i]).toContain(`Level ${i}|`);
        }
      });
    });

    test("handles empty tree (single agent, no children)", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_single",
        session_id: "ses_single",
        title: "Solo",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as {
          summary: { total_agents: number; exported_count: number };
          directory: string;
        };

        expect(body.summary.total_agents).toBe(1);
        expect(body.summary.exported_count).toBe(1);

        // Verify all files exist
        const treeExists = await fs
          .access(path.join(body.directory, "tree.md"))
          .then(() => true)
          .catch(() => false);
        expect(treeExists).toBe(true);

        const agentDataExists = await fs
          .access(path.join(body.directory, "agent_data.txt"))
          .then(() => true)
          .catch(() => false);
        expect(agentDataExists).toBe(true);

        const agentFileExists = await fs
          .access(path.join(body.directory, `${agent.id}.md`))
          .then(() => true)
          .catch(() => false);
        expect(agentFileExists).toBe(true);
      });
    });
  });

  describe("POST /aapi/agents/:id/export-tree - File format validation", () => {
    test("agent_data.txt has correct pipe-delimited format", async () => {
      const root = createRootAgent(agentsDB, {
        id: "agent_root",
        session_id: "ses_root",
        title: "Root Agent",
      });

      const _child = createChildAgent(agentsDB, root.id, {
        session_id: "ses_child",
        title: "Child Agent",
        model: "anthropic/claude-haiku-4",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${root.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as { directory: string };
        const agentDataPath = path.join(body.directory, "agent_data.txt");
        const content = await fs.readFile(agentDataPath, "utf-8");

        const lines = content.trim().split("\n");

        // Each line should have format: title|agent_id
        for (const line of lines) {
          const parts = line.split("|");
          expect(parts).toHaveLength(2);
          expect(parts[0]).toBeTruthy(); // Title
          expect(parts[1]).toMatch(/^agent_/); // Agent ID
        }
      });
    });

    test("individual agent files use {agent_id}.md naming", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_test",
        session_id: "ses_test",
        title: "Test Agent with Special Characters!@#",
      });

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const body = (await response.json()) as {
          files_created: { agents: string[] };
          directory: string;
        };

        // Filename should be agent_id.md (not based on title)
        expect(body.files_created.agents).toEqual(["agent_test.md"]);

        // Verify file exists with correct name
        const fileExists = await fs
          .access(path.join(body.directory, "agent_test.md"))
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);
      });
    });

    test("response does NOT contain sensitive markdown content", async () => {
      const agent = createRootAgent(agentsDB, {
        id: "agent_test",
        session_id: "ses_test",
        title: "Test Agent",
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

      const deps = await createTestDeps();
      deps.agentsDB = agentsDB;
      deps.harness.getMessages = async () => [userMessage];

      await withDeps(deps, async () => {
        const app = new Hono();
        app.post("/:id/export-tree", (c) => exportTree(c, deps));

        const response = await app.request(`/${agent.id}/export-tree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: "exports" }),
        });

        expect(response.status).toBe(200);

        const bodyStr = await response.text();

        // Verify response only has metadata (no markdown content)
        expect(bodyStr).not.toContain("This is sensitive content");
        expect(bodyStr).not.toContain("## User");
      });
    });
  });
});
