// ABOUTME: Tests for drafts API service functions
// ABOUTME: Validates get, save, and clear draft operations with mocked fetch

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Draft } from "./drafts-api";
import { clearDraft, getDraft, saveDraft } from "./drafts-api";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch");
});

const mockWorkspaceId = "ws_test123";
const mockDraftId = "new-agent";
const mockDraft: Draft = {
  text: "Hello, world!",
  attachments: [
    {
      filename: "image.png",
      mime: "image/png",
      url: "data:image/png;base64,abc123",
    },
  ],
};

describe("getDraft", () => {
  it("returns parsed draft on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDraft,
    } as Response);

    const result = await getDraft(mockWorkspaceId, mockDraftId);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/drafts/${mockDraftId}`));
    expect(result).toEqual(mockDraft);
  });

  it("returns null on 404 (treat as empty draft, not an error)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await getDraft(mockWorkspaceId, mockDraftId);

    expect(result).toBeNull();
  });

  it("throws on 500", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    await expect(getDraft(mockWorkspaceId, mockDraftId)).rejects.toThrow("Failed to get draft");
  });

  it("constructs correct URL with workspace and draft IDs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockDraft,
    } as Response);

    await getDraft("ws_abc", "agent_xyz");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/workspace/ws_abc/drafts/agent_xyz"));
  });
});

describe("saveDraft", () => {
  it("sends correct PUT body including attachments array", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    await saveDraft(mockWorkspaceId, mockDraftId, mockDraft);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/drafts/${mockDraftId}`),
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockDraft),
      }),
    );
  });

  it("sends correct body including full attachments array", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    const draftWithAttachments: Draft = {
      text: "Draft with attachments",
      attachments: [
        { filename: "photo.png", mime: "image/png", url: "data:image/png;base64,xyz" },
        { filename: "doc.pdf", mime: "application/pdf", url: "data:application/pdf;base64,pdf123" },
      ],
    };

    await saveDraft(mockWorkspaceId, mockDraftId, draftWithAttachments);

    const call = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(call[1]?.body as string);
    expect(body.attachments).toHaveLength(2);
    expect(body.attachments[0]).toEqual({ filename: "photo.png", mime: "image/png", url: "data:image/png;base64,xyz" });
    expect(body.attachments[1]).toEqual({
      filename: "doc.pdf",
      mime: "application/pdf",
      url: "data:application/pdf;base64,pdf123",
    });
  });

  it("throws on 413", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 413,
      statusText: "Payload Too Large",
    } as Response);

    await expect(saveDraft(mockWorkspaceId, mockDraftId, mockDraft)).rejects.toThrow("Failed to save draft");
  });

  it("throws on other non-2xx responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    await expect(saveDraft(mockWorkspaceId, mockDraftId, mockDraft)).rejects.toThrow("Failed to save draft");
  });

  it("resolves without error on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    await expect(saveDraft(mockWorkspaceId, mockDraftId, mockDraft)).resolves.toBeUndefined();
  });
});

describe("clearDraft", () => {
  it("sends DELETE request to the correct URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as Response);

    await clearDraft(mockWorkspaceId, mockDraftId);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/drafts/${mockDraftId}`),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws on non-2xx responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    await expect(clearDraft(mockWorkspaceId, mockDraftId)).rejects.toThrow("Failed to clear draft");
  });

  it("resolves without error on 200", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    await expect(clearDraft(mockWorkspaceId, mockDraftId)).resolves.toBeUndefined();
  });
});
