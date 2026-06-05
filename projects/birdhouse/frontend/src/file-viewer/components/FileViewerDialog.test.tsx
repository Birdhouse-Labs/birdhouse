// ABOUTME: Tests the generic file viewer dialog used for read-only file inspection.
// ABOUTME: Verifies markdown rich/raw mode and code-view fallback for non-markdown files.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import FileViewerDialog from "./FileViewerDialog";

const { revealFileViewerPathMock } = vi.hoisted(() => ({
  revealFileViewerPathMock: vi.fn(),
}));

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

vi.mock("../services/file-viewer-api", () => ({
  fetchFileViewerContent: vi.fn(),
  revealFileViewerPath: (workspaceId: string, path: string) => revealFileViewerPathMock(workspaceId, path),
}));

describe("FileViewerDialog", () => {
  it("shows markdown in rich mode by default and can toggle to raw mode", async () => {
    render(() => (
      <FileViewerDialog
        open={true}
        onOpenChange={() => {}}
        file={{
          path: "/Users/test/references/notes.md",
          name: "notes.md",
          content: "# Notes\n\nHello world.",
          language: "markdown",
          isMarkdown: true,
        }}
        workspaceId="ws_test"
      />
    ));

    expect(screen.getByRole("button", { name: "Rich" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Raw" }));

    expect(screen.getByRole("button", { name: "Raw" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("Hello world."))).toBeInTheDocument();
    });
  });

  it("renders non-markdown files without the rich raw toggle", async () => {
    render(() => (
      <FileViewerDialog
        open={true}
        onOpenChange={() => {}}
        file={{
          path: "/Users/test/helpers.ts",
          name: "helpers.ts",
          content: "export const answer = 42;",
          language: "typescript",
          isMarkdown: false,
        }}
      />
    ));

    expect(screen.queryByRole("button", { name: "Rich" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raw" })).not.toBeInTheDocument();

    const dialog = screen.getByRole("dialog");

    await waitFor(() => {
      expect(dialog.textContent).toContain("export const answer = 42;");
    });
  });

  it("reveals the current file path in Finder", async () => {
    revealFileViewerPathMock.mockResolvedValueOnce(undefined);

    render(() => (
      <FileViewerDialog
        open={true}
        onOpenChange={() => {}}
        file={{
          path: "/Users/test/references/notes.md",
          name: "notes.md",
          content: "# Notes\n\nHello world.",
          language: "markdown",
          isMarkdown: true,
        }}
        workspaceId="ws_test"
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: "Reveal file in Finder" }));

    await waitFor(() => {
      expect(revealFileViewerPathMock).toHaveBeenCalledWith("ws_test", "/Users/test/references/notes.md");
    });
  });
});
