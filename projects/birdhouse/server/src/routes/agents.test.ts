// ABOUTME: Unit tests for agent routes using mocked dependencies
// ABOUTME: Tests root agent creation, child agent creation, and tree metadata calculation

import { describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../dependencies";
import type { AgentHarness, BirdhouseMessage as Message, BirdhouseSession as Session } from "../harness";
import type { AgentNode, AgentRow, AgentTree } from "../lib/agents-db";
import { initAgentsDB } from "../lib/agents-db";
import { createAgentTree, createChildAgent, createRootAgent, withWorkspaceContext } from "../test-utils";
import { createAgentRoutes } from "./agents";

// ============================================================================
// Test Helper Functions
// ============================================================================

/**
 * Helper to verify tree structure is valid
 */
function verifyTreeStructure(tree: AgentTree) {
  expect(tree.tree_id).toBe(tree.root.id);
  expect(tree.root.level).toBe(0);
  expect(tree.root.parent_id).toBeNull();

  // Recursively verify all children
  function verifyNode(node: AgentNode, expectedLevel: number) {
    expect(node.level).toBe(expectedLevel);
    for (const child of node.children) {
      expect(child.parent_id).toBe(node.id);
      expect(child.tree_id).toBe(tree.tree_id);
      verifyNode(child, expectedLevel + 1);
    }
  }
  verifyNode(tree.root, 0);
}

/**
 * Helper to count total agents in tree
 */
function countTreeNodes(tree: AgentTree): number {
  function countNode(node: AgentNode): number {
    return 1 + node.children.reduce((sum, child) => sum + countNode(child), 0);
  }
  return countNode(tree.root);
}

describe("POST /api/agents - Create root agent", () => {
  test("creates root agent with level=0 and tree_id=agent.id", async () => {
    const mockSession: Session = {
      id: "ses_root123",
      title: "Root Agent",
      projectID: "birdhouse-playground",
      directory: "/Users/test/projects/birdhouse",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const agentsDB = await initAgentsDB(":memory:");

    const deps = await createTestDeps({
      createSession: async (title?: string) => {
        expect(title).toBe("Root Agent");
        return mockSession;
      },
    });

    // Override agentsDB with our in-memory instance
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Root Agent",
          model: "anthropic/claude-sonnet-4",
        }),
      });

      expect(res.status).toBe(201);
      const agent = (await res.json()) as AgentRow;

      // Verify root agent properties
      expect(agent.id).toMatch(/^agent_/);
      expect(agent.session_id).toBe("ses_root123");
      expect(agent.parent_id).toBe(null);
      expect(agent.level).toBe(0);
      expect(agent.tree_id).toBe(agent.id); // Root is its own tree
      expect(agent.title).toBe("Root Agent");
      expect(agent.model).toBe("anthropic/claude-sonnet-4");
      expect(agent.project_id).toBe("birdhouse-playground");
      expect(agent.directory).toBe("/Users/test/projects/birdhouse");

      // Verify agent is in database
      const dbAgent = agentsDB.getAgentById(agent.id);
      expect(dbAgent).not.toBe(null);
      expect(dbAgent?.tree_id).toBe(agent.id);
    });
  });

  test("uses temp title when not provided (no prompt)", async () => {
    const mockSession: Session = {
      id: "ses_notitle",
      title: "Creating Agent...",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const agentsDB = await initAgentsDB(":memory:");

    const deps = await createTestDeps({
      createSession: async (title?: string) => {
        expect(title).toBe("Creating Agent...");
        return mockSession;
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4",
          // No title provided
        }),
      });

      expect(res.status).toBe(201);
      const agent = (await res.json()) as AgentRow;
      expect(agent.title).toBe("Creating Agent...");
    });
  });

  test("uses temp title when empty string provided", async () => {
    const mockSession: Session = {
      id: "ses_emptytitle",
      title: "Creating Agent...",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const agentsDB = await initAgentsDB(":memory:");

    const deps = await createTestDeps({
      createSession: async (title?: string) => {
        expect(title).toBe("Creating Agent...");
        return mockSession;
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "   ", // Empty/whitespace
          model: "anthropic/claude-sonnet-4",
        }),
      });

      expect(res.status).toBe(201);
      const agent = (await res.json()) as AgentRow;
      expect(agent.title).toBe("Creating Agent...");
    });
  });

  test("uses default model when not provided", async () => {
    await withDeps(await createTestDeps(), async () => {
      const app = await withWorkspaceContext(createAgentRoutes);
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Agent",
        }),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as AgentRow;
      expect(data.model).toBe("anthropic/claude-sonnet-4-5"); // Default model
    });
  });

  test("creates root agent when createSession relies on harness this binding", async () => {
    const mockSession: Session = {
      id: "ses_bound_create",
      title: "Bound Agent",
      projectID: "birdhouse-playground",
      directory: "/Users/test/projects/birdhouse",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();

    deps.harness = {
      ...deps.harness,
      marker: "bound-harness",
      async createSession(title?: string) {
        expect(title).toBe("Bound Agent");
        expect((this as AgentHarness & { marker: string }).marker).toBe("bound-harness");
        return mockSession;
      },
    } as AgentHarness & { marker: string };
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Bound Agent",
          model: "anthropic/claude-sonnet-4",
        }),
      });

      expect(res.status).toBe(201);
      const agent = (await res.json()) as AgentRow;
      expect(agent.session_id).toBe("ses_bound_create");
    });
  });

  test("emits birdhouse.agent.created event after creating root agent", async () => {
    const mockSession: Session = {
      id: "ses_event_test",
      title: "Event Test Agent",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const agentsDB = await initAgentsDB(":memory:");

    const deps = await createTestDeps({
      createSession: async () => mockSession,
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const { getWorkspaceEventBus } = await import("../lib/birdhouse-event-bus");
      const bus = getWorkspaceEventBus("/test/workspace");

      let capturedEventType: string | undefined;
      let capturedEventData: Record<string, unknown> | undefined;
      const unsubscribe = bus.subscribe((event) => {
        capturedEventType = event.type;
        capturedEventData = event.properties;
      });

      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Event Test Agent",
          model: "anthropic/claude-sonnet-4",
        }),
      });

      expect(res.status).toBe(201);
      const agent = (await res.json()) as AgentRow;

      // Verify event was emitted
      expect(capturedEventType).toBe("birdhouse.agent.created");
      expect(capturedEventData).toBeDefined();
      expect(capturedEventData?.agentId).toBe(agent.id);
      expect(capturedEventData?.agent).toEqual(agent);

      unsubscribe();
    });
  });

  test("stores model field exactly as provided", async () => {
    const mockSession: Session = {
      id: "ses_model_test",
      title: "Model Test",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const agentsDB = await initAgentsDB(":memory:");

    const deps = await createTestDeps({
      createSession: async () => mockSession,
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });

      // Test with specific model format
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Model Test",
          model: "anthropic/claude-sonnet-4-5",
        }),
      });

      expect(res.status).toBe(201);
      const agent = (await res.json()) as AgentRow;
      expect(agent.model).toBe("anthropic/claude-sonnet-4-5");

      // Verify in database
      const dbAgent = agentsDB.getAgentById(agent.id);
      expect(dbAgent?.model).toBe("anthropic/claude-sonnet-4-5");
    });
  });

  test("sends first message with system prompt when prompt is provided", async () => {
    const mockSession: Session = {
      id: "ses_with_prompt",
      title: "Agent with Prompt",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const mockMessage = {
      info: {
        id: "msg_first",
        sessionID: "ses_with_prompt",
        role: "assistant",
        time: { created: Date.now(), completed: Date.now() },
        parentID: "msg_user",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 100,
          output: 50,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        path: { cwd: "/", root: "/" },
      },
      parts: [
        {
          type: "text",
          text: "Response to first message",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_1",
        },
      ],
    } as Message;

    const agentsDB = await initAgentsDB(":memory:");

    let sendMessageCalled = false;
    let capturedSystemPrompt: string | undefined;

    const deps = await createTestDeps({
      createSession: async () => mockSession,
      sendMessage: async (_sessionId, _text, options) => {
        sendMessageCalled = true;
        capturedSystemPrompt = options?.system;
        return mockMessage;
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Agent with Prompt",
          model: "anthropic/claude-sonnet-4",
          prompt: "Hello, agent!",
          wait: true, // Explicitly wait to get message parts in response
        }),
      });

      expect(res.status).toBe(201);
      const result = (await res.json()) as AgentRow & { parts?: unknown[] };

      // Verify sendMessage was called
      expect(sendMessageCalled).toBe(true);

      // Verify Birdhouse system prompt was injected
      expect(capturedSystemPrompt).toBeDefined();
      expect(capturedSystemPrompt).toContain("Agent Management Tools");
      expect(capturedSystemPrompt).toContain("agent_create");
      expect(capturedSystemPrompt).toContain("birdhouse:model/");
      expect(capturedSystemPrompt).toContain("Birdhouse");

      // Verify response includes message parts (because wait=true)
      expect(result.parts).toBeDefined();
      expect(result.parts).toEqual(mockMessage.parts);
    });
  });

  test("sends pasted image and pdf attachments as file parts when creating with a prompt", async () => {
    const mockSession: Session = {
      id: "ses_with_image_prompt",
      title: "Agent with Image Prompt",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const mockMessage = {
      info: {
        id: "msg_with_image_prompt",
        sessionID: "ses_with_image_prompt",
        role: "assistant",
        time: { created: Date.now(), completed: Date.now() },
        parentID: "msg_user",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 100,
          output: 50,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        path: { cwd: "/", root: "/" },
      },
      parts: [],
    } as Message;

    const agentsDB = await initAgentsDB(":memory:");

    let capturedParts: Array<{ type: string; text?: string; url?: string; mime?: string; filename?: string }> = [];

    const deps = await createTestDeps({
      createSession: async () => mockSession,
      sendMessage: async (_sessionId, _text, options) => {
        capturedParts = (options?.parts as typeof capturedParts | undefined) || [];
        return mockMessage;
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Agent with Image Prompt",
          model: "anthropic/claude-sonnet-4",
          prompt: "Please inspect this image",
          wait: true,
          attachments: [
            {
              type: "file",
              filename: "pasted.png",
              mime: "image/png",
              url: "data:image/png;base64,abc123",
            },
            {
              type: "file",
              filename: "notes.pdf",
              mime: "application/pdf",
              url: "data:application/pdf;base64,pdf123",
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
    });

    expect(capturedParts).toEqual([
      { type: "text", text: "Please inspect this image" },
      {
        type: "file",
        filename: "pasted.png",
        mime: "image/png",
        url: "data:image/png;base64,abc123",
      },
      {
        type: "file",
        filename: "notes.pdf",
        mime: "application/pdf",
        url: "data:application/pdf;base64,pdf123",
      },
    ]);
  });

  test("defaults to async mode (returns immediately without parts)", async () => {
    const mockSession: Session = {
      id: "ses_async",
      title: "Async Agent",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const mockMessage = {
      info: {
        id: "msg_async",
        sessionID: "ses_async",
        role: "assistant",
        time: { created: Date.now(), completed: Date.now() },
        parentID: "msg_user",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 100,
          output: 50,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        path: { cwd: "/", root: "/" },
      },
      parts: [
        {
          type: "text",
          text: "Async response",
          id: "part_1",
          sessionID: "ses_123",
          messageID: "msg_1",
        },
      ],
    } as Message;

    const agentsDB = await initAgentsDB(":memory:");

    let sendMessageCalled = false;
    let sendMessagePromise: Promise<Message> | null = null;

    const deps = await createTestDeps({
      createSession: async () => mockSession,
      sendMessage: async (_sessionId, _text, _options) => {
        sendMessageCalled = true;
        // Return a promise that resolves after a delay (simulating real async behavior)
        sendMessagePromise = new Promise((resolve) => {
          setTimeout(() => resolve(mockMessage), 100);
        });
        return sendMessagePromise;
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Async Agent",
          model: "anthropic/claude-sonnet-4",
          prompt: "Hello!",
          // No wait parameter - defaults to async
        }),
      });

      expect(res.status).toBe(201);
      const result = (await res.json()) as AgentRow & { parts?: unknown[] };

      // Verify sendMessage was called
      expect(sendMessageCalled).toBe(true);

      // Verify response does NOT include parts (async mode returns immediately)
      expect(result.parts).toBeUndefined();

      // Wait a bit to let the promise settle (fire-and-forget should still complete)
      if (sendMessagePromise) {
        await sendMessagePromise;
      }
    });
  });

  test("does not send message when prompt is not provided", async () => {
    const mockSession: Session = {
      id: "ses_no_prompt",
      title: "Agent without Prompt",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const agentsDB = await initAgentsDB(":memory:");

    let sendMessageCalled = false;

    const deps = await createTestDeps({
      createSession: async () => mockSession,
      sendMessage: async () => {
        sendMessageCalled = true;
        throw new Error("Should not call sendMessage");
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Agent without Prompt",
          model: "anthropic/claude-sonnet-4",
          // No prompt provided
        }),
      });

      expect(res.status).toBe(201);

      // Verify sendMessage was NOT called
      expect(sendMessageCalled).toBe(false);
    });
  });
});

