// ABOUTME: Tests shared composer attachment helpers for accepted MIME handling and restore behavior.
// ABOUTME: Verifies images and PDFs stay aligned across paste, drop, and reset flows.

import { describe, expect, it, vi } from "vitest";
import {
  ACCEPTED_COMPOSER_ATTACHMENT_MIME_TYPES,
  createComposerAttachments,
  filterAcceptedComposerAttachmentFiles,
  getComposerAttachmentError,
  restoreComposerAttachments,
} from "./composerAttachments";

describe("composerAttachments", () => {
  it("filters attachments to accepted image types and pdfs", () => {
    const files = [
      new File(["png"], "diagram.png", { type: "image/png" }),
      new File(["pdf"], "notes.pdf", { type: "application/pdf" }),
      new File(["svg"], "vector.svg", { type: "image/svg+xml" }),
      new File(["txt"], "draft.txt", { type: "text/plain" }),
    ];

    expect(ACCEPTED_COMPOSER_ATTACHMENT_MIME_TYPES).toEqual([
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "application/pdf",
    ]);
    expect(filterAcceptedComposerAttachmentFiles(files).map((file) => file.name)).toEqual(["diagram.png", "notes.pdf"]);
  });

  it("creates composer attachments from accepted files", async () => {
    const files = [
      new File(["png"], "diagram.png", { type: "image/png" }),
      new File(["pdf"], "notes.pdf", { type: "application/pdf" }),
    ];

    const readAsDataURL = vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (
      this: FileReader,
      file: Blob,
    ) {
      const typedFile = file as File;
      Object.defineProperty(this, "result", {
        configurable: true,
        value: `data:${typedFile.type};base64,${typedFile.name}`,
      });
      this.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>);
    });

    const attachments = await createComposerAttachments(files);

    expect(attachments).toEqual([
      expect.objectContaining({
        filename: "diagram.png",
        mime: "image/png",
        url: "data:image/png;base64,diagram.png",
      }),
      expect.objectContaining({
        filename: "notes.pdf",
        mime: "application/pdf",
        url: "data:application/pdf;base64,notes.pdf",
      }),
    ]);

    readAsDataURL.mockRestore();
  });

  it("reports a validation error when any file is unsupported", () => {
    const files = [
      new File(["png"], "diagram.png", { type: "image/png" }),
      new File(["txt"], "draft.txt", { type: "text/plain" }),
    ];

    expect(getComposerAttachmentError(files)).toBe("Only images and PDFs can be attached.");
  });

  it("restores attachments from revert payloads for images and pdfs", () => {
    const attachments = restoreComposerAttachments([
      {
        type: "file",
        filename: "diagram.png",
        mime: "image/png",
        url: "data:image/png;base64,abc123",
      },
      {
        type: "file",
        filename: "notes.pdf",
        mime: "application/pdf",
        url: "data:application/pdf;base64,pdf123",
      },
    ]);

    expect(attachments).toEqual([
      expect.objectContaining({ filename: "diagram.png", mime: "image/png" }),
      expect.objectContaining({ filename: "notes.pdf", mime: "application/pdf" }),
    ]);
  });
});
