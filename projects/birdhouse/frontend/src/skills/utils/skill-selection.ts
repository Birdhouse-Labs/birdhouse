// ABOUTME: Skill library selection helpers for the flat list/detail layout.
// ABOUTME: Keeps selection stable when possible and avoids defaulting to an arbitrary skill.

export function resolveSelectedSkillId(currentSkillId: string | null, visibleSkillIds: string[]): string | null {
  if (!currentSkillId) {
    return null;
  }

  return visibleSkillIds.includes(currentSkillId) ? currentSkillId : null;
}

export function resolveSelectedSkillIdAfterLoad(
  currentSkillId: string | null,
  visibleSkillIds: string[],
  hasLoaded: boolean,
): string | null {
  if (!hasLoaded) {
    return currentSkillId;
  }

  return resolveSelectedSkillId(currentSkillId, visibleSkillIds);
}

export function resolveVisibleSkillDetail<T>(selectedSkillId: string | null, detail: T | null): T | null {
  return selectedSkillId ? detail : null;
}
