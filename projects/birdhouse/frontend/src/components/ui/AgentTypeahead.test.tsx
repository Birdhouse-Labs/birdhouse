// ABOUTME: Tests @@ typeahead lazy snippet loading for recent agents.
// ABOUTME: Verifies slim recent-agent rows fetch and render per-agent previews.

import { render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { AgentTypeahead } from "./AgentTypeahead";

const fetchRecentAgentSnippetMock = vi.fn();

vi.mock("../../contexts/ZIndexContext", () => ({
  useZIndex: () => 100,
}));

vi.mock("../../services/agents-api", () => ({
  fetchRecentAgentSnippet: (workspaceId: string, agentId: string) => fetchRecentAgentSnippetMock(workspaceId, agentId),
}));

describe("AgentTypeahead", () => {
  it("fetches and renders snippet previews for slim recent-agent rows", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_060_000);
    fetchRecentAgentSnippetMock.mockResolvedValue({
      lastMessageAt: 1_700_000_000_000,
      lastUserMessage: {
        text: "User follow-up",
        isAgentSent: false,
      },
      lastAgentMessage: "Agent summary",
    });

    render(() => (
      <AgentTypeahead
        referenceElement={undefined}
        inputValue="@@"
        cursorPosition={2}
        visible={true}
        workspaceId="ws_test"
        agents={[
          {
            id: "agent_1",
            title: "Recent Agent",
            session_id: "session_1",
            parent_id: null,
            tree_id: "tree_1",
          },
        ]}
        currentAgentId={undefined}
        onSelect={() => {}}
        onClose={() => {}}
      />
    ));

    await waitFor(() => {
      expect(fetchRecentAgentSnippetMock).toHaveBeenCalledWith("ws_test", "agent_1");
    });

    await waitFor(() => {
      expect(screen.getByText("Agent summary")).toBeInTheDocument();
      expect(screen.getByText("User follow-up")).toBeInTheDocument();
      expect(screen.getByText("1m ago")).toBeInTheDocument();
    });
  });
});
