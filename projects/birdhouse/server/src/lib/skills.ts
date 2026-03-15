// ABOUTME: Normalizes OpenCode skills into Birdhouse API-ready skill records.
// ABOUTME: Handles v1 scope inference and skill lookup by name for workspace requests.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { load } from "js-yaml";
import type { Skill as OpenCodeSkill } from "./opencode-client";

export type SkillScope = "workspace" | "global";

export interface BirdhouseSkillSummary {
  id: string;
  name: string;
  description: string;
  scope: SkillScope;
  trigger_phrases: string[];
  readonly: true;
}

export interface BirdhouseSkillDetail extends BirdhouseSkillSummary {
  content: string;
  location: string;
  files: string[];
  metadata: Record<string, unknown>;
}

function parseSkillMetadata(skillFilePath: string): Record<string, unknown> {
  if (!existsSync(skillFilePath)) {
    return {};
  }

  const content = readFileSync(skillFilePath, "utf-8");
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }

  try {
    const parsed = load(match[1]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function collectSkillFiles(rootDirectory: string, currentDirectory: string): string[] {
  const entries = readdirSync(currentDirectory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSkillFiles(rootDirectory, absolutePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = relative(rootDirectory, absolutePath).split(sep).join("/");
    if (relativePath === "SKILL.md") {
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

export function inferSkillScope(location: string, workspaceDirectory: string): SkillScope {
  const resolvedLocation = resolve(location);
  const resolvedWorkspaceDirectory = resolve(workspaceDirectory);
  const relativePath = relative(resolvedWorkspaceDirectory, resolvedLocation);
  return !relativePath.startsWith("..") && relativePath !== "" ? "workspace" : "global";
}

export function toBirdhouseSkillSummary(
  skill: OpenCodeSkill,
  workspaceDirectory: string,
  triggerPhrases: string[],
): BirdhouseSkillSummary {
  return {
    id: skill.name,
    name: skill.name,
    description: skill.description,
    scope: inferSkillScope(skill.location, workspaceDirectory),
    trigger_phrases: triggerPhrases,
    readonly: true,
  };
}

export async function toBirdhouseSkillDetail(
  skill: OpenCodeSkill,
  workspaceDirectory: string,
  triggerPhrases: string[],
): Promise<BirdhouseSkillDetail> {
  const skillDirectory = dirname(skill.location);
  const metadata = await parseSkillMetadata(skill.location);

  return {
    ...toBirdhouseSkillSummary(skill, workspaceDirectory, triggerPhrases),
    content: skill.content,
    location: skill.location,
    files: existsSync(skillDirectory) ? collectSkillFiles(skillDirectory, skillDirectory) : [],
    metadata,
  };
}

export function findSkillByName(skills: OpenCodeSkill[], name: string): OpenCodeSkill | undefined {
  return skills.find((skill) => skill.name === name);
}
