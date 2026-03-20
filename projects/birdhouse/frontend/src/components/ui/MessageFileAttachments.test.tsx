// ABOUTME: Tests message attachment rendering for sent file parts.
// ABOUTME: Verifies image previews and PDF cards stay visible inside message bubbles.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FileBlock } from "../../types/messages";
import MessageFileAttachments from "./MessageFileAttachments";

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

describe("MessageFileAttachments", () => {
  const originalWindowOpen = window.open;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.open = originalWindowOpen;
  });

  it("renders image attachments and opens them in a dialog", async () => {
    const attachments: FileBlock[] = [
      {
        id: "file_1",
        type: "file",
        mimeType: "image/png",
        url: "data:image/png;base64,abc123",
        filename: "sent-diagram.png",
      },
    ];

    render(() => <MessageFileAttachments attachments={attachments} />);

    expect(screen.getAllByAltText("sent-diagram.png")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Open attachment sent-diagram.png" }));

    await waitFor(() => {
      expect(screen.getAllByAltText("sent-diagram.png")).toHaveLength(2);
    });
  });

  it("opens PDF attachments in a new tab using a blob URL", async () => {
    const attachments: FileBlock[] = [
      {
        id: "file_pdf",
        type: "file",
        mimeType: "application/pdf",
        url: "data:application/pdf;base64,abc123",
        filename: "proposal.pdf",
      },
    ];

    const popup = {
      location: { href: "" },
      close: vi.fn(),
    };
    window.open = vi.fn(() => popup as unknown as WindowProxy);
    const fetchMock = vi.fn().mockResolvedValue({
      blob: async () => new Blob(["pdf-bytes"], { type: "application/pdf" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const createObjectUrlMock = vi.fn(() => "blob:https://birdhouse.test/proposal");
    const revokeObjectUrlMock = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectUrlMock,
      revokeObjectURL: revokeObjectUrlMock,
    });

    render(() => <MessageFileAttachments attachments={attachments} />);

    fireEvent.click(screen.getByRole("button", { name: "Open PDF proposal.pdf" }));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith("", "_blank", "noopener,noreferrer");
      expect(fetchMock).toHaveBeenCalledWith("data:application/pdf;base64,abc123");
      expect(createObjectUrlMock).toHaveBeenCalled();
      expect(popup.location.href).toBe("blob:https://birdhouse.test/proposal");
    });

    expect(screen.getByText("PDF")).toBeInTheDocument();
  });
});
