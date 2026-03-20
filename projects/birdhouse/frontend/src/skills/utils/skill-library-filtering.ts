// ABOUTME: Filters the flat visible-skill list for the library search and scope controls.
// ABOUTME: Matches by name, tags, description, and trigger phrases while preserving stable display order.

import type { SkillListScopeFilter, SkillMetadata } from "../types/skill-library-types";

export function filterSkills(
  skills: SkillMetadata[],
  searchQuery: string,
  scopeFilter: SkillListScopeFilter,
): SkillMetadata[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return skills.filter((skill) => {
    if (scopeFilter !== "all" && skill.scope !== scopeFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystacks = [
      skill.title,
      skill.description || "",
      ...skill.tags,
      ...skill.trigger_phrases,
      ...(skill.metadata_trigger_phrases ?? []),
      skill.display_location ?? "",
    ].map((value) => value.toLowerCase());
    return haystacks.some((value) => value.includes(normalizedQuery));
  });
}
