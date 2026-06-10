// ABOUTME: Covers file viewer path helper behavior for workspace-relative links.
// ABOUTME: Verifies literal percent characters and Windows workspace roots resolve safely.

import { describe, expect, test } from "vitest";
import { resolveWorkspaceFilePath } from "./paths";

describe("resolveWorkspaceFilePath", () => {
  test("keeps literal percent characters in workspace-relative filenames", () => {
    expect(resolveWorkspaceFilePath("/Users/test/workspace", "docs/100% coverage.md")).toBe(
      "/Users/test/workspace/docs/100% coverage.md",
    );
  });

  test("resolves relative paths against Windows workspace roots", () => {
    expect(resolveWorkspaceFilePath("C:\\Users\\test\\workspace", "src/App.tsx")).toBe(
      "/C:/Users/test/workspace/src/App.tsx",
    );
  });

  test("resolves relative paths against Windows drive-root workspaces", () => {
    expect(resolveWorkspaceFilePath("C:/", "src/App.tsx")).toBe("/C:/src/App.tsx");
  });
});
