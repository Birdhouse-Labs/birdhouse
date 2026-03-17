// ABOUTME: Tests for the provider registry metadata
// ABOUTME: Verifies all expected providers are present with correct ids and labels

import { describe, expect, it } from "vitest";
import { PROVIDERS } from "./provider-registry";

describe("PROVIDERS registry", () => {
  it("includes zAI provider with correct id", () => {
    const zai = PROVIDERS.find((p) => p.id === "zai");
    expect(zai).toBeDefined();
  });

  it("includes zAI provider with correct label", () => {
    const zai = PROVIDERS.find((p) => p.id === "zai");
    expect(zai?.label).toBe("Z.AI (GLM)");
  });

  it("includes zAI provider with correct docUrl", () => {
    const zai = PROVIDERS.find((p) => p.id === "zai");
    expect(zai?.docUrl).toBe("https://z.ai");
  });

  it("includes Fireworks provider with correct id", () => {
    const fireworks = PROVIDERS.find((p) => p.id === "fireworks");
    expect(fireworks).toBeDefined();
  });

  it("includes Fireworks provider with correct label", () => {
    const fireworks = PROVIDERS.find((p) => p.id === "fireworks");
    expect(fireworks?.label).toBe("Fireworks");
  });

  it("includes Fireworks provider with correct docUrl", () => {
    const fireworks = PROVIDERS.find((p) => p.id === "fireworks");
    expect(fireworks?.docUrl).toBe("https://fireworks.ai");
  });

  it("contains all expected Tier 1 providers", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toContain("anthropic");
    expect(ids).toContain("openai");
    expect(ids).toContain("google");
    expect(ids).toContain("openrouter");
    expect(ids).toContain("groq");
    expect(ids).toContain("perplexity");
    expect(ids).toContain("xai");
    expect(ids).toContain("mistral");
    expect(ids).toContain("cohere");
    expect(ids).toContain("deepinfra");
    expect(ids).toContain("cerebras");
    expect(ids).toContain("together");
    expect(ids).toContain("zai");
    expect(ids).toContain("fireworks");
  });
});
