// ABOUTME: Hono context type extensions for workspace-scoped routes
// ABOUTME: Declares types for workspace middleware context values

import type { AgentsDB } from "../lib/agents-db";
import type { Workspace } from "../lib/data-db";

// Extend Hono's context with our workspace-specific variables
declare module "hono" {
  interface ContextVariableMap {
    workspace: Workspace;
    opencodePort: number;
    opencodeBase: string;
    agentsDb: AgentsDB;
  }
}
