// ABOUTME: Tests markdown reference rendering for Birdhouse-specific link types.
// ABOUTME: Verifies model references render as plain links while agent references keep modal metadata.

import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders Birdhouse model references as clickable labels with inline popover content", () => {
    render(() => <MarkdownRenderer content="Use [openai/gpt-5.4](birdhouse:model/openai/gpt-5.4) here." />);

    const reference = screen.getByRole("button", { name: /openai\/gpt-5.4/i });
    const popover = reference.closest(".model-popover");
    expect(popover).not.toBeNull();
    expect(reference.className).not.toContain("agent-btn");
    expect(screen.getByText("Model ID")).toBeInTheDocument();
    expect(screen.getByText("openai/gpt-5.4", { selector: ".model-popover-id" })).toBeInTheDocument();
  });

  it("does not send model reference clicks through the global reference callback", () => {
    const onReferenceLinkClick = vi.fn();

    render(() => (
      <MarkdownRenderer
        content="Use [openai/gpt-5.4](birdhouse:model/openai/gpt-5.4) here."
        onReferenceLinkClick={onReferenceLinkClick}
      />
    ));

    fireEvent.click(screen.getByRole("button", { name: /openai\/gpt-5.4/i }));

    expect(onReferenceLinkClick).not.toHaveBeenCalled();
  });
});
