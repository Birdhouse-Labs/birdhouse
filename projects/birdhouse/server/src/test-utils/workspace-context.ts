// ABOUTME: Test utilities for mocking workspace context in route tests
// ABOUTME: Provides helper to inject workspace middleware context into Hono test apps

import { Hono } from "hono";
import type { AgentsDB } from "../lib/agents-db";
import { createAgentsDB } from "../lib/agents-db";
import type { Workspace } from "../lib/data-db";

/**
 * Mock workspace context for tests
 */
export interface MockWorkspaceContext {
  workspace?: Workspace;
  opencodePort?: number;
  opencodeBase?: string;
  agentsDb?: AgentsDB;
}

/**
 * Create a Hono app with workspace context middleware
 * Used to inject workspace context into route tests
 *
 * @param routeFactory - Function that creates the route handler (e.g., createAgentRoutes)
 * @param context - Optional context overrides (if agentsDb not provided, creates new in-memory DB)
 */
export function withWorkspaceContext(routeFactory: () => Hono, context?: MockWorkspaceContext): Hono {
  const defaultWorkspace: Workspace = {
    workspace_id: "test-workspace",
    directory: "/test/workspace",
    opencode_port: 3000,
    opencode_pid: null,
    created_at: new Date().toISOString(),
    last_used: new Date().toISOString(),
  };

  // Use provided agentsDb or create a new one
  // If caller provides agentsDb in deps, it should also pass it here
  const agentsDb = context?.agentsDb || createAgentsDB(":memory:");

  const fullContext: Required<MockWorkspaceContext> = {
    workspace: context?.workspace || defaultWorkspace,
    opencodePort: context?.opencodePort || 3000,
    opencodeBase: context?.opencodeBase || "http://127.0.0.1:3000",
    agentsDb,
  };

  // Create a new app that wraps the route app
  const wrapper = new Hono();

  // Add middleware that injects workspace context
  wrapper.use("*", async (c, next) => {
    c.set("workspace", fullContext.workspace);
    c.set("opencodePort", fullContext.opencodePort);
    c.set("opencodeBase", fullContext.opencodeBase);
    c.set("agentsDb", fullContext.agentsDb);
    await next();
  });

  // Mount the routes
  const routes = routeFactory();
  wrapper.route("/", routes);

  return wrapper;
}

/**
 * Create default mock workspace for tests
 */
export function createMockWorkspace(overrides?: Partial<Workspace>): Workspace {
  return {
    workspace_id: "test-workspace",
    directory: "/test/workspace",
    opencode_port: 3000,
    opencode_pid: null,
    created_at: new Date().toISOString(),
    last_used: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a Hono test app with workspace context pre-configured
 *
 * Simpler alternative to withWorkspaceContext() for tests using inline route handlers.
 * Sets up workspace context middleware that mirrors production behavior.
 *
 * @param overrides - Optional context overrides (if agentsDb not provided, creates new in-memory DB)
 * @returns Configured Hono app ready for route mounting
 *
 * @example
 * ```typescript
 * const app = createTestApp();
 * app.patch("/:id/archive", (c) => archive(c, deps));
 * const res = await app.request("/agent_123/archive", { method: "PATCH" });
 * ```
 *
 * @example With overrides
 * ```typescript
 * const agentsDB = createAgentsDB(":memory:");
 * const app = createTestApp({ agentsDb: agentsDB });
 * ```
 */
export function createTestApp(overrides?: MockWorkspaceContext): Hono {
  const defaultWorkspace: Workspace = createMockWorkspace();

  // Use provided agentsDb or create a new one
  const agentsDb = overrides?.agentsDb || createAgentsDB(":memory:");

  const fullContext: Required<MockWorkspaceContext> = {
    workspace: overrides?.workspace || defaultWorkspace,
    opencodePort: overrides?.opencodePort || 3000,
    opencodeBase: overrides?.opencodeBase || "http://127.0.0.1:3000",
    agentsDb,
  };

  // Create app with workspace context middleware
  const app = new Hono();

  // Add middleware that injects workspace context
  app.use("*", async (c, next) => {
    c.set("workspace", fullContext.workspace);
    c.set("opencodePort", fullContext.opencodePort);
    c.set("opencodeBase", fullContext.opencodeBase);
    c.set("agentsDb", fullContext.agentsDb);
    await next();
  });

  return app;
}
