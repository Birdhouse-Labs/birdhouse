// ABOUTME: Proxies PostHog ingestion requests through Birdhouse server
// ABOUTME: Forwards raw request bodies to PostHog ingestion host

import { Hono } from "hono";
import { useDeps } from "../dependencies";
import { log } from "../lib/logger";

export function createPosthogRoutes() {
  const app = new Hono();

  app.all("/*", async (c) => {
    try {
      const url = new URL(c.req.url);
      const rawPath = url.pathname;
      const basePath = "/ingest";
      const trimmedPath = rawPath.startsWith(basePath) ? rawPath.slice(basePath.length) : rawPath;
      const forwardPath = trimmedPath.length === 0 ? "/" : trimmedPath;
      const path = `${forwardPath}${url.search}`;
      const method = c.req.method;
      const headers = {
        "Content-Type": c.req.header("Content-Type") ?? "application/json",
        "User-Agent": c.req.header("User-Agent") ?? "posthog-js/1.0",
      };
      const body = method === "GET" || method === "HEAD" ? undefined : await c.req.arrayBuffer();

      const { posthog } = useDeps();
      const response = await posthog.proxyIngest({ path, method, headers, body });
      const responseBody = await response.arrayBuffer();

      return new Response(responseBody, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("content-type") ?? "application/json",
        },
      });
    } catch (error) {
      log.server.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "PostHog ingest proxy error",
      );
      return c.json({ error: "Proxy error" }, 500);
    }
  });

  return app;
}
