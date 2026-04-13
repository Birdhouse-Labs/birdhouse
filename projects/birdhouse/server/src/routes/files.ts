// ABOUTME: File searching routes that forward to OpenCode's Files SDK
// ABOUTME: Provides endpoints for finding files in the workspace using the OpencodeClient

import { Hono } from "hono";
import { createLiveOpenCodeClient } from "../lib/opencode-client";
import "../types/context";

export function createFileRoutes() {
  const app = new Hono();

  // POST /api/files/find/files - Find files and directories by name/pattern
  app.post("/find/files", async (c) => {
    const workspace = c.get("workspace");
    const opencodeBase = c.get("opencodeBase");
    const opencode = createLiveOpenCodeClient(opencodeBase, workspace.directory);

    // Parse query parameters
    const query = c.req.query("query");
    const dirs = c.req.query("dirs");

    if (dirs && dirs !== "true" && dirs !== "false") {
      return c.json({ error: 'dirs parameter must be "true" or "false"' }, 400);
    }

    const directory = workspace.directory;

    // Validate required parameter
    if (!query) {
      const listQueryObj: {
        path: string;
        directory?: string;
        dirs?: "true" | "false";
      } = {
        directory,
        path: "/",
      };

      if (dirs) {
        listQueryObj.dirs = dirs as "true" | "false";
      }
      const response = await opencode.client.file.list({ query: listQueryObj });
      // console.log(response.error.error)
      const filePaths = (response.data || []).map((item) => item.path);

      return c.json(filePaths);
    }

    // Build query object for OpenCode SDK
    const queryObj: {
      query: string;
      directory?: string;
      dirs?: "true" | "false";
    } = {
      query,
      directory,
    };

    if (dirs) {
      queryObj.dirs = dirs as "true" | "false";
    }

    // Call OpenCode SDK
    const response = await opencode.client.find.files({ query: queryObj });

    return c.json(response.data || []);
  });

  return app;
}