describe("POST /api/agents - Create child agent", () => {
  test("creates child agent with correct tree metadata", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    // First, create a root agent directly in the database
    const rootAgent = createRootAgent(agentsDB, {
      title: "Parent Agent",
      id: "agent_root123",
    });

    const mockChildSession: Session = {
      id: "ses_child123",
      title: "Child Agent",
      projectID: "test-project",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const deps = await createTestDeps({
      createSession: async (title?: string) => {
        expect(title).toBe("Child Agent");
        return mockChildSession;
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Child Agent",
          model: "anthropic/claude-haiku",
          parent_id: rootAgent.id,
        }),
      });

      expect(res.status).toBe(201);
      const child = (await res.json()) as AgentRow;

      // Verify child agent properties
      expect(child.id).toMatch(/^agent_/);
      expect(child.session_id).toBe("ses_child123");
      expect(child.parent_id).toBe(rootAgent.id);
      expect(child.level).toBe(1); // Parent level + 1
      expect(child.tree_id).toBe(rootAgent.tree_id); // Inherits parent's tree_id
      expect(child.title).toBe("Child Agent");
      expect(child.model).toBe("anthropic/claude-haiku");

      // Verify child is in database
      const dbChild = agentsDB.getAgentById(child.id);
      expect(dbChild).not.toBe(null);
      expect(dbChild?.tree_id).toBe(rootAgent.tree_id);
      expect(dbChild?.level).toBe(1);
    });
  });

  test("creates grandchild agent with level=2", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    // Create root and child agents
    const rootAgent = createRootAgent(agentsDB, {
      title: "Root",
      id: "agent_root",
    });

    const childAgent = createChildAgent(agentsDB, rootAgent.id, {
      title: "Child",
    });

    const mockGrandchildSession: Session = {
      id: "ses_grandchild",
      title: "Grandchild",
      projectID: "test",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const deps = await createTestDeps({
      createSession: async () => mockGrandchildSession,
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Grandchild",
          model: "anthropic/claude-haiku",
          parent_id: childAgent.id,
        }),
      });

      expect(res.status).toBe(201);
      const grandchild = (await res.json()) as AgentRow;

      expect(grandchild.parent_id).toBe(childAgent.id);
      expect(grandchild.level).toBe(2); // Child level + 1
      expect(grandchild.tree_id).toBe(rootAgent.tree_id); // Still root's tree
    });
  });

  test("returns 400 for invalid parent_id", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Orphan Agent",
          model: "anthropic/claude-sonnet-4",
          parent_id: "agent_nonexistent",
        }),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Parent agent");
      expect(data.error).toContain("not found");
    });
  });

  test("validates parent_id type", async () => {
    await withDeps(await createTestDeps(), async () => {
      const app = await withWorkspaceContext(createAgentRoutes);
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          model: "anthropic/claude-sonnet-4",
          parent_id: 123, // Invalid type
        }),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("parent_id must be a string");
    });
  });
});

