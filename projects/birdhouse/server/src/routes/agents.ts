// ABOUTME: Agent routes for creating and managing agents (abstraction over OpenCode sessions)
// ABOUTME: Handles tree metadata calculation and coordinates between OpenCode API and agents DB

import { Hono } from "hono";
import * as handlers from "../features/api";
import { archive } from "../features/api/archive";
import { unarchive } from "../features/api/unarchive";
import type { AgentNode, SortDirection, SortOrder } from "../lib/agents-db";
import { loadAllAgentTrees } from "../lib/agents-db";
import { getDepsFromContext } from "../lib/context-deps";
import { syncAgentTitle } from "../lib/sync-agent-title";
import "../types/context";

// Sort field for search (includes relevance)
type SortField = "relevance" | SortOrder;

export function createAgentRoutes() {
  const app = new Hono();

  // GET /api/agents/search - Search agents by query with fuzzy matching and sorting
  app.get("/search", async (c) => {
    const { agentsDB, opencode } = getDepsFromContext(c);

    const query = c.req.query("q") || "";
    const includeTreesParam = c.req.query("includeTrees");
    const sortByParam = c.req.query("sortBy");
    const orderParam = c.req.query("order");

    // Validate includeTrees parameter
    let includeTrees = false;
    if (includeTreesParam !== undefined) {
      if (includeTreesParam !== "true" && includeTreesParam !== "false") {
        return c.json({ error: "includeTrees must be 'true' or 'false'" }, 400);
      }
      includeTrees = includeTreesParam === "true";
    }

    // Determine default sortBy based on whether we have a search query
    const hasQuery = query.trim().length > 0;
    const defaultSortBy: SortField = hasQuery ? "relevance" : "updated_at";
    const sortBy = (sortByParam || defaultSortBy) as SortField;

    // Validate sortBy parameter
    if (sortBy !== "relevance" && sortBy !== "updated_at" && sortBy !== "created_at") {
      return c.json({ error: "sortBy must be 'relevance', 'updated_at', or 'created_at'" }, 400);
    }

    // Validate order parameter
    const order = (orderParam || "desc") as SortDirection;
    if (order !== "asc" && order !== "desc") {
      return c.json({ error: "order must be 'asc' or 'desc'" }, 400);
    }

    // Relevance sorting requires a non-empty query
    if (sortBy === "relevance" && !hasQuery) {
      return c.json({ error: "sortBy=relevance requires a non-empty query" }, 400);
    }

    if (includeTrees) {
      // Tree search mode: return complete trees for matching agents
      // Note: relevance sorting uses updated_at for tree ordering (Database Specialist's decision)
      const treeSortBy: SortOrder = sortBy === "relevance" ? "updated_at" : sortBy;
      const { rows, matchedAgentIds } = agentsDB.searchAgentsWithTrees(query, treeSortBy, order);

      // Assemble trees using existing helper
      const trees = loadAllAgentTrees(agentsDB, treeSortBy, order, rows);

      // Inject status recursively (same code as GET /api/agents)
      const sessionStatuses = await opencode.getSessionStatus();
      const injectStatus = (node: AgentNode): void => {
        node.status = sessionStatuses[node.session_id] || { type: "idle" };
        node.children.forEach(injectStatus);
      };
      for (const tree of trees) {
        injectStatus(tree.root);
      }

      return c.json({ trees, matchedAgentIds, total: matchedAgentIds.length });
    } else {
      // Flat search mode: return matching agents only
      // Note: searchAgents() always sorts by relevance internally
      const agents = agentsDB.searchAgents(query);

      // If user requested timestamp sorting, re-sort the results
      let sortedAgents = agents;
      if (sortBy === "updated_at" || sortBy === "created_at") {
        sortedAgents = [...agents].sort((a, b) => {
          const aVal = sortBy === "updated_at" ? a.updated_at : a.created_at;
          const bVal = sortBy === "updated_at" ? b.updated_at : b.created_at;
          return order === "desc" ? bVal - aVal : aVal - bVal;
        });
      }
      // If sortBy === "relevance", keep the order from searchAgents (already sorted by relevance)

      // Inject status into each agent and add empty children array for type consistency
      const sessionStatuses = await opencode.getSessionStatus();
      const agentsWithStatus = sortedAgents.map((agent) => ({
        ...agent,
        children: [],
        status: sessionStatuses[agent.session_id] || { type: "idle" },
      }));

      return c.json({ agents: agentsWithStatus, total: agents.length });
    }
  });

  // GET /api/agents - Load all agent trees
  app.get("/", async (c) => {
    const { agentsDB, opencode } = getDepsFromContext(c);

    // Get optional sortBy query param
    const sortBy = c.req.query("sortBy") as SortOrder | undefined;

    // Validate sortBy
    if (sortBy && sortBy !== "updated_at" && sortBy !== "created_at") {
      return c.json({ error: "Invalid sortBy parameter" }, 400);
    }

    // Load and assemble trees
    const trees = loadAllAgentTrees(agentsDB, sortBy || "updated_at", "desc");

    // Fetch session statuses in bulk
    const sessionStatuses = await opencode.getSessionStatus();

    // Inject status into each node recursively
    const injectStatus = (node: AgentNode): void => {
      node.status = sessionStatuses[node.session_id] || { type: "idle" };
      node.children.forEach(injectStatus);
    };

    trees.forEach((tree) => {
      injectStatus(tree.root);
    });

    return c.json({ trees });
  });

  // POST /api/agents - Create a new agent
  app.post("/", (c) => handlers.create(c, getDepsFromContext(c)));

  // GET /api/agents/:id - Get agent by ID
  app.get("/:id", async (c) => {
    const { agentsDB, opencode } = getDepsFromContext(c);
    const agentId = c.req.param("id");

    try {
      const agent = agentsDB.getAgentById(agentId);
      if (!agent) {
        return c.json({ error: `Agent ${agentId} not found` }, 404);
      }

      // Fetch session to check for revert state
      const session = await opencode.getSession(agent.session_id);

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
      const opencodeBase = c.get("opencodeBase");
      const workspace = c.get("workspace");

      const updatedAgent = await syncAgentTitle(
        {
          agentsDB,
          opencodeClient: deps.opencode,
          opencodeBase,
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

  return app;
}
