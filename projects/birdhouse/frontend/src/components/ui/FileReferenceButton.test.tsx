// ABOUTME: Tests inline file reference interactions that differentiate local files from web links.
// ABOUTME: Verifies the tooltip shows the full resolved path immediately on hover.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import FileReferenceButton from "./FileReferenceButton";

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

describe("FileReferenceButton", () => {
  it("shows the full resolved path in an instant tooltip", async () => {
    const onClick = vi.fn();

    render(() => (
      <FileReferenceButton
        label="nested.md"
        path="docs/nested.md"
        line={42}
        workspaceDirectory="/Users/test/workspace"
        baseZIndex={170}
        onClick={onClick}
      />
    ));

    const button = screen.getByRole("button", { name: /nested.md/i });
    fireEvent.pointerEnter(button);

    await waitFor(() => {
      expect(screen.getByText("/Users/test/workspace/docs/nested.md#L42")).toBeInTheDocument();
    });

    const tooltip = screen.getByText("/Users/test/workspace/docs/nested.md#L42").closest("[role='tooltip']");
    expect(tooltip).toHaveStyle({ "z-index": "170" });
  });
});
