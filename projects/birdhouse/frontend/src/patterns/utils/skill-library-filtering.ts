// ABOUTME: Filters the flat visible-skill list for the library search and scope controls.
// ABOUTME: Matches by name, description, and trigger phrases while preserving stable display order.

import type { PatternMetadata, SkillListScopeFilter } from "../types/pattern-library-types";

export function filterSkills(
  skills: PatternMetadata[],
  searchQuery: string,
  scopeFilter: SkillListScopeFilter,
): PatternMetadata[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return skills.filter((skill) => {
    if (scopeFilter !== "all" && skill.scope !== scopeFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystacks = [skill.title, skill.description || "", ...skill.trigger_phrases].map((value) =>
      value.toLowerCase(),
    );
    return haystacks.some((value) => value.includes(normalizedQuery));
  });
}