describe("POST /api/agents - Error handling", () => {
  test("handles OpenCode API failures", async () => {
    const deps = await createTestDeps({
      createSession: async () => {
        throw new Error("Failed to create session: 500 Internal Server Error");
      },
    });

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes);
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          model: "anthropic/claude-sonnet-4",
        }),
      });

      expect(res.status).toBe(502);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Failed to create session");
    });
  });

  test("handles duplicate session_id gracefully", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    // Create an agent with a specific session_id
    createRootAgent(agentsDB, {
      session_id: "ses_duplicate",
      title: "Existing",
      id: "agent_dup",
    });

    const mockSession: Session = {
      id: "ses_duplicate", // Same session_id!
      title: "New Agent",
      projectID: "test",
      directory: "/test",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    };

    const deps = await createTestDeps({
      createSession: async () => mockSession,
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Agent",
          model: "anthropic/claude-sonnet-4",
        }),
      });

      expect(res.status).toBe(409);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("already exists");
    });
  });
});

describe("GET /api/agents/:id - Get agent by ID", () => {
  test("returns agent by agent_id", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    // Create a test agent
    const agent = createRootAgent(agentsDB, {
      session_id: "ses_test123",
      title: "Test Agent",
      project_id: "test-project",
      id: "agent_test123",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_test123");

      expect(res.status).toBe(200);
      const data = (await res.json()) as AgentRow;
      expect(data.id).toBe(agent.id);
      expect(data.session_id).toBe("ses_test123");
      expect(data.title).toBe("Test Agent");
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_nonexistent");

      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });
});

describe("GET /api/agents/:id/messages - Get messages for agent", () => {
  test("returns messages using agent_id", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    // Create a test agent
    createRootAgent(agentsDB, {
      title: "Message Test Agent",
      id: "agent_msgs123",
      session_id: "ses_msgs123",
    });

    const mockMessages = [
      {
        info: { id: "msg_1", role: "user", sessionID: "ses_msgs123" },
        parts: [
          {
            type: "text",
            text: "Hello",
            id: "part_1",
            sessionID: "ses_123",
            messageID: "msg_1",
          },
        ],
      },
    ];

    // Expected response wraps messages in TimelineItem format
    const expectedTimeline = [
      {
        item_type: "message",
        message: mockMessages[0],
      },
    ];

    const deps = await createTestDeps({
      getMessages: async (sessionId: string, _limit?: number) => {
        expect(sessionId).toBe("ses_msgs123");
        return mockMessages as unknown as Message[];
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_msgs123/messages");

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(expectedTimeline);
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_nonexistent/messages");

      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });

  test("passes limit parameter to getMessages", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    createRootAgent(agentsDB, {
      title: "Limit Test",
      id: "agent_limit",
    });

    let receivedLimit: number | undefined;

    const deps = await createTestDeps({
      getMessages: async (_sessionId: string, limit?: number) => {
        receivedLimit = limit;
        return [];
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      await app.request("/agent_limit/messages?limit=10");

      expect(receivedLimit).toBe(10);
    });
  });
});

describe("POST /api/agents/:id/messages - Send message to agent", () => {
  test("sends message using agent_id and updates timestamp", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      title: "Send Test Agent",
      id: "agent_send123",
      session_id: "ses_send123",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.sendMessage = async (_sessionId, _text) => ({
      info: {
        id: "msg_response",
        role: "assistant",
        sessionID: "ses_send123",
        time: { created: Date.now(), completed: Date.now() },
        parentID: "msg_user",
        modelID: "claude-sonnet-4",
        providerID: "anthropic",
        mode: "build",
        cost: 0,
        tokens: {
          input: 100,
          output: 50,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
        path: { cwd: "/", root: "/" },
      },
      parts: [
        {
          type: "text",
          text: "Response",
          id: "part_1",
          sessionID: "ses_send123",
          messageID: "msg_response",
        },
      ],
    });

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });

      const beforeTimestamp = agentsDB.getAgentById("agent_send123")?.updated_at;

      const res = await app.request("/agent_send123/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello agent" }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as Message;
      expect(data.info.id).toBe("msg_response");
      const firstPart = data.parts?.[0];
      expect(firstPart && "text" in firstPart ? firstPart.text : undefined).toBe("Response");

      // Verify timestamp was updated
      const afterTimestamp = agentsDB.getAgentById("agent_send123")?.updated_at;
      expect(afterTimestamp).toBeDefined();
      expect(afterTimestamp).toBeGreaterThan(beforeTimestamp ?? 0);
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_nonexistent/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello" }),
      });

      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });

  test("handles sendMessage errors", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    createRootAgent(agentsDB, {
      session_id: "ses_error",
      title: "Error Test",
      id: "agent_error",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness.sendMessage = async () => {
      throw new Error("OpenCode API failure");
    };

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_error/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Test" }),
      });

      expect(res.status).toBe(500);
    });
  });
});

