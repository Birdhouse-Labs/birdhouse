// ABOUTME: Tests composer attachment previews and remove actions for supported file types.
// ABOUTME: Verifies image previews and PDF cards share the composer attachment lane cleanly.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import type { ComposerAttachment } from "../../types/composer-attachments";
import ComposerImageAttachments from "./ComposerImageAttachments";

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

describe("ComposerImageAttachments", () => {
  const attachments: ComposerAttachment[] = [
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

  it("removes the selected attachment from the preview dialog and closes it", async () => {
    const onRemove = vi.fn();

    render(() => <ComposerImageAttachments attachments={attachments} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Open image preview for diagram.png" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onRemove).toHaveBeenCalledWith("att_1");

    await waitFor(() => {
      expect(screen.getAllByAltText("diagram.png")).toHaveLength(1);
    });
  });

  it("renders pdf attachments as file tiles instead of image previews", () => {
    render(() => (
      <ComposerImageAttachments
        attachments={[
          {
            id: "att_pdf",
            filename: "notes.pdf",
            mime: "application/pdf",
            url: "data:application/pdf;base64,pdf123",
          },
        ]}
        onRemove={() => {}}
      />
    ));

    expect(screen.getByRole("link", { name: "Open PDF notes.pdf" })).toBeInTheDocument();
    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
    expect(screen.queryByAltText("notes.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });
});
