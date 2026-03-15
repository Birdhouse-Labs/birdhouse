// ABOUTME: Utilities for building and parsing markdown links that canonically attach skills.
// ABOUTME: Keeps composer preview and link-based attachment semantics aligned around birdhouse:skill URLs.

export function buildSkillMarkdownLink(visibleText: string, skillName: string): string {
  return `[${visibleText}](birdhouse:skill/${skillName})`;
}

export function extractSkillLinkNames(text: string): string[] {
  const skillLink = /\[[^\]]+\]\(birdhouse:skill\/([^\s)]+)\)/g;
  const names = new Set<string>();

  let match: RegExpExecArray | null = skillLink.exec(text);
  while (match !== null) {
    const skillName = match[1];
    if (skillName) {
      names.add(skillName);
    }
    match = skillLink.exec(text);
  }

  return Array.from(names);
}