// ============================================================================
// GET /api/agents - Load all agent trees
// ============================================================================

describe("GET /api/agents - Load all agent trees", () => {
  test("returns empty trees array for empty database", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toEqual([]);
    });
  });

  test("returns single root agent with no children", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    createRootAgent(agentsDB, {
      title: "Single Root Agent",
      id: "agent_single",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toHaveLength(1);

      const tree = data.trees[0];
      expect(tree.tree_id).toBe("agent_single");
      expect(tree.count).toBe(1);
      expect(tree.root.id).toBe("agent_single");
      expect(tree.root.level).toBe(0);
      expect(tree.root.parent_id).toBeNull();
      expect(tree.root.children).toEqual([]);

      verifyTreeStructure(tree);
      expect(countTreeNodes(tree)).toBe(1);
    });
  });

  test("returns single tree with children", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    createAgentTree(agentsDB, {
      rootTitle: "Root Agent",
      rootId: "agent_tree1",
      childTitles: ["Child 1", "Child 2"],
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toHaveLength(1);

      const tree = data.trees[0];
      expect(tree.tree_id).toBe("agent_tree1");
      expect(tree.count).toBe(3);
      expect(tree.root.children).toHaveLength(2);
      // Children sorted by updated_at DESC (most recent first)
      expect(tree.root.children[0].title).toBe("Child 2");
      expect(tree.root.children[1].title).toBe("Child 1");

      verifyTreeStructure(tree);
      expect(countTreeNodes(tree)).toBe(3);
    });
  });

  test("returns multiple independent trees", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create 3 independent root agents with different created_at times
    createRootAgent(agentsDB, {
      title: "Root 1",
      id: "agent_tree1",
      created_at: now - 2000, // Oldest
      updated_at: now - 2000,
    });

    createRootAgent(agentsDB, {
      title: "Root 2",
      id: "agent_tree2",
      created_at: now - 1000, // Middle
      updated_at: now - 1000,
    });

    createRootAgent(agentsDB, {
      title: "Root 3",
      id: "agent_tree3",
      created_at: now, // Newest
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toHaveLength(3);

      // Verify trees are sorted by root's created_at DESC (newest first)
      expect(data.trees[0].tree_id).toBe("agent_tree3"); // newest
      expect(data.trees[1].tree_id).toBe("agent_tree2"); // middle
      expect(data.trees[2].tree_id).toBe("agent_tree1"); // oldest

      // Each tree should have count=1
      for (const tree of data.trees) {
        expect(tree.count).toBe(1);
        expect(tree.root.children).toEqual([]);
        verifyTreeStructure(tree);
      }
    });
  });

  test("handles multi-level tree (grandchildren)", async () => {
    const agentsDB = await initAgentsDB(":memory:");

    const root = createRootAgent(agentsDB, {
      title: "Root",
      id: "agent_root",
    });

    const child = createChildAgent(agentsDB, root.id, {
      title: "Child",
    });

    createChildAgent(agentsDB, child.id, {
      title: "Grandchild",
      model: "anthropic/claude-haiku",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toHaveLength(1);

      const tree = data.trees[0];
      expect(tree.count).toBe(3);
      expect(tree.root.level).toBe(0);
      expect(tree.root.children).toHaveLength(1);

      const childNode = tree.root.children[0];
      expect(childNode.level).toBe(1);
      expect(childNode.children).toHaveLength(1);

      const grandchildNode = childNode.children[0];
      expect(grandchildNode.level).toBe(2);
      expect(grandchildNode.children).toEqual([]);

      verifyTreeStructure(tree);
      expect(countTreeNodes(tree)).toBe(3);
    });
  });

  test("handles multiple children per parent", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const root = createRootAgent(agentsDB, {
      title: "Root",
      id: "agent_root",
      created_at: now,
      updated_at: now,
    });

    // Add 3 children
    createChildAgent(agentsDB, root.id, {
      title: "Child 1",
      created_at: now - 3000,
      updated_at: now - 3000,
    });

    createChildAgent(agentsDB, root.id, {
      title: "Child 2",
      created_at: now - 2000,
      updated_at: now - 2000,
    });

    createChildAgent(agentsDB, root.id, {
      title: "Child 3",
      created_at: now - 1000,
      updated_at: now - 1000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toHaveLength(1);

      const tree = data.trees[0];
      expect(tree.count).toBe(4);
      expect(tree.root.children).toHaveLength(3);

      // Verify children are sorted by updated_at DESC (most recent first)
      expect(tree.root.children[0].title).toBe("Child 3");
      expect(tree.root.children[1].title).toBe("Child 2");
      expect(tree.root.children[2].title).toBe("Child 1");

      verifyTreeStructure(tree);
      expect(countTreeNodes(tree)).toBe(4);
    });
  });

  test("sorts by updated_at by default", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create agents with different updated_at times
    createRootAgent(agentsDB, {
      title: "Old Agent",
      created_at: now - 10000,
      updated_at: now - 10000, // Oldest update
      id: "agent_old",
    });

    createRootAgent(agentsDB, {
      title: "New Agent",
      created_at: now - 5000,
      updated_at: now - 1000, // Most recent update
      id: "agent_new",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toHaveLength(2);

      // Should be sorted by root's created_at DESC (newest trees first)
      // agent_new was created at (now - 5000), agent_old at (now - 10000)
      // So agent_new should come first (newer)
      expect(data.trees[0].tree_id).toBe("agent_new");
      expect(data.trees[1].tree_id).toBe("agent_old");
    });
  });

  test("sorts by created_at when specified", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create agents with different created_at times
    createRootAgent(agentsDB, {
      title: "First Created",
      created_at: now - 10000, // Created first
      updated_at: now - 1000,
      id: "agent_first",
    });

    createRootAgent(agentsDB, {
      title: "Second Created",
      created_at: now - 5000, // Created second
      updated_at: now - 10000,
      id: "agent_second",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/?sortBy=created_at");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toHaveLength(2);

      // Trees should still be sorted by tree_id DESC
      expect(data.trees[0].tree_id).toBe("agent_second");
      expect(data.trees[1].tree_id).toBe("agent_first");
    });
  });

  test("injects explicit status and falls back to idle for descendants", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const root = createRootAgent(agentsDB, {
      id: "agent_status_list_root",
      session_id: "ses_status_list_root",
      title: "Root Status",
      created_at: now,
      updated_at: now,
    });

    const child = createChildAgent(agentsDB, root.id, {
      id: "agent_status_list_child",
      session_id: "ses_status_list_child",
      title: "Child Status",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps({
      getSessionStatus: async () => ({
        [root.session_id]: { type: "busy" },
      }),
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toHaveLength(1);
      expect(data.trees[0]?.root.status).toEqual({ type: "busy" });
      expect(data.trees[0]?.root.children).toEqual([
        expect.objectContaining({ id: child.id, status: { type: "idle" } }),
      ]);
    });
  });

  test("defaults to updated_at sort while created_at sort can produce a different tree order", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    const olderCreatedRecentlyUpdated = createRootAgent(agentsDB, {
      id: "agent_sort_updated_first",
      title: "Older Created Recently Updated",
      created_at: now - 10_000,
      updated_at: now,
    });

    const newerCreatedOlderUpdated = createRootAgent(agentsDB, {
      id: "agent_sort_created_first",
      title: "Newer Created Older Updated",
      created_at: now - 1_000,
      updated_at: now - 5_000,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });

      const defaultRes = await app.request("/");
      expect(defaultRes.status).toBe(200);
      const defaultData = (await defaultRes.json()) as { trees: AgentTree[] };
      expect(defaultData.trees.map((tree) => tree.tree_id)).toEqual([
        olderCreatedRecentlyUpdated.tree_id,
        newerCreatedOlderUpdated.tree_id,
      ]);

      const createdRes = await app.request("/?sortBy=created_at");
      expect(createdRes.status).toBe(200);
      const createdData = (await createdRes.json()) as { trees: AgentTree[] };
      expect(createdData.trees.map((tree) => tree.tree_id)).toEqual([
        newerCreatedOlderUpdated.tree_id,
        olderCreatedRecentlyUpdated.tree_id,
      ]);
    });
  });

  test("returns 400 for invalid sortBy parameter", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/?sortBy=invalid");

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data).toEqual({ error: "Invalid sortBy parameter" });
    });
  });

  test("handles complex multi-tree scenario", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Tree 1: Root + 2 children (oldest)
    const tree1Root = createRootAgent(agentsDB, {
      title: "Tree 1 Root",
      created_at: now - 2000,
      updated_at: now - 2000,
      id: "agent_tree1",
    });

    createChildAgent(agentsDB, tree1Root.id, {
      title: "Tree 1 Child 1",
      created_at: now,
      updated_at: now,
    });

    createChildAgent(agentsDB, tree1Root.id, {
      title: "Tree 1 Child 2",
      created_at: now,
      updated_at: now,
    });

    // Tree 2: Root only (middle)
    createRootAgent(agentsDB, {
      title: "Tree 2 Root",
      created_at: now - 1000,
      updated_at: now - 1000,
      id: "agent_tree2",
    });

    // Tree 3: Root + child + grandchild (newest)
    const tree3Root = createRootAgent(agentsDB, {
      title: "Tree 3 Root",
      created_at: now,
      updated_at: now,
      id: "agent_tree3",
    });

    const tree3Child = createChildAgent(agentsDB, tree3Root.id, {
      title: "Tree 3 Child",
      created_at: now,
      updated_at: now,
    });

    createChildAgent(agentsDB, tree3Child.id, {
      title: "Tree 3 Grandchild",
      model: "anthropic/claude-haiku",
      created_at: now,
      updated_at: now,
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/");

      expect(res.status).toBe(200);
      const data = (await res.json()) as { trees: AgentTree[] };
      expect(data.trees).toHaveLength(3);

      // Verify tree ordering (by MAX(updated_at) DESC - most recent activity first)
      // Tree 1: MAX = now (children updated at now)
      // Tree 2: MAX = now - 1000 (root only)
      // Tree 3: MAX = now (all updated at now)
      // Tree 3 and Tree 1 tied at "now", sorted by tree_id DESC as tiebreaker
      expect(data.trees[0].tree_id).toBe("agent_tree3"); // MAX=now, tree_id higher
      expect(data.trees[1].tree_id).toBe("agent_tree1"); // MAX=now, tree_id lower
      expect(data.trees[2].tree_id).toBe("agent_tree2"); // MAX=now-1000

      // Verify counts
      expect(data.trees[0].count).toBe(3); // Tree 3: root + child + grandchild
      expect(data.trees[1].count).toBe(3); // Tree 1: root + 2 children
      expect(data.trees[2].count).toBe(1); // Tree 2: root only

      // Verify structures
      for (const tree of data.trees) {
        verifyTreeStructure(tree);
        expect(countTreeNodes(tree)).toBe(tree.count);
      }

      // Verify specific tree structures
      expect(data.trees[0].root.children).toHaveLength(1); // Tree 3 has 1 child
      expect(data.trees[0].root.children[0].children).toHaveLength(1); // That child has 1 grandchild

      expect(data.trees[1].root.children).toHaveLength(2); // Tree 1 has 2 children

      expect(data.trees[2].root.children).toEqual([]); // Tree 2 has no children
    });
  });
});

