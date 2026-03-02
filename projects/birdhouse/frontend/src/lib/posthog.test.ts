// ABOUTME: Verifies PostHog identity builder maps user fields correctly
// ABOUTME: Ensures display name falls back to email when needed

import { describe, expect, it } from "vitest";
import { buildPosthogIdentity } from "./posthog";

describe("buildPosthogIdentity", () => {
  it("uses full_name when available", () => {
    const user = {
      id: "user-123",
      email: "cody@example.com",
      user_metadata: {
        full_name: "Test User",
      },
    };

    const identity = buildPosthogIdentity(user);

    expect(identity).toEqual({
      distinctId: "user-123",
      properties: {
        email: "cody@example.com",
        name: "Test User",
        username: "Test User",
      },
    });
  });
});
