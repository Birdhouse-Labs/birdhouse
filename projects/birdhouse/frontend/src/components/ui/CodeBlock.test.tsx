// ABOUTME: Unit tests for CodeBlock component
// ABOUTME: Tests syntax highlighting rendering and error handling

import { render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import CodeBlock from "./CodeBlock";

describe("CodeBlock", () => {
  it("handles non-string code input gracefully", async () => {
    // CodeBlock now gracefully falls back to 'text' language for any errors
    render(() => <CodeBlock code={undefined as unknown as string} language="javascript" theme="github-dark" />);

    // Should still render without crashing (fallback to 'text' language)
    await waitFor(
      () => {
        const container = document.querySelector(".syntax-highlight");
        // Component renders, even with undefined code (Shiki handles it)
        expect(container).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("handles invalid language gracefully", async () => {
    render(() => <CodeBlock code="some code" language="invalidlang123" theme="github-dark" />);

    // Should either render or show an error (not stuck on Loading...)
    await waitFor(
      () => {
        const hasContent = document.querySelector(".syntax-highlight") || screen.queryByText(/Error/i);
        expect(hasContent).toBeTruthy();
      },
      { timeout: 5000 },
    );
  });

  it("renders with different themes", async () => {
    const { unmount } = render(() => <CodeBlock code="const x = 42;" language="javascript" theme="monokai" />);

    await waitFor(
      () => {
        expect(document.querySelector(".syntax-highlight")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    unmount();
  });

  it("renders syntax highlighted code with content verification", async () => {
    render(() => <CodeBlock code="const x = 123;" language="javascript" theme="github-dark" />);

    // Wait for highlighting to complete - Shiki may take time to load
    await waitFor(
      () => {
        const container = document.querySelector(".syntax-highlight");
        expect(container).toBeInTheDocument();
        // Shiki wraps each token in separate spans, so check for individual tokens
        const html = container?.innerHTML ?? "";
        expect(html).toContain("const");
        expect(html).toContain("123");
      },
      { timeout: 5000 },
    );
  });
});
