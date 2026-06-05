// ABOUTME: File routes for workspace search and read-only file viewing.
// ABOUTME: Provides endpoints for OpenCode-backed file search and local text file inspection.

import { Hono } from "hono";
import { ReadViewableFileError, readViewableFile, revealFileInFileManager } from "../lib/file-viewer";
import { createLiveOpenCodeClient } from "../lib/opencode-client";
import "../types/context";

interface CreateFileRoutesOptions {
  revealFileInFileManager?: typeof revealFileInFileManager;
}

export function createFileRoutes(options: CreateFileRoutesOptions = {}) {
  const app = new Hono();
  const revealFile = options.revealFileInFileManager ?? revealFileInFileManager;

  app.get("/view", async (c) => {
    const filePath = c.req.query("path");

    try {
      return c.json(readViewableFile(filePath ?? ""));
    } catch (error) {
      if (error instanceof ReadViewableFileError) {
        const statusByCode: Record<ReadViewableFileError["code"], 400 | 404 | 413 | 415> = {
          invalid_path: 400,
          not_found: 404,
          not_file: 400,
          too_large: 413,
          binary: 415,
        };

        return c.json({ error: error.message }, statusByCode[error.code]);
      }

      throw error;
    }
  });

  app.post("/reveal", async (c) => {
    const body = await c.req.json();
    const filePath = typeof body.path === "string" ? body.path : "";

    if (!filePath.startsWith("/")) {
      return c.json({ error: "path must be an absolute file path" }, 400);
    }

    revealFile(filePath);
    return c.json({ success: true, path: filePath });
  });

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
