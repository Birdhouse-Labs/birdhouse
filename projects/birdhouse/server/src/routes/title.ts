// ABOUTME: Title generation routes for creating agent titles from messages.
// ABOUTME: Namespace: /api/title/* - Uses the Birdhouse-owned title prompt via OpenCode.

import { Hono } from "hono";
import * as handlers from "../features/api";
import { getDepsFromContext } from "../lib/context-deps";

export function createTitleRoutes() {
  const app = new Hono();

  // POST /api/title/generate - Generate a title from a message
  app.post("/generate", (c) => handlers.generateTitle(c, getDepsFromContext(c)));

  return app;
}
