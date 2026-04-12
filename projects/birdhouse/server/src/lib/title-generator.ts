// ABOUTME: Title generation service using OpenCode's LLM generation API.
// ABOUTME: Applies Birdhouse-owned title rules from a dedicated prompt file.

import type { Deps } from "../dependencies";
import { getOpenCodeDataDir } from "./database-paths";
import { buildTitleMessage, TITLE_PROMPT } from "./prompts/title-prompt";

export interface TitleGenerationOptions {
  message: string;
  sourceAgentTitle?: string;
  workspaceId?: string;
}

export interface TitleGenerationResult {
  title: string;
}

/**
 * Generate a title for an agent conversation using Birdhouse title rules
 * @param deps OpenCode and log dependencies
 * @param options Message to generate title for
 * @returns Generated title
 */
export async function generateTitle(
  deps: Pick<Deps, "opencode" | "log">,
  options: TitleGenerationOptions,
): Promise<TitleGenerationResult> {
  const {
    opencode: { generate },
    log,
  } = deps;

  const { message, sourceAgentTitle, workspaceId } = options;

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
    const title = await generate({
      prompt: TITLE_PROMPT,
      system: systemInstructions.length > 0 ? systemInstructions : undefined,
      message: buildTitleMessage(message),
      small: true,
      maxTokens: 300,
    });

    if (!title || title.trim() === "") {
      const modelJsonPath = workspaceId
        ? `${getOpenCodeDataDir(workspaceId)}/state/opencode/model.json`
        : "<workspace>/engine/state/opencode/model.json";
      const err = new Error(
        "Title generation returned empty response. The active model may not support this prompt.\n" +
          `This may be caused by a bad default model in: ${modelJsonPath}\n` +
          "Check logs for the model being used (search: service=llm path=/llm/generate).",
      );
      log.server.error(
        {
          sourceAgentTitle,
          modelJsonPath,
          hint: "Delete or clear the 'recent' array in model.json to reset the default model",
        },
        "TITLE_GENERATION_EMPTY: LLM returned empty title",
      );
      throw err;
    }

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
