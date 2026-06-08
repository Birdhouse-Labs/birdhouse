// ABOUTME: Tests user message rendering for inline skill references.
// ABOUTME: Verifies clicking a skill reference opens the skills library directly.

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "../../types/messages";
import ChatMessageBubble from "./ChatMessageBubble";

const openModal = vi.fn();

vi.mock("../../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

vi.mock("../../lib/routing", () => ({
  useModalRoute: () => ({ openModal }),
}));

vi.mock("../../theme", async () => {
  const actual = await vi.importActual<typeof import("../../theme")>("../../theme");
  return {
    ...actual,
    uiSize: () => "md",
  };
});

describe("ChatMessageBubble", () => {
  it("opens the referenced skill in the skills library", async () => {
    const message: Message = {
      id: "msg_skill_ref",
      role: "user",
      content: "Use [docs helper](birdhouse:skill/find-docs) before you start",
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: "Use [docs helper](birdhouse:skill/find-docs) before you start",
        },
      ],
      model: "gpt-5.4",
      provider: "openai",
      timestamp: new Date(),
    };

    render(() => <ChatMessageBubble message={message} agentId="agent_test" />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /docs helper/i }));
      expect(openModal).toHaveBeenCalledWith("skill-library-v2", "find-docs");
    });
  });

  it("opens the referenced local file in the routed file viewer", async () => {
    openModal.mockReset();

    const message: Message = {
      id: "msg_file_ref",
      role: "assistant",
      content: "Inspect [component](src/components/App.tsx#L42) next",
      blocks: [
        {
          id: "text_1",
          type: "text",
          content: "Inspect [component](src/components/App.tsx#L42) next",
        },
      ],
      model: "gpt-5.4",
      provider: "openai",
      timestamp: new Date(),
    };

    render(() => <ChatMessageBubble message={message} agentId="agent_test" />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole("button", { name: /component/i }));
      expect(openModal).toHaveBeenCalledWith("file-viewer", "src/components/App.tsx#L42");
    });
  });
});
