// ABOUTME: Tests agent note storage helpers built on top of draft persistence.
// ABOUTME: Verifies note keys are namespaced and notes remain text-only.

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as draftsApi from "./drafts-api";
import { clearAgentNote, getAgentNote, saveAgentNote } from "./agent-notes-api";

vi.mock("./drafts-api", () => ({
  clearDraft: vi.fn(),
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
}));

describe("agent-notes-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads notes from a namespaced draft key", async () => {
    vi.mocked(draftsApi.getDraft).mockResolvedValue({ text: "Remember to verify CI", attachments: [] });

    const note = await getAgentNote("ws_test", "agent_123");

    expect(draftsApi.getDraft).toHaveBeenCalledWith("ws_test", "agent-note:agent_123");
    expect(note).toBe("Remember to verify CI");
  });

  it("saves notes as text-only drafts", async () => {
    vi.mocked(draftsApi.saveDraft).mockResolvedValue(undefined);

    await saveAgentNote("ws_test", "agent_123", "Track follow-up ideas");

    expect(draftsApi.saveDraft).toHaveBeenCalledWith("ws_test", "agent-note:agent_123", {
      text: "Track follow-up ideas",
      attachments: [],
    });
  });

  it("clears notes using the namespaced draft key", async () => {
    vi.mocked(draftsApi.clearDraft).mockResolvedValue(undefined);

    await clearAgentNote("ws_test", "agent_123");

    expect(draftsApi.clearDraft).toHaveBeenCalledWith("ws_test", "agent-note:agent_123");
  });
});
