// ABOUTME: User profile routes for Birdhouse — stores the user's display name locally
// ABOUTME: GET returns current name, PATCH sets name; name is required before using the app

import { Hono } from "hono";
import type { DataDB } from "../lib/data-db";
import { log } from "../lib/logger";

export interface UserProfileResponse {
  name: string | null;
}

export function createUserProfileRoutes(dataDb: DataDB) {
  const app = new Hono();

  /**
   * GET /api/user-profile
   * Returns the stored user name, or null if not yet set.
   */
  app.get("/", (c) => {
    const name = dataDb.getUserName();
    return c.json<UserProfileResponse>({ name });
  });

  /**
   * PATCH /api/user-profile
   * Stores the user's display name.
   * Body: { name: string }
   */
  app.patch("/", async (c) => {
    const body = await c.req.json<{ name?: string }>();
    const { name } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return c.json({ error: "name is required" }, 400);
    }

    dataDb.setUserName(name.trim());

    log.server.info({ name: name.trim() }, "User profile name saved");

    return c.json({ ok: true });
  });

  return app;
}
