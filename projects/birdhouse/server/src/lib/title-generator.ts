// ABOUTME: Title generation service using OpenCode's LLM generation API
// ABOUTME: Loads pattern prompts and generates titles for agent conversations

import type { Deps } from "../dependencies";
import { getPatternGroupsPersistence } from "./pattern-groups-db";

export interface TitleGenerationOptions {
  message: string;
  patternId?: string;
  sourceAgentTitle?: string;
}

export interface TitleGenerationResult {
  title: string;
  patternId: string;
}

const DEFAULT_PATTERN_ID = "title_generation_default";

/**
 * Generate a title for an agent conversation using a pattern-based prompt
 * @param deps OpenCode and log dependencies
 * @param options Message to generate title for and optional pattern ID
 * @returns Generated title and pattern ID used
 */
export async function generateTitle(
  deps: Pick<Deps, "opencode" | "log">,
  options: TitleGenerationOptions,
): Promise<TitleGenerationResult> {
  const {
    opencode: { generate },
    log,
  } = deps;

  const { message, patternId = DEFAULT_PATTERN_ID, sourceAgentTitle } = options;

  // Load pattern from pattern-groups-db
  log.server.debug({ patternId }, "Loading Birdhouse pattern for title generation");

  let patternPrompt: string | undefined;

  try {
    const patternGroupsPersistence = getPatternGroupsPersistence();
    const pattern = await patternGroupsPersistence.findBirdhousePatternById(patternId);

    if (!pattern) {
      log.server.error({ patternId }, "Failed to load Birdhouse pattern for title generation");
      throw new Error(`Birdhouse pattern with id "${patternId}" not found`);
    }

    if (!pattern.prompt || pattern.prompt.trim() === "") {
      throw new Error(`Pattern "${patternId}" has no prompt content`);
    }

    patternPrompt = pattern.prompt;
  } catch (error) {
    // In test mode, if pattern-groups persistence isn't initialized,
    // pass undefined prompt so generate() uses its default behavior
    if (error instanceof Error && error.message.includes("not initialized")) {
      log.server.warn({ patternId }, "Pattern groups persistence not initialized (test mode), using default prompt");
      patternPrompt = undefined;
    } else {
      throw error;
    }
  }

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
      patternId,
      messageLength: message.length,
      hasCloneContext: !!sourceAgentTitle,
    },
    "Generating title using pattern",
  );

  try {
    // Frame the user message as content to analyze, not instructions to follow
    const framedMessage = `Generate a title for this conversation:\n\n${message}`;

    // Call OpenCode's generate API with pattern prompt (or undefined in test mode)
    const title = await generate({
      prompt: patternPrompt,
      system: systemInstructions.length > 0 ? systemInstructions : undefined,
      message: framedMessage,
      small: true,
      maxTokens: 300,
    });

    log.server.debug({ patternId, title }, "Title generated successfully");

    return {
      title,
      patternId,
    };
  } catch (error) {
    log.server.error(
      {
        patternId,
        sourceAgentTitle,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Failed to generate title",
    );
    throw error;
  }
}
