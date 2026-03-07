// ABOUTME: Keeps the Birdhouse plugin source synchronized into a local OpenCode checkout.
// ABOUTME: Used in server dev mode so OpenCode always sees the latest plugin implementation.

import { cpSync } from "node:fs";
import { join } from "node:path";
import { log } from "./logger";

export function syncDevPluginSource(pluginSource: string, opencodePath: string): string {
  const pluginDest = join(opencodePath, "packages", "opencode", "src", "plugin", "birdhouse.ts");

  log.server.info({ pluginSource, pluginDest }, "Dev mode: syncing plugin source to OpenCode");
  cpSync(pluginSource, pluginDest);

  return pluginDest;
}
