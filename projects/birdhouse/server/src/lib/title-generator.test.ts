// ABOUTME: Tests direct title prompt generation without pattern persistence.
// ABOUTME: Verifies title-generator always uses the dedicated prompt file and clone context.

import { describe, expect, it } from "bun:test";
import { createTestDeps, getDefaultHarness } from "../dependencies";
import { createTestAgentHarness } from "../harness";
import { buildTitleMessage, TITLE_PROMPT } from "./prompts/title-prompt";
import { generateTitle } from "./title-generator";

describe("title-generator", () => {
  it("throws an error when LLM returns an empty string", async () => {
    const deps = await createTestDeps({
      generate: async () => "",
    });

    await expect(generateTitle(deps, { message: "Do something" })).rejects.toThrow(
      "Title generation returned empty response",
    );
  });

  it("throws an error when LLM returns a whitespace-only string", async () => {
    const deps = await createTestDeps({
      generate: async () => "   ",
    });

    await expect(generateTitle(deps, { message: "Do something" })).rejects.toThrow(
      "Title generation returned empty response",
    );
  });

  it("uses the dedicated title prompt file directly", async () => {
    let capturedOptions:
      | {
          prompt?: string;
          system?: string[];
          message: string;
          small?: boolean;
          maxTokens?: number;
        }
      | undefined;

    const deps = await createTestDeps({
      generate: async (options) => {
        capturedOptions = options;
        return "Array sorting function";
      },
    });

    const result = await generateTitle(deps, {
      message: "Create a function to sort arrays",
    });

    expect(result).toEqual({ title: "Array sorting function" });
    expect(capturedOptions).toEqual({
      prompt: TITLE_PROMPT,
      system: undefined,
      message: buildTitleMessage("Create a function to sort arrays"),
      small: true,
      maxTokens: 300,
    });
  });

  it("includes clone context in system instructions", async () => {
    let capturedOptions:
      | {
          prompt?: string;
          system?: string[];
          message: string;
          small?: boolean;
          maxTokens?: number;
        }
      | undefined;

    const deps = await createTestDeps({
      generate: async (options) => {
        capturedOptions = options;
        return "Clone title";
      },
    });

    await generateTitle(deps, {
      message: "Continue debugging the auth flow",
      sourceAgentTitle: "Authentication errors after refresh",
    });

    expect(capturedOptions?.prompt).toBe(TITLE_PROMPT);
    expect(capturedOptions?.system).toEqual([
      "CLONE CONTEXT: This agent was cloned from another agent",
      "Source agent: Authentication errors after refresh",
      "Consider both the original context and new direction when generating title",
    ]);
  });

  it("throws when generate capability is absent", async () => {
    const deps = await createTestDeps();
    getDefaultHarness(deps).capabilities.generate = createTestAgentHarness({
      enableGenerate: false,
    }).capabilities.generate;

    await expect(
      generateTitle(deps, {
        message: "Create a function to sort arrays",
      }),
    ).rejects.toThrow("Title generation not supported by harness");
  });
});
