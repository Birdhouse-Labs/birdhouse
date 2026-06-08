// ABOUTME: Tests markdown reference rendering for Birdhouse-specific link types.
// ABOUTME: Verifies model references render as plain links while agent references keep modal metadata.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders Birdhouse model references as clickable labels with popover semantics", () => {
    render(() => <MarkdownRenderer content="Use [openai/gpt-5.4](birdhouse:model/openai/gpt-5.4) here." />);

    return waitFor(() => {
      const reference = screen.getByRole("button", { name: /openai\/gpt-5.4/i });
      expect(reference.className).not.toContain("agent-btn");
      expect(reference.getAttribute("aria-haspopup")).toBe("dialog");
    });
  });

  it("does not send model reference clicks through the global reference callback", () => {
    const onReferenceLinkClick = vi.fn();

    render(() => (
      <MarkdownRenderer
        content="Use [openai/gpt-5.4](birdhouse:model/openai/gpt-5.4) here."
        onReferenceLinkClick={onReferenceLinkClick}
      />
    ));

    return waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /openai\/gpt-5.4/i }));
      expect(onReferenceLinkClick).not.toHaveBeenCalled();
    });
  });

  it("sends skill reference clicks through the global reference callback", () => {
    const onReferenceLinkClick = vi.fn();

    render(() => (
      <MarkdownRenderer
        content="Use [docs helper](birdhouse:skill/find-docs) here."
        onReferenceLinkClick={onReferenceLinkClick}
      />
    ));

    return waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /docs helper/i }));
      expect(onReferenceLinkClick).toHaveBeenCalledWith({
        type: "skill",
        identifier: "find-docs",
      });
    });
  });

  it("intercepts absolute POSIX file links", async () => {
    const onFileLinkClick = vi.fn();

    render(() => (
      <MarkdownRenderer
        content="Open [notes](/Users/test/workspace/notes.md) now."
        onFileLinkClick={onFileLinkClick}
      />
    ));

    await waitFor(() => {
      const reference = screen.getByRole("button", { name: /notes/i });
      expect(reference.className).toContain("agent-btn");
      expect(reference.className).toContain("no-underline");
      expect(reference.querySelector("svg")).not.toBeNull();
      fireEvent.click(reference);
      expect(onFileLinkClick).toHaveBeenCalledWith({
        path: "/Users/test/workspace/notes.md",
        line: null,
      });
    });
  });

  it("leaves local file links as normal anchors when no file callback is provided", async () => {
    render(() => <MarkdownRenderer content="Open [notes](/Users/test/workspace/notes.md) now." />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /notes/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /notes/i })).not.toBeInTheDocument();
  });

  it("treats file URLs and plain file targets identically", async () => {
    const onFileLinkClick = vi.fn();

    render(() => (
      <MarkdownRenderer
        content="Open [notes](file:///Users/test/workspace/notes.md) now."
        onFileLinkClick={onFileLinkClick}
      />
    ));

    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /notes/i }));
      expect(onFileLinkClick).toHaveBeenCalledWith({
        path: "/Users/test/workspace/notes.md",
        line: null,
      });
    });
  });

  it("intercepts workspace-relative file links", async () => {
    const onFileLinkClick = vi.fn();

    render(() => (
      <MarkdownRenderer content="Open [component](src/components/App.tsx) now." onFileLinkClick={onFileLinkClick} />
    ));

    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /component/i }));
      expect(onFileLinkClick).toHaveBeenCalledWith({
        path: "src/components/App.tsx",
        line: null,
      });
    });
  });

  it("extracts line numbers from markdown file links", async () => {
    const onFileLinkClick = vi.fn();

    render(() => (
      <MarkdownRenderer
        content="Open [component](src/components/App.tsx#L42) now."
        onFileLinkClick={onFileLinkClick}
      />
    ));

    await waitFor(() => {
      const reference = screen.getByRole("button", { name: /component/i });
      expect(reference).toHaveTextContent("component");
      expect(reference).toHaveTextContent("#L42");
      fireEvent.click(reference);
      expect(onFileLinkClick).toHaveBeenCalledWith({
        path: "src/components/App.tsx",
        line: 42,
      });
    });
  });

  it("does not intercept regular web links as local files", async () => {
    const onFileLinkClick = vi.fn();

    render(() => (
      <MarkdownRenderer content="Use [docs](https://example.com/docs)." onFileLinkClick={onFileLinkClick} />
    ));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /docs/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("link", { name: /docs/i }));
    expect(onFileLinkClick).not.toHaveBeenCalled();
  });
});
