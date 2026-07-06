// ABOUTME: Tests for launch token exchange on app boot
// ABOUTME: Verifies URL cleanup and graceful error handling

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../config/api", () => ({
  API_BASE_URL: "http://localhost:50121",
}));

const mockFetch = vi.fn();
const mockReplaceState = vi.fn();

/**
 * Sets up window.location and window.history mocks for a given URL.
 */
function setupLocation(search: string, hash = "#/", pathname = "/") {
  Object.defineProperty(window, "location", {
    value: { search, hash, pathname, origin: "http://localhost:50121" },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "history", {
    value: { replaceState: mockReplaceState },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "fetch", {
    value: mockFetch,
    writable: true,
    configurable: true,
  });
}

describe("exchangeLaunchToken", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockReplaceState.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  test("does nothing when no launch_token param is present", async () => {
    setupLocation("");
    const { exchangeLaunchToken } = await import("./launch-token");

    await exchangeLaunchToken();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockReplaceState).not.toHaveBeenCalled();
  });

  test("POSTs to /api/auth/launch-token when param is present", async () => {
    setupLocation("?launch_token=test-token-abc", "#/setup");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const { exchangeLaunchToken } = await import("./launch-token");
    await exchangeLaunchToken();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:50121/api/auth/launch-token",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ token: "test-token-abc" }),
      }),
    );
  });

  test("removes launch_token from URL after successful exchange", async () => {
    setupLocation("?launch_token=test-token-abc", "#/setup");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const { exchangeLaunchToken } = await import("./launch-token");
    await exchangeLaunchToken();

    expect(mockReplaceState).toHaveBeenCalledWith(null, "", "/#/setup");
  });

  test("removes launch_token from URL even on fetch failure (silent fail)", async () => {
    setupLocation("?launch_token=test-token-abc", "#/setup");

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { exchangeLaunchToken } = await import("./launch-token");

    // Should not throw
    await expect(exchangeLaunchToken()).resolves.toBeUndefined();

    // URL should still be cleaned up
    expect(mockReplaceState).toHaveBeenCalledWith(null, "", "/#/setup");
  });

  test("removes launch_token from URL when server returns 401 (expired/used)", async () => {
    setupLocation("?launch_token=expired-token", "#/");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid or expired launch token" }),
    });

    const { exchangeLaunchToken } = await import("./launch-token");
    await exchangeLaunchToken();

    // URL cleaned up regardless of server response — pathname + hash, no query
    expect(mockReplaceState).toHaveBeenCalledWith(null, "", "/#/");
  });

  test("removes only launch_token when other query params are present", async () => {
    setupLocation("?launch_token=test-token&other_param=keep", "#/");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const { exchangeLaunchToken } = await import("./launch-token");
    await exchangeLaunchToken();

    // launch_token removed, other_param kept
    const call = mockReplaceState.mock.calls[0]!;
    expect(call[2]).toContain("other_param=keep");
    expect(call[2]).not.toContain("launch_token");
  });
});
