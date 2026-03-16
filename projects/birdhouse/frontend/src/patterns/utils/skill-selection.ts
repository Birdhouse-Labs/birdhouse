// ABOUTME: Skill library selection helpers for the flat list/detail layout.
// ABOUTME: Keeps selection stable when possible and avoids defaulting to an arbitrary skill.

export function resolveSelectedSkillId(currentSkillId: string | null, visibleSkillIds: string[]): string | null {
  if (!currentSkillId) {
    return null;
  }

  return visibleSkillIds.includes(currentSkillId) ? currentSkillId : null;
}
