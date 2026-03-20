// ABOUTME: Tests composer image attachment previews and modal interactions.
// ABOUTME: Verifies hover-remove controls do not interfere with image preview opening.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import type { ComposerImageAttachment } from "../../types/composer-attachments";
import ComposerImageAttachments from "./ComposerImageAttachments";

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

describe("ComposerImageAttachments", () => {
  const attachments: ComposerImageAttachment[] = [
    {
      id: "att_1",
      filename: "diagram.png",
      mime: "image/png",
      url: "data:image/png;base64,abc123",
    },
  ];

  it("opens a larger preview dialog when an attachment is clicked", async () => {
    render(() => <ComposerImageAttachments attachments={attachments} onRemove={() => {}} />);

    expect(screen.getAllByAltText("diagram.png")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Open image preview for diagram.png" }));

    await waitFor(() => {
      expect(screen.getAllByAltText("diagram.png")).toHaveLength(2);
    });
  });

  it("calls onRemove without opening the preview dialog", async () => {
    const onRemove = vi.fn();

    render(() => <ComposerImageAttachments attachments={attachments} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove diagram.png" }));

    expect(onRemove).toHaveBeenCalledWith("att_1");

    await waitFor(() => {
      expect(screen.getAllByAltText("diagram.png")).toHaveLength(1);
    });
  });
});
