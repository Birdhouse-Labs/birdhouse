// ABOUTME: Tests drag-and-drop affordances for composer attachment surfaces.
// ABOUTME: Verifies drag overlays, file drop callbacks, and inline error rendering.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import ComposerAttachmentDropZone from "./ComposerAttachmentDropZone";

describe("ComposerAttachmentDropZone", () => {
  it("shows a drop overlay while files are dragged over the composer", () => {
    render(() => (
      <ComposerAttachmentDropZone>
        <div>Composer</div>
      </ComposerAttachmentDropZone>
    ));

    const surface = screen.getByTestId("composer-attachment-drop-zone");

    fireEvent.dragEnter(surface, {
      dataTransfer: {
        types: ["Files"],
        files: [new File(["png"], "diagram.png", { type: "image/png" })],
      },
    });

    expect(screen.getByText("Drop images or PDFs to attach")).toBeInTheDocument();
  });

  it("passes dropped files to the attachment handler", async () => {
    const onAttachmentsAdded = vi.fn();

    render(() => (
      <ComposerAttachmentDropZone onAttachmentsAdded={onAttachmentsAdded}>
        <div>Composer</div>
      </ComposerAttachmentDropZone>
    ));

    const surface = screen.getByTestId("composer-attachment-drop-zone");

    const imageFile = new File(["png"], "diagram.png", { type: "image/png" });
    const pdfFile = new File(["pdf"], "notes.pdf", { type: "application/pdf" });

    fireEvent.drop(surface, {
      dataTransfer: {
        types: ["Files"],
        files: [imageFile, pdfFile],
      },
    });

    await waitFor(() => {
      expect(onAttachmentsAdded).toHaveBeenCalledWith([imageFile, pdfFile]);
    });
  });

  it("renders inline errors under the drop surface", () => {
    render(() => (
      <ComposerAttachmentDropZone error="Only images and PDFs can be attached.">
        <div>Composer</div>
      </ComposerAttachmentDropZone>
    ));

    expect(screen.getByRole("alert")).toHaveTextContent("Only images and PDFs can be attached.");
  });
});
