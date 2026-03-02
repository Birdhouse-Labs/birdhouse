// ABOUTME: Server runtime configuration endpoint
// ABOUTME: Exposes feature flags derived from environment variables to the frontend

import { Hono } from "hono";

export interface ServerConfig {
  playgroundEnabled: boolean;
}

export function createConfigRoutes() {
  const app = new Hono();

  /**
   * GET /api/config
   * Returns runtime feature flags for the frontend.
   * playgroundEnabled is controlled by BIRDHOUSE_ENABLE_PLAYGROUND=true.
   */
  app.get("/", (c) => {
    const playgroundEnabled = process.env.BIRDHOUSE_ENABLE_PLAYGROUND === "true";
    return c.json<ServerConfig>({ playgroundEnabled });
  });

  return app;
}
