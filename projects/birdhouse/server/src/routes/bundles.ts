// ABOUTME: Bundle routes for browsing pattern bundle metadata
// ABOUTME: Handles GET /api/bundles (list all) and GET /api/bundles/:id (get bundle metadata only)

import { Hono } from "hono";
import { getAllBundles, getBundleById } from "../lib/bundles-db";
import type { DataDB } from "../lib/data-db";

/**
 * Creates bundle routes with DataDB dependency
 * @param dataDb DataDB instance for accessing license and workspace data
 * @param bundlesPath Optional path to pattern-bundles directory (for testing)
 */
export function createBundleRoutes(dataDb: DataDB, bundlesPath?: string) {
  const app = new Hono();

  // GET /api/bundles?workspaceId=xxx - List all bundles
  app.get("/", async (c) => {
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    try {
      const bundles = getAllBundles(dataDb, workspaceId, bundlesPath);
      return c.json({ bundles });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // GET /api/bundles/:id?workspaceId=xxx - Get single bundle metadata (patterns accessed via pattern-groups API)
  app.get("/:id", async (c) => {
    const bundleId = c.req.param("id");
    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

    try {
      const bundle = getBundleById(bundleId, dataDb, workspaceId, bundlesPath);

      if (!bundle) {
        return c.json({ error: `Bundle ${bundleId} not found` }, 404);
      }

      return c.json(bundle);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  return app;
}
