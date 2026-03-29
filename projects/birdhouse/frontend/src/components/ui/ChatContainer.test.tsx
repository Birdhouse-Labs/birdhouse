// ABOUTME: Tests draft skill attachment preview behavior in the chat composer.
// ABOUTME: Verifies attached skill state clears when linked skill text is removed.

import { cleanup, fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import type { ComposerAttachment } from "../../types/composer-attachments";
import ChatContainer from "./ChatContainer";

const previewSkillAttachments = vi.fn(async (workspaceId: string, text: string) => {
  if (workspaceId !== "ws_test") {
    throw new Error(`Unexpected workspace id: ${workspaceId}`);
  }

  if (text.includes("birdhouse:skill/find-skills")) {
    return [{ name: "find-skills", content: "# Find Skills" }];
  }

  return [];
});

vi.mock("../../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("../../contexts/SkillCacheContext", () => ({
  useSkillCache: () => ({
    skills: () => [],
    loading: () => false,
    error: () => null,
    refetch: async () => {},
    getSkill: () => undefined,
  }),
}));

vi.mock("../../services/skill-attachments-api", () => ({
  previewSkillAttachments: (workspaceId: string, text: string) => previewSkillAttachments(workspaceId, text),
}));

vi.mock("../../services/agents-api", () => ({
  fetchRecentAgents: vi.fn(async () => []),
}));

describe("ChatContainer", () => {
  it("clears attached skill preview when linked skill text is deleted", async () => {
    const Wrapper = () => {
      const [value, setValue] = createSignal("[Find a skill](birdhouse:skill/find-skills)");

      return (
        <ChatContainer
          messages={[]}
          agentId="agent_test"
          inputValue={value()}
          isStreaming={false}
          onInputChange={setValue}
          onSend={() => {}}
          onStop={() => {}}
        />
      );
    };

    render(() => <Wrapper />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "1 skill" })).toBeInTheDocument();
    });

    const textbox = screen.getByRole("textbox");
    fireEvent.input(textbox, { target: { value: "" } });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "1 skill" })).not.toBeInTheDocument();
    });
  });

  it("keeps send enabled when image attachments exist without text", () => {
    const attachments: ComposerAttachment[] = [
      {
        id: "att_1",
        filename: "diagram.png",
        mime: "image/png",
        url: "data:image/png;base64,abc123",
      },
    ];

    render(() => (
      <ChatContainer
        messages={[]}
        agentId="agent_test"
        inputValue=""
        isStreaming={false}
        onInputChange={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        attachments={attachments}
        onRemoveAttachment={() => {}}
      />
    ));

    expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
  });

  it("shows inline attachment errors below the composer", () => {
    render(() => (
      <ChatContainer
        messages={[]}
        agentId="agent_test"
        inputValue=""
        isStreaming={false}
        onInputChange={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        attachmentError="Only images and PDFs can be attached."
      />
    ));

    expect(screen.getByRole("alert")).toHaveTextContent("Only images and PDFs can be attached.");
  });

  it("switches the stop button into stop tree mode", async () => {
    const onStopTreeModeChange = vi.fn();

    render(() => (
      <ChatContainer
        messages={[]}
        agentId="agent_test"
        inputValue=""
        isStreaming={true}
        onInputChange={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        stopTreeMode={false}
        onStopTreeModeChange={onStopTreeModeChange}
      />
    ));

    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enable stop tree mode" }));

    expect(onStopTreeModeChange).toHaveBeenCalledWith(true);

    cleanup();

    render(() => (
      <ChatContainer
        messages={[]}
        agentId="agent_test"
        inputValue=""
        isStreaming={true}
        onInputChange={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        stopTreeMode={true}
        onStopTreeModeChange={onStopTreeModeChange}
      />
    ));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop Tree" })).toBeInTheDocument();
    });
  });
});
