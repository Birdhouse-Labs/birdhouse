// ABOUTME: Tests workspace-scoped file routes for file search and read-only file viewing.
// ABOUTME: Verifies the file viewer endpoint returns text content safely and rejects invalid paths.

import { describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMockWorkspace, createTestApp } from "../test-utils";
import { createFileRoutes } from "./files";

describe("workspace file routes", () => {
  test("returns markdown file content and viewer metadata", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "birdhouse-file-viewer-"));

    try {
      const filePath = join(tempDir, "references", "notes.md");
      mkdirSync(join(filePath, ".."), { recursive: true });
      writeFileSync(filePath, "# Notes\n\nHello from markdown.\n", "utf-8");

      const app = await createTestApp({ workspace: createMockWorkspace({ directory: tempDir }) });
      app.route("/", createFileRoutes());

      const response = await app.request(`/view?path=${encodeURIComponent(filePath)}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        path: filePath,
        name: "notes.md",
        content: "# Notes\n\nHello from markdown.\n",
        language: "markdown",
        is_markdown: true,
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("rejects relative paths", async () => {
    const app = await createTestApp({ workspace: createMockWorkspace() });
    app.route("/", createFileRoutes());

    const response = await app.request("/view?path=notes.md");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "path must be an absolute file path" });
  });

  test("rejects binary files", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "birdhouse-file-viewer-"));

    try {
      const filePath = join(tempDir, "binary.bin");
      writeFileSync(filePath, Buffer.from([0x00, 0x01, 0x02, 0x03]));

      const app = await createTestApp({ workspace: createMockWorkspace({ directory: tempDir }) });
      app.route("/", createFileRoutes());

      const response = await app.request(`/view?path=${encodeURIComponent(filePath)}`);

      expect(response.status).toBe(415);
      expect(await response.json()).toEqual({ error: "Only text files can be viewed" });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("reveals an absolute file path in the file manager", async () => {
    const revealFile = mock(() => {});
    const app = await createTestApp({ workspace: createMockWorkspace() });
    app.route("/", createFileRoutes({ revealFileInFileManager: revealFile }));

    const response = await app.request("/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/Users/test/references/notes.md" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, path: "/Users/test/references/notes.md" });
    expect(revealFile).toHaveBeenCalledWith("/Users/test/references/notes.md");
  });
});
