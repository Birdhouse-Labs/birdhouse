// ABOUTME: Tests the generic file viewer dialog used for read-only file inspection.
// ABOUTME: Verifies markdown rich/raw mode and code-view fallback for non-markdown files.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FileViewerDialog from "./FileViewerDialog";

const { revealFileViewerPathMock, textEditorMock } = vi.hoisted(() => ({
  revealFileViewerPathMock: vi.fn(),
  textEditorMock: vi.fn(),
}));

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

vi.mock("../services/file-viewer-api", () => ({
  fetchFileViewerContent: vi.fn(),
  revealFileViewerPath: (workspaceId: string, path: string) => revealFileViewerPathMock(workspaceId, path),
}));

vi.mock("../../components/ui/TextEditor", () => ({
  default: (props: { value: string; language: string; disabled?: boolean; height?: string; ariaLabel?: string }) => {
    textEditorMock(props);
    return (
      <div data-testid="text-editor" data-language={props.language} data-disabled={props.disabled ? "true" : "false"}>
        {props.value}
      </div>
    );
  },
}));

describe("FileViewerDialog", () => {
  beforeEach(() => {
    revealFileViewerPathMock.mockReset();
    textEditorMock.mockReset();
  });

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
    expect(screen.getByTestId("text-editor")).toHaveTextContent("# Notes Hello world.");
    expect(textEditorMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "# Notes\n\nHello world.",
        language: "markdown",
        disabled: true,
      }),
    );
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

    expect(screen.getByTestId("text-editor")).toHaveTextContent("export const answer = 42;");
    expect(textEditorMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: "export const answer = 42;",
        language: "typescript",
        disabled: true,
      }),
    );
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

  it("shows reveal failures in the dialog instead of rejecting unhandled", async () => {
    revealFileViewerPathMock.mockRejectedValueOnce(new Error("Failed to reveal file: Bad Request - nope"));

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
      expect(screen.getByText("Failed to reveal file: Bad Request - nope")).toBeInTheDocument();
    });
  });

  it("resets markdown mode when the dialog reopens for the same file", async () => {
    const markdownFile = {
      path: "/Users/test/references/notes.md",
      name: "notes.md",
      content: "# Notes\n\nHello world.",
      language: "markdown",
      isMarkdown: true,
    };

    const Wrapper = () => {
      const [open, setOpen] = createSignal(true);

      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            Close viewer
          </button>
          <button type="button" onClick={() => setOpen(true)}>
            Open viewer
          </button>
          <FileViewerDialog open={open()} onOpenChange={setOpen} file={markdownFile} workspaceId="ws_test" />
        </>
      );
    };

    render(() => <Wrapper />);

    fireEvent.click(screen.getByRole("button", { name: "Raw" }));
    expect(screen.getByRole("button", { name: "Raw" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Close viewer" }));
    fireEvent.click(screen.getByRole("button", { name: "Open viewer" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Rich" })).toHaveAttribute("aria-pressed", "true");
    });
  });
});
