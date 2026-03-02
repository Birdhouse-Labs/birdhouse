// ABOUTME: Agent API routes optimized for plugin/LLM consumption (filtered data)
// ABOUTME: Namespace: /aapi/agents/* - Returns cleaned messages without IDs, cost, metadata

import { Hono } from "hono";
import * as handlers from "../features/aapi";
import { getDepsFromContext } from "../lib/context-deps";
import "../types/context";

export function createAAPIAgentRoutes() {
  const app = new Hono();

  // GET /aapi/agents/by-session/:session_id - Get agent by OpenCode session ID
  app.get("/by-session/:session_id", (c) => handlers.getBySession(c, getDepsFromContext(c)));

  // POST /aapi/agents - Create a new agent
  app.post("/", (c) => handlers.create(c, getDepsFromContext(c)));

  // POST /aapi/agents/:id/messages - Send message to agent
  app.post("/:id/messages", (c) => handlers.sendMessage(c, getDepsFromContext(c)));

  // GET /aapi/agents/:id/wait - Wait for agent completion
  app.get("/:id/wait", (c) => handlers.wait(c, getDepsFromContext(c)));

  // GET /aapi/agents/:id/tree - Get agent tree visualization
  app.get("/:id/tree", (c) => handlers.getTree(c, getDepsFromContext(c)));

  // GET /aapi/agents/:id/messages - Get filtered messages for plugin consumption
  app.get("/:id/messages", (c) => handlers.getMessages(c, getDepsFromContext(c)));

  // POST /aapi/agents/:id/export - Export agent timeline to file
  app.post("/:id/export", (c) => handlers.exportMarkdown(c, getDepsFromContext(c)));

  // POST /aapi/agents/:id/export-tree - Export entire agent tree to files
  app.post("/:id/export-tree", (c) => handlers.exportTree(c, getDepsFromContext(c)));

  return app;
}
