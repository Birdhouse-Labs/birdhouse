// ABOUTME: Tests helpers for canonical Birdhouse model markdown references.
// ABOUTME: Verifies autocomplete can produce stable model link text for rendering and agent prompts.

import { describe, expect, it } from "vitest";
import { buildModelMarkdownLink } from "./modelLinks";

describe("buildModelMarkdownLink", () => {
  it("builds a canonical Birdhouse model link from a model id", () => {
    expect(buildModelMarkdownLink("openai/gpt-5.4")).toBe("[openai/gpt-5.4](birdhouse:model/openai/gpt-5.4)");
  });
});
