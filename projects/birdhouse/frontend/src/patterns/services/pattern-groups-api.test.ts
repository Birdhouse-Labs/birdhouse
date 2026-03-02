// ABOUTME: Tests for pattern-groups API service functions
// ABOUTME: Validates API operations with mocked fetch and adapters

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the adapters
vi.mock("../adapters/pattern-groups-adapter", () => ({
  adaptPatternGroupsMetadata: vi.fn(),
  adaptPatternGroupsPattern: vi.fn(),
}));

import * as adapter from "../adapters/pattern-groups-adapter";
import { FetchPatternError } from "../types/errors";
import type { PatternGroupsAPI, PatternGroupsAPIMetadata } from "../types/pattern-groups-api-types";
import type { PatternGroupsMetadata, PatternGroupsPattern } from "../types/pattern-groups-types";
import { fetchAllPatterns, fetchPatternById } from "./pattern-groups-api";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch");
});

describe("fetchAllPatterns", () => {
  const mockWorkspaceId = "ws_test123";
  const mockAPIResponse = {
    patterns: [
      {
        id: "pat_abc123",
        title: "Debug Helper",
        description: "Helps with debugging",
        trigger_phrases: ["debug", "troubleshoot"],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
      {
        id: "pat_xyz789",
        title: "Test Pattern",
        trigger_phrases: ["test"],
        created_at: "2026-01-03T00:00:00Z",
        updated_at: "2026-01-03T00:00:00Z",
      },
    ] as PatternGroupsAPIMetadata[],
  };

  const mockAdaptedPatterns: PatternGroupsMetadata[] = [
    {
      id: "pat_abc123",
      title: "Debug Helper",
      description: "Helps with debugging",
      triggerPhrases: ["debug", "troubleshoot"],
      createdAt: new Date("2026-01-01T00:00:00Z"),
      createdAtDisplay: "Jan 1, 2026",
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      updatedAtDisplay: "Jan 2, 2026",
    },
    {
      id: "pat_xyz789",
      title: "Test Pattern",
      triggerPhrases: ["test"],
      createdAt: new Date("2026-01-03T00:00:00Z"),
      createdAtDisplay: "Jan 3, 2026",
      updatedAt: new Date("2026-01-03T00:00:00Z"),
      updatedAtDisplay: "Jan 3, 2026",
    },
  ];

  it("should successfully fetch and adapt all patterns", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAPIResponse,
    } as Response);

    vi.mocked(adapter.adaptPatternGroupsMetadata)
      .mockReturnValueOnce(mockAdaptedPatterns[0]!)
      .mockReturnValueOnce(mockAdaptedPatterns[1]!);

    const result = await fetchAllPatterns(mockWorkspaceId);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/pattern-groups/patterns?workspaceId=${mockWorkspaceId}`),
    );
    expect(adapter.adaptPatternGroupsMetadata).toHaveBeenCalledTimes(2);
    expect(result).toEqual(mockAdaptedPatterns);
  });

  it("should construct correct URL with workspace ID", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ patterns: [] }),
    } as Response);

    await fetchAllPatterns("ws_custom456");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("workspaceId=ws_custom456"));
  });

  it("should URL-encode workspace ID", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ patterns: [] }),
    } as Response);

    await fetchAllPatterns("ws_special/chars");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("workspaceId=ws_special%2Fchars"));
  });

  it("should throw FetchPatternError on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: "Missing workspaceId" }),
    } as Response);

    await expect(fetchAllPatterns(mockWorkspaceId)).rejects.toThrow(FetchPatternError);
  });

  it("should handle non-JSON error responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server is down",
    } as Response);

    await expect(fetchAllPatterns(mockWorkspaceId)).rejects.toThrow(FetchPatternError);
  });

  it("should handle network errors", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    await expect(fetchAllPatterns(mockWorkspaceId)).rejects.toThrow(FetchPatternError);
  });
});

describe("fetchPatternById", () => {
  const mockWorkspaceId = "ws_test123";
  const mockPatternId = "pat_abc123";
  const mockAPIResponse: PatternGroupsAPI = {
    id: "pat_abc123",
    title: "Debug Helper",
    description: "Helps with debugging",
    trigger_phrases: ["debug", "troubleshoot"],
    group_id: "user-default",
    prompt: "# Debug Instructions\n\nHelp the user debug their code.",
    readonly: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  };

  const mockAdaptedPattern: PatternGroupsPattern = {
    id: "pat_abc123",
    title: "Debug Helper",
    description: "Helps with debugging",
    triggerPhrases: ["debug", "troubleshoot"],
    groupId: "user-default",
    prompt: "# Debug Instructions\n\nHelp the user debug their code.",
    readonly: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    createdAtDisplay: "Jan 1, 2026",
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    updatedAtDisplay: "Jan 2, 2026",
  };

  it("should successfully fetch and adapt pattern by ID", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAPIResponse,
    } as Response);

    vi.mocked(adapter.adaptPatternGroupsPattern).mockReturnValueOnce(mockAdaptedPattern);

    const result = await fetchPatternById(mockPatternId, mockWorkspaceId);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/pattern-groups/patterns/${mockPatternId}?workspaceId=${mockWorkspaceId}`),
    );
    expect(adapter.adaptPatternGroupsPattern).toHaveBeenCalledWith(mockAPIResponse);
    expect(result).toEqual(mockAdaptedPattern);
  });

  it("should construct correct URL with pattern and workspace IDs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAPIResponse,
    } as Response);

    vi.mocked(adapter.adaptPatternGroupsPattern).mockReturnValueOnce(mockAdaptedPattern);

    await fetchPatternById("pat_custom789", "ws_custom456");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/pattern-groups/patterns/pat_custom789?workspaceId=ws_custom456"),
    );
  });

  it("should URL-encode pattern and workspace IDs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAPIResponse,
    } as Response);

    vi.mocked(adapter.adaptPatternGroupsPattern).mockReturnValueOnce(mockAdaptedPattern);

    await fetchPatternById("pat_special/chars", "ws_special/chars");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("patterns/pat_special%2Fchars?workspaceId=ws_special%2Fchars"),
    );
  });

  it("should throw FetchPatternError on 404", async () => {
    const mock404Response = {
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => JSON.stringify({ error: "Pattern not found" }),
    } as Response;

    vi.mocked(fetch).mockResolvedValueOnce(mock404Response).mockResolvedValueOnce(mock404Response);

    await expect(fetchPatternById(mockPatternId, mockWorkspaceId)).rejects.toThrow(FetchPatternError);
    await expect(fetchPatternById(mockPatternId, mockWorkspaceId)).rejects.toThrow("not found");
  });

  it("should throw FetchPatternError on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ error: "Invalid pattern ID" }),
    } as Response);

    const error = await fetchPatternById(mockPatternId, mockWorkspaceId).catch((e) => e);
    expect(error).toBeInstanceOf(FetchPatternError);
    expect(error.message).toContain("Invalid pattern ID");
  });

  it("should handle non-JSON error responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Database connection failed",
    } as Response);

    const error = await fetchPatternById(mockPatternId, mockWorkspaceId).catch((e) => e);
    expect(error).toBeInstanceOf(FetchPatternError);
    expect(error.message).toContain("Internal Server Error");
  });

  it("should handle network errors", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Failed to fetch"));

    const error = await fetchPatternById(mockPatternId, mockWorkspaceId).catch((e) => e);
    expect(error).toBeInstanceOf(FetchPatternError);
    expect(error.message).toContain("Failed to fetch");
  });
});
