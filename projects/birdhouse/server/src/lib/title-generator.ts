// ABOUTME: Title generation service using the harness generation capability.
// ABOUTME: Applies Birdhouse-owned title rules from a dedicated prompt file.

import { getDefaultHarness, type Deps } from "../dependencies";
import { buildTitleMessage, TITLE_PROMPT } from "./prompts/title-prompt";

export interface TitleGenerationOptions {
  message: string;
  sourceAgentTitle?: string;
}

export interface TitleGenerationResult {
  title: string;
}

/**
 * Generate a title for an agent conversation using Birdhouse title rules
 * @param deps Harness and log dependencies
 * @param options Message to generate title for
 * @returns Generated title
 */
export async function generateTitle(
  deps: Pick<Deps, "harnesses" | "log">,
  options: TitleGenerationOptions,
): Promise<TitleGenerationResult> {
  const { log } = deps;
  const harness = getDefaultHarness(deps);

  const { message, sourceAgentTitle } = options;
  const generateCapability = harness.capabilities.generate;

  // Build system instructions for clone context
  const systemInstructions: string[] = [];
  if (sourceAgentTitle) {
    systemInstructions.push(
      "CLONE CONTEXT: This agent was cloned from another agent",
      `Source agent: ${sourceAgentTitle}`,
      "Consider both the original context and new direction when generating title",
    );
  }

  log.server.debug(
    {
      messageLength: message.length,
      hasCloneContext: !!sourceAgentTitle,
    },
    "Generating title using dedicated title prompt",
  );

  try {
    if (!generateCapability) {
      throw new Error("Title generation not supported by harness");
    }

    const title = await generateCapability.generate({
      prompt: TITLE_PROMPT,
      system: systemInstructions.length > 0 ? systemInstructions : undefined,
      message: buildTitleMessage(message),
      small: true,
      maxTokens: 300,
    });

    log.server.debug({ title }, "Title generated successfully");

    return {
      title,
    };
  } catch (error) {
    log.server.error(
      {
        sourceAgentTitle,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to generate title",
    );
    throw error;
  }
}
