// ABOUTME: Centralized icon definitions for semantic concepts
// ABOUTME: Single source of truth for which lucide icons represent app concepts

import { Bot, FolderCode, LibraryBig, Palette } from "lucide-solid";

/**
 * Icon representing an AI agent
 * Used in: agent buttons, agent headers, new agent button, tree items
 */
export const AgentIcon = Bot;

/**
 * Icon representing the skills library
 * Used in: skills button, skills dialogs, and attachment affordances
 */
export const SkillIcon = LibraryBig;

/**
 * Icon representing a workspace (code project directory)
 * Used in: workspace selector, workspace context popover
 */
export const WorkspaceIcon = FolderCode;

/**
 * Icon representing the dev playground
 * Used in: playground mode toggle, workspace context popover
 */
export const PlaygroundIcon = Palette;
