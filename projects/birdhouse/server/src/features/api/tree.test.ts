// ABOUTME: Tests for agent tree visualization endpoint
// ABOUTME: Validates tree formatting with proper indentation and model display

import { beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { clearCapturedLogs, createTestDeps, withDeps } from "../../dependencies";
import type { AgentsDB } from "../../lib/agents-db";
import { createChildAgent, createRootAgent } from "../../test-utils/agent-factories";
import { getTree } from "./tree";

describe("GET /api/agents/:id/tree", () => {
  let app: Hono;
  let agentsDB: AgentsDB;

  beforeEach(async () => {
    clearCapturedLogs();
    const deps = await createTestDeps();
    agentsDB = deps.agentsDB;

    app = new Hono();
    app.get("/:id/tree", (c) => withDeps(deps, () => getTree(c, deps)));
  });

  it("should return formatted tree for single agent", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_single",
      session_id: "ses_single",
      title: "Solo Agent",
    });

    const response = await app.request(`/${agent.id}/tree`);
    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).toContain("[Solo Agent](birdhouse:agent/agent_single)");
    expect(text).toContain("**L0**");
    expect(text).toContain("`claude-sonnet-4`");
    expect(text).toContain("- [Solo Agent]"); // Root agent should start with -
  });

  it("should return formatted tree with parent and children", async () => {
    const parent = createRootAgent(agentsDB, {
      id: "agent_parent",
      session_id: "ses_parent",
      title: "Parent Agent",
    });

    const child1 = createChildAgent(agentsDB, parent.id, {
      session_id: "ses_child1",
      title: "Child 1",
      model: "anthropic/claude-haiku-4",
    });

    const child2 = createChildAgent(agentsDB, parent.id, {
      session_id: "ses_child2",
      title: "Child 2",
      model: "anthropic/claude-opus-4",
    });

    const response = await app.request(`/${parent.id}/tree`);
    expect(response.status).toBe(200);

    const text = await response.text();

    // Check parent (no indentation, level 0)
    expect(text).toContain("- [Parent Agent](birdhouse:agent/agent_parent) **L0** `claude-sonnet-4`");

    // Check children (2-space indentation, level 1)
    expect(text).toContain(`  - [Child 1](birdhouse:agent/${child1.id}) **L1** \`claude-haiku-4\``);
    expect(text).toContain(`  - [Child 2](birdhouse:agent/${child2.id}) **L1** \`claude-opus-4\``);
  });

  it("should return formatted tree with grandchildren (multi-level)", async () => {
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

    const grandchild = createChildAgent(agentsDB, child.id, {
      session_id: "ses_grandchild",
      title: "Grandchild",
    });

    const response = await app.request(`/${root.id}/tree`);
    expect(response.status).toBe(200);

    const text = await response.text();

    // Check proper indentation levels with markdown format
    expect(text).toContain(`- [Root](birdhouse:agent/${root.id}) **L0** \`claude-sonnet-4\``); // No indent
    expect(text).toContain(`  - [Child](birdhouse:agent/${child.id}) **L1** \`claude-haiku-4\``); // 2 spaces
    expect(text).toContain(`    - [Grandchild](birdhouse:agent/${grandchild.id}) **L2** \`claude-sonnet-4\``); // 4 spaces
  });

  it("should work when querying child agent (shows full tree)", async () => {
    const root = createRootAgent(agentsDB, {
      id: "agent_root2",
      session_id: "ses_root2",
      title: "Root",
    });

    const child = createChildAgent(agentsDB, root.id, {
      session_id: "ses_child_query",
      title: "Child",
      model: "anthropic/claude-haiku-4",
    });

    // Query using child ID - should still show full tree
    const response = await app.request(`/${child.id}/tree`);
    expect(response.status).toBe(200);

    const text = await response.text();

    // Should show both root and child with markdown format
    expect(text).toContain("[Root](birdhouse:agent/agent_root2) **L0**");
    expect(text).toContain(`[Child](birdhouse:agent/${child.id}) **L1**`);
  });

  it("should return 404 for non-existent agent", async () => {
    const response = await app.request("/agent_nonexistent/tree");
    expect(response.status).toBe(404);

    const error = (await response.json()) as { error: string };
    expect(error.error).toContain("not found");
  });

  it("should format model names correctly", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_model_test",
      session_id: "ses_model_test",
      title: "Model Test",
      model: "anthropic/claude-sonnet-4-5",
    });

    const response = await app.request(`/${agent.id}/tree`);
    expect(response.status).toBe(200);

    const text = await response.text();
    expect(text).toContain("`claude-sonnet-4-5`");
  });

  it("should mark requesting agent with _This is you_", async () => {
    const parent = createRootAgent(agentsDB, {
      id: "agent_you_parent",
      session_id: "ses_you_parent",
      title: "Parent",
    });

    const child1 = createChildAgent(agentsDB, parent.id, {
      session_id: "ses_you_child1",
      title: "Me",
      model: "anthropic/claude-haiku-4",
    });

    const child2 = createChildAgent(agentsDB, parent.id, {
      session_id: "ses_you_child2",
      title: "Sibling",
    });

    // Request tree with child1 as the requesting agent
    const response = await app.request(`/${parent.id}/tree?requesting_agent_id=${child1.id}`);
    expect(response.status).toBe(200);

    const text = await response.text();

    // child1 should have _This is you_ marker at the end
    expect(text).toContain(`[Me](birdhouse:agent/${child1.id}) **L1** \`claude-haiku-4\` _This is you_`);

    // Others should NOT have the marker
    expect(text).toContain(`[Parent](birdhouse:agent/${parent.id}) **L0**`);
    expect(text).not.toMatch(new RegExp(`${parent.id}.*This is you`));
    expect(text).toContain(`[Sibling](birdhouse:agent/${child2.id}) **L1**`);
    expect(text).not.toMatch(new RegExp(`${child2.id}.*This is you`));
  });

  it("should mark root agent with _This is you_ when they are the requester", async () => {
    const root = createRootAgent(agentsDB, {
      id: "agent_root_header",
      session_id: "ses_root_header",
      title: "Root Agent",
    });

    // Request tree as the root agent (tree_id === agent_id for roots)
    const response = await app.request(`/${root.id}/tree?requesting_agent_id=${root.id}`);
    expect(response.status).toBe(200);

    const text = await response.text();

    // Root should have _This is you_ marker and show the link
    expect(text).toContain(`[Root Agent](birdhouse:agent/${root.id}) **L0** \`claude-sonnet-4\` _This is you_`);
  });
});
