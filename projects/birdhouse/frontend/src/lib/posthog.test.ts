// ABOUTME: Verifies PostHog user identification calls posthog.identify correctly
// ABOUTME: Ensures name is passed as the display name property

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIdentify = vi.fn();
const mockInit = vi.fn();
const mockRegister = vi.fn();
const mockReset = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    identify: mockIdentify,
    init: mockInit,
    reset: mockReset,
    config: {},
  },
}));

vi.mock("posthog-js/dist/recorder", () => ({}));
vi.mock("posthog-js/dist/external-scripts-loader", () => ({}));

// Import after mocks are set up
const { identifyPosthogUser, initPosthog } = await import("./posthog");

describe("identifyPosthogUser", () => {
  beforeEach(() => {
    mockIdentify.mockClear();
    mockInit.mockClear();
    mockRegister.mockClear();

    // Simulate the loaded callback to set initialized = true
    mockInit.mockImplementation((_key: string, opts: { loaded?: (ph: unknown) => void }) => {
      opts?.loaded?.({ register: mockRegister });
    });

    initPosthog();
  });

  it("calls posthog.identify with installId as distinctId and name as display name", () => {
    identifyPosthogUser("install-abc123", "Cody");

    expect(mockIdentify).toHaveBeenCalledWith("install-abc123", { name: "Cody" });
  });

  it("passes the name through unchanged", () => {
    identifyPosthogUser("install-xyz", "Jane Smith");

    expect(mockIdentify).toHaveBeenCalledWith("install-xyz", { name: "Jane Smith" });
  });
});
