// ABOUTME: Unit tests for CodeBlockContainer component
// ABOUTME: Tests header rendering, copy button, and integration with CodeBlock

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import CodeBlockContainer from "./CodeBlockContainer";

describe("CodeBlockContainer", () => {
  it("renders with required props", async () => {
    render(() => <CodeBlockContainer code="const x = 123;" language="typescript" theme="github-dark" />);

    // Should render the language name in header
    await waitFor(() => {
      expect(screen.getByText("typescript")).toBeInTheDocument();
    });

    // Should render CodeBlock internally (check for syntax-highlight class)
    await waitFor(
      () => {
        expect(document.querySelector(".syntax-highlight")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("shows displayName when provided, falls back to language", async () => {
    const { unmount } = render(() => (
      <CodeBlockContainer code="const x = 123;" language="typescript" displayName="TypeScript" theme="github-dark" />
    ));

    // Should show the branded displayName, not the language ID
    await waitFor(() => {
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
      expect(screen.queryByText("typescript")).not.toBeInTheDocument();
    });

    unmount();

    // Without displayName, should show language
    render(() => <CodeBlockContainer code="const x = 123;" language="typescript" theme="github-dark" />);

    await waitFor(() => {
      expect(screen.getByText("typescript")).toBeInTheDocument();
    });
  });

  it("shows title when provided", async () => {
    render(() => (
      <CodeBlockContainer code="console.log('test');" language="javascript" theme="github-dark" title="Example Code" />
    ));

    await waitFor(() => {
      expect(screen.getByText("Example Code")).toBeInTheDocument();
    });
  });

  it("hides title when not provided", async () => {
    render(() => <CodeBlockContainer code="console.log('test');" language="javascript" theme="github-dark" />);

    // Should not render any title element
    const container = document.querySelector(".text-center");
    expect(container).toBeNull();
  });

  it("copy button copies code and shows confirmation", async () => {
    // Mock clipboard API
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(() => <CodeBlockContainer code="const test = 123;" language="javascript" theme="github-dark" />);

    // Find and click the copy button
    const copyButton = await screen.findByLabelText("Copy code to clipboard");
    fireEvent.click(copyButton);

    // Should call clipboard API with correct code
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("const test = 123;");
    });

    // Should show "Copied!" confirmation
    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });

    // Should revert back to "Copy" after 2 seconds
    await waitFor(
      () => {
        expect(screen.getByText("Copy")).toBeInTheDocument();
        expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
      },
      { timeout: 2500 },
    );
  });

  it("hides copy button when showCopyButton is false", async () => {
    render(() => (
      <CodeBlockContainer code="const x = 123;" language="typescript" theme="github-dark" showCopyButton={false} />
    ));

    // Copy button should not be in the document
    const copyButton = screen.queryByLabelText("Copy code to clipboard");
    expect(copyButton).toBeNull();
  });
});
