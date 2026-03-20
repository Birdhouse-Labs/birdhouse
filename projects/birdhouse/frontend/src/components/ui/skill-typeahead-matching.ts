// ABOUTME: Pure matching logic for the skill typeahead completion dropdown.
// ABOUTME: Extracted for testability — no SolidJS or DOM dependencies.

export interface SkillSuggestion {
  id: string;
  triggerPhrases: string[];
  metadataTriggerPhrases: string[];
  title: string;
}

export interface MatchResult {
  skill: SkillSuggestion;
  matchedPhrase: string; // Which trigger phrase matched
  matchedText: string; // What the user actually typed
  startIndex: number; // Where the match starts in the input
}

/**
 * Find all skills whose trigger phrases are being typed, based on text before the cursor.
 *
 * A match is accepted when:
 *  - The matched text starts at a word boundary (start of input or preceded by whitespace)
 *  - The matched text is at least 2 characters long
 *  - The trigger phrase starts with the matched text (case-insensitive)
 *
 * Returns one MatchResult per matching (skill, phrase) pair — a skill with multiple
 * matching phrases will appear multiple times so the user can pick which one to insert.
 */
export function findMatches(inputValue: string, cursorPosition: number, skills: SkillSuggestion[]): MatchResult[] {
  const textBeforeCursor = inputValue.substring(0, cursorPosition);
  const textBeforeCursorLower = textBeforeCursor.toLowerCase();

  const maxLookback = 50;
  const lookbackStart = Math.max(0, cursorPosition - maxLookback);

  const results: MatchResult[] = [];
  const seen = new Set<string>();

  const tryMatchPhrase = (skill: SkillSuggestion, phrase: string) => {
    const key = `${skill.id}\0${phrase.toLowerCase()}`;
    if (seen.has(key)) return;

    const phraseLower = phrase.toLowerCase();
    for (let start = lookbackStart; start < cursorPosition; start++) {
      // Only start a match at a word boundary
      const isWordBoundary = start === 0 || /\s/.test(textBeforeCursor.charAt(start - 1));
      if (!isWordBoundary) continue;

      const substring = textBeforeCursorLower.substring(start);
      if (phraseLower.startsWith(substring) && substring.length >= 2) {
        seen.add(key);
        results.push({
          skill,
          matchedPhrase: phrase,
          matchedText: textBeforeCursor.substring(start),
          startIndex: start,
        });
        break;
      }
    }
  };

  for (const skill of skills) {
    for (const phrase of skill.metadataTriggerPhrases) {
      tryMatchPhrase(skill, phrase);
    }
    for (const phrase of skill.triggerPhrases) {
      tryMatchPhrase(skill, phrase);
    }
    if (skill.metadataTriggerPhrases.length === 0 && skill.triggerPhrases.length === 0) {
      tryMatchPhrase(skill, skill.title);
    }
  }

  return results;
}
