// ABOUTME: Tests message attachment rendering for sent file parts.
// ABOUTME: Verifies image attachments remain visible and can open in a dialog.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import type { FileBlock } from "../../types/messages";
import MessageFileAttachments from "./MessageFileAttachments";

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

describe("MessageFileAttachments", () => {
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
});
