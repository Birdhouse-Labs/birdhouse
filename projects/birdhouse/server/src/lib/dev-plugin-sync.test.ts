// ABOUTME: Tests dev-mode plugin sync into the local OpenCode checkout.
// ABOUTME: Verifies the OpenCode plugin file is refreshed even when it already exists.

import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncDevPluginSource } from "./dev-plugin-sync";

describe("syncDevPluginSource", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("updates the OpenCode plugin file when it already exists", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "birdhouse-dev-plugin-sync-"));
    tempDirs.push(tempDir);

    const pluginSource = join(tempDir, "birdhouse-plugin.ts");
    const opencodePath = join(tempDir, "opencode");
    const pluginDest = join(opencodePath, "packages", "opencode", "src", "plugin", "birdhouse.ts");

    mkdirSync(join(opencodePath, "packages", "opencode", "src", "plugin"), { recursive: true });
    writeFileSync(pluginSource, "export const version = 'fresh';\n");
    writeFileSync(pluginDest, "export const version = 'stale';\n");

    syncDevPluginSource(pluginSource, opencodePath);

    expect(readFileSync(pluginDest, "utf8")).toBe("export const version = 'fresh';\n");
  });
});