// ============================================================================
// PATCH /api/agents/:id - Update agent properties
// ============================================================================

describe("PATCH /api/agents/:id - Update agent title", () => {
  test("updates agent title successfully", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create a test agent
    const agent = createRootAgent(agentsDB, {
      title: "Original Title",
      project_id: "test-project",
      created_at: now,
      updated_at: now,
      id: "agent_patch_test",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_patch_test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Updated Title",
        }),
      });

      expect(res.status).toBe(200);
      const updatedAgent = (await res.json()) as AgentRow;

      // Verify agent was updated in database
      expect(updatedAgent.title).toBe("Updated Title");
      expect(updatedAgent.id).toBe(agent.id);

      // Verify database was actually updated
      const dbAgent = agentsDB.getAgentById(agent.id);
      expect(dbAgent?.title).toBe("Updated Title");
    });
  });

  test("trims whitespace from title", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      title: "Original",
      created_at: now,
      updated_at: now,
      id: "agent_trim_test",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_trim_test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "   Trimmed Title   ",
        }),
      });

      expect(res.status).toBe(200);
      const updatedAgent = (await res.json()) as AgentRow;
      expect(updatedAgent.title).toBe("Trimmed Title");
    });
  });

  test("returns 400 for empty title", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    createRootAgent(agentsDB, {
      title: "Original",
      created_at: now,
      updated_at: now,
      id: "agent_empty_test",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_empty_test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "   ",
        }),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("cannot be empty");
    });
  });

  test("returns 400 for missing title", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Title is required");
    });
  });

  test("returns 404 for non-existent agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Title",
        }),
      });

      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });

  test("syncs title to OpenCode when updating agent", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create a test agent with a known session_id
    const _agent = createRootAgent(agentsDB, {
      title: "Original Title",
      project_id: "test-project",
      session_id: "ses_sync_test",
      created_at: now,
      updated_at: now,
      id: "agent_sync_test",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    // Track if updateSessionTitle was called
    let updateSessionTitleCalled = false;
    let capturedSessionId = "";
    let capturedTitle = "";

    // Wrap the opencode client to spy on updateSessionTitle
    const originalUpdateSessionTitle = deps.harness.updateSessionTitle.bind(deps.harness);
    deps.harness.updateSessionTitle = async (sessionId: string, title: string) => {
      updateSessionTitleCalled = true;
      capturedSessionId = sessionId;
      capturedTitle = title;
      return originalUpdateSessionTitle(sessionId, title);
    };

    await withDeps(deps, async () => {
      const { getWorkspaceEventBus } = await import("../lib/birdhouse-event-bus");
      const bus = getWorkspaceEventBus("/test/workspace");

      let capturedEventType: string | undefined;
      let capturedEventData: Record<string, unknown> | undefined;
      const unsubscribe = bus.subscribe((event) => {
        capturedEventType = event.type;
        capturedEventData = event.properties;
      });

      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_sync_test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Synced Title",
        }),
      });

      expect(res.status).toBe(200);
      const updatedAgent = (await res.json()) as AgentRow;
      expect(updatedAgent.title).toBe("Synced Title");

      // Verify OpenCode sync was called with correct parameters
      expect(updateSessionTitleCalled).toBe(true);
      expect(capturedSessionId).toBe("ses_sync_test");
      expect(capturedTitle).toBe("Synced Title");

      // Verify SSE event was emitted
      expect(capturedEventType).toBe("birdhouse.agent.updated");
      expect(capturedEventData).toBeDefined();
      expect(capturedEventData?.agentId).toBe("agent_sync_test");
      expect(capturedEventData?.agent).toEqual(updatedAgent);

      unsubscribe();
    });
  });

  test("succeeds even when OpenCode sync fails (graceful degradation)", async () => {
    const agentsDB = await initAgentsDB(":memory:");
    const now = Date.now();

    // Create a test agent
    const agent = createRootAgent(agentsDB, {
      title: "Original Title",
      project_id: "test-project",
      session_id: "ses_fail_test",
      created_at: now,
      updated_at: now,
      id: "agent_fail_test",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    // Make updateSessionTitle throw an error
    deps.harness.updateSessionTitle = async (_sessionId: string, _title: string) => {
      throw new Error("OpenCode is down");
    };

    await withDeps(deps, async () => {
      const { getWorkspaceEventBus } = await import("../lib/birdhouse-event-bus");
      const bus = getWorkspaceEventBus("/test/workspace");

      let capturedEventType: string | undefined;
      let capturedEventData: Record<string, unknown> | undefined;
      const unsubscribe = bus.subscribe((event) => {
        capturedEventType = event.type;
        capturedEventData = event.properties;
      });

      const app = await withWorkspaceContext(createAgentRoutes, { agentsDb: agentsDB });
      const res = await app.request("/agent_fail_test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Title Despite Failure",
        }),
      });

      // Request should succeed even though OpenCode sync failed
      expect(res.status).toBe(200);
      const updatedAgent = (await res.json()) as AgentRow;
      expect(updatedAgent.title).toBe("Title Despite Failure");

      // Verify database was updated despite OpenCode failure
      const dbAgent = agentsDB.getAgentById(agent.id);
      expect(dbAgent?.title).toBe("Title Despite Failure");

      // Verify SSE event was still emitted despite OpenCode sync failure
      expect(capturedEventType).toBe("birdhouse.agent.updated");
      expect(capturedEventData).toBeDefined();
      expect(capturedEventData?.agentId).toBe("agent_fail_test");
      expect(capturedEventData?.agent).toEqual(updatedAgent);

      unsubscribe();
    });
  });
});
