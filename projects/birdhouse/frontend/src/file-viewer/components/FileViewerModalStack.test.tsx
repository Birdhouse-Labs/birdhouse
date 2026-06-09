// ABOUTME: Tests the route-owned file viewer modal stack restored from modal query state.
// ABOUTME: Verifies relative path resolution, stacked modal restoration, and non-viewable error handling.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FileViewerModalStack from "./FileViewerModalStack";

const routingState = vi.hoisted(() => ({
  closeModal: vi.fn(),
}));

const [modalStack, setModalStack] = createSignal<Array<{ type: string; id: string }>>([]);

const serviceMocks = vi.hoisted(() => ({
  fetchFileViewerContent: vi.fn(),
  revealFileViewerPath: vi.fn(),
}));

const textEditorMock = vi.hoisted(() => vi.fn());

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
  ZIndexProvider: (props: { children: import("solid-js").JSX.Element }) => <>{props.children}</>,
}));

vi.mock("../../lib/routing", () => ({
  useModalRoute: () => ({
    modalStack,
    closeModal: routingState.closeModal,
    openModal: vi.fn(),
  }),
}));

vi.mock("../services/file-viewer-api", () => ({
  fetchFileViewerContent: (workspaceId: string, path: string) => serviceMocks.fetchFileViewerContent(workspaceId, path),
  revealFileViewerPath: (workspaceId: string, path: string) => serviceMocks.revealFileViewerPath(workspaceId, path),
}));

vi.mock("../../components/MarkdownRenderer", () => ({
  MarkdownRenderer: (props: { content: string }) => <div>{props.content}</div>,
  default: (props: { content: string }) => <div>{props.content}</div>,
}));

vi.mock("../../components/ui/TextEditor", () => ({
  default: (props: { value: string }) => {
    textEditorMock(props);
    return <div data-testid="text-editor">{props.value}</div>;
  },
}));

describe("FileViewerModalStack", () => {
  beforeEach(() => {
    setModalStack([]);
    routingState.closeModal.mockReset();
    serviceMocks.fetchFileViewerContent.mockReset();
    serviceMocks.revealFileViewerPath.mockReset();
    textEditorMock.mockReset();
  });

  it("resolves workspace-relative modal paths from the workspace root", async () => {
    setModalStack([{ type: "file-viewer", id: "src/components/App.tsx" }]);
    serviceMocks.fetchFileViewerContent.mockResolvedValueOnce({
      path: "/Users/test/workspace/src/components/App.tsx",
      name: "App.tsx",
      content: "export default function App() {}",
      language: "typescript",
      isMarkdown: false,
    });

    render(() => <FileViewerModalStack workspaceId="ws_test" workspaceDirectory="/Users/test/workspace" />);

    await waitFor(() => {
      expect(serviceMocks.fetchFileViewerContent).toHaveBeenCalledWith(
        "ws_test",
        "/Users/test/workspace/src/components/App.tsx",
      );
    });

    expect(screen.getByRole("dialog", { name: "App.tsx" })).toBeInTheDocument();
  });

  it("restores stacked file viewer modals from the route modal stack", async () => {
    setModalStack([
      { type: "file-viewer", id: "src/components/First.tsx" },
      { type: "file-viewer", id: "/Users/test/workspace/notes.md" },
    ]);
    serviceMocks.fetchFileViewerContent
      .mockResolvedValueOnce({
        path: "/Users/test/workspace/src/components/First.tsx",
        name: "First.tsx",
        content: "export const first = true;",
        language: "typescript",
        isMarkdown: false,
      })
      .mockResolvedValueOnce({
        path: "/Users/test/workspace/notes.md",
        name: "notes.md",
        content: "# Notes",
        language: "markdown",
        isMarkdown: true,
      });

    render(() => <FileViewerModalStack workspaceId="ws_test" workspaceDirectory="/Users/test/workspace" />);

    await waitFor(() => {
      expect(serviceMocks.fetchFileViewerContent).toHaveBeenNthCalledWith(
        1,
        "ws_test",
        "/Users/test/workspace/src/components/First.tsx",
      );
      expect(serviceMocks.fetchFileViewerContent).toHaveBeenNthCalledWith(
        2,
        "ws_test",
        "/Users/test/workspace/notes.md",
      );
    });

    expect(screen.getByRole("dialog", { name: "First.tsx" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "notes.md" })).toBeInTheDocument();
  });

  it("keeps the modal open with an error state and reveal affordance for non-viewable files", async () => {
    setModalStack([{ type: "file-viewer", id: "artifacts/binary.bin" }]);
    serviceMocks.fetchFileViewerContent.mockRejectedValueOnce(
      new Error("Failed to load file: Unsupported Media Type - Only text files can be viewed"),
    );
    serviceMocks.revealFileViewerPath.mockResolvedValueOnce(undefined);

    render(() => <FileViewerModalStack workspaceId="ws_test" workspaceDirectory="/Users/test/workspace" />);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "binary.bin" })).toBeInTheDocument();
    });

    expect(screen.getByText("/Users/test/workspace/artifacts/binary.bin")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText("Failed to load file: Unsupported Media Type - Only text files can be viewed"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Reveal file in Finder" }));

    await waitFor(() => {
      expect(serviceMocks.revealFileViewerPath).toHaveBeenCalledWith(
        "ws_test",
        "/Users/test/workspace/artifacts/binary.bin",
      );
    });
  });
});
