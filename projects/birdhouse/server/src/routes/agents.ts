// ABOUTME: Agent routes for creating and managing agents (abstraction over OpenCode sessions)
// ABOUTME: Handles tree metadata calculation and coordinates between OpenCode API and agents DB

import { Hono } from "hono";
import { getHarnessForAgent } from "../dependencies";
import * as handlers from "../features/api";
import { archive } from "../features/api/archive";
import { getAgentQuestions, replyToAgentQuestion } from "../features/api/question";
import { unarchive } from "../features/api/unarchive";
import { getDepsFromContext } from "../lib/context-deps";
import { syncAgentTitle } from "../lib/sync-agent-title";
import "../types/context";

export function createAgentRoutes() {
  const app = new Hono();

  // GET /api/agents/search - Search agent message content in OpenCode database
  app.get("/search", (c) => handlers.searchMessages(c, getDepsFromContext(c)));

  // GET /api/agents/recent - Get recent agents with message context for typeahead
  app.get("/recent", (c) => handlers.getRecentAgents(c, getDepsFromContext(c)));

  // GET /api/agents - Load all agent trees
  app.get("/", (c) => handlers.getAgents(c, getDepsFromContext(c)));

  // POST /api/agents - Create a new agent
  app.post("/", (c) => handlers.create(c, getDepsFromContext(c)));

  // GET /api/agents/:id - Get agent by ID
  app.get("/:id", async (c) => {
    const deps = getDepsFromContext(c);
    const { agentsDB } = deps;
    const agentId = c.req.param("id");

    try {
      const agent = agentsDB.getAgentById(agentId);
      if (!agent) {
        return c.json({ error: `Agent ${agentId} not found` }, 404);
      }

      // Fetch session to check for revert state
      const harness = getHarnessForAgent(deps, agent);
      const session = await harness.getSession(agent.session_id);

      // Include revert state if present
      const response = session.revert ? { ...agent, revert: session.revert } : agent;

      return c.json(response);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // GET /api/agents/:id/status - Get session status for agent
  app.get("/:id/status", (c) => handlers.getStatus(c, getDepsFromContext(c)));

  // GET /api/agents/by-session/:session_id - Get agent by OpenCode session ID
  app.get("/by-session/:session_id", (c) => handlers.getBySession(c, getDepsFromContext(c)));

  // PATCH /api/agents/:id - Update agent properties
  app.patch("/:id", async (c) => {
    const agentsDB = c.get("agentsDb");
    const agentId = c.req.param("id");

    try {
      const body = await c.req.json();

      // Validate title field
      if (!body.title || typeof body.title !== "string") {
        return c.json({ error: "Title is required and must be a string" }, 400);
      }

      const trimmedTitle = body.title.trim();
      if (!trimmedTitle) {
        return c.json({ error: "Title cannot be empty" }, 400);
      }

      // Check if agent exists
      const existingAgent = agentsDB.getAgentById(agentId);
      if (!existingAgent) {
        return c.json({ error: `Agent ${agentId} not found` }, 404);
      }

      // Update agent title in Birdhouse, sync to OpenCode, and emit SSE event
      const deps = getDepsFromContext(c);
      const workspace = c.get("workspace");

      const updatedAgent = await syncAgentTitle(
        {
          agentsDB,
          harness: getHarnessForAgent(deps, existingAgent),
          workspaceDir: workspace.directory,
          log: deps.log,
        },
        agentId,
        trimmedTitle,
      );

      return c.json(updatedAgent);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // PATCH /api/agents/:id/archive - Archive agent and descendants
  app.patch("/:id/archive", (c) => archive(c, getDepsFromContext(c)));

  // PATCH /api/agents/:id/unarchive - Unarchive agent and descendants
  app.patch("/:id/unarchive", (c) => unarchive(c, getDepsFromContext(c)));

  // GET /api/agents/:id/export - Export agent timeline as markdown
  app.get("/:id/export", (c) => handlers.exportMarkdown(c, getDepsFromContext(c)));

  // GET /api/agents/:id/messages - Get messages for agent
  app.get("/:id/messages", (c) => handlers.getMessages(c, getDepsFromContext(c)));

  // POST /api/agents/:id/messages - Send message to agent
  app.post("/:id/messages", (c) => handlers.sendMessage(c, getDepsFromContext(c)));

  // POST /api/agents/:id/clone - Clone agent from specific message
  app.post("/:id/clone", (c) => handlers.cloneAgent(c, getDepsFromContext(c)));

  // POST /api/agents/:id/revert - Revert agent to specific message
  app.post("/:id/revert", (c) => handlers.revert(c, getDepsFromContext(c)));

  // POST /api/agents/:id/unrevert - Unrevert a previously reverted agent
  app.post("/:id/unrevert", (c) => handlers.unrevert(c, getDepsFromContext(c)));

  // GET /api/agents/:id/wait - Wait for agent completion (proxies to OpenCode)
  app.get("/:id/wait", (c) => handlers.wait(c, getDepsFromContext(c)));

  app.post("/:id/stop", (c) => handlers.stopAgent(c, getDepsFromContext(c)));
  app.post("/:id/stop-tree", (c) => handlers.stopAgentTree(c, getDepsFromContext(c)));

  // GET /api/agents/:id/questions - List pending questions for agent
  app.get("/:id/questions", (c) => getAgentQuestions(c, getDepsFromContext(c)));

  // POST /api/agents/:id/questions/:requestId/reply - Reply to a pending question
  app.post("/:id/questions/:requestId/reply", (c) => replyToAgentQuestion(c, getDepsFromContext(c)));

  return app;
}
