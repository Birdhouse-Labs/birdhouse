// ABOUTME: Unit tests for the skill typeahead matching logic.
// ABOUTME: Covers phrase matching, word boundaries, multi-phrase skills, and title fallback.

import { describe, expect, it } from "vitest";
import { findMatches, type SkillSuggestion } from "./skill-typeahead-matching";

function makeSkill(id: string, triggerPhrases: string[], metadataTriggerPhrases: string[] = []): SkillSuggestion {
  return { id, title: id, triggerPhrases, metadataTriggerPhrases };
}

const cursor = (text: string) => text.length;

describe("findMatches", () => {
  describe("basic prefix matching", () => {
    it("matches a trigger phrase typed at start of input", () => {
      const skills = [makeSkill("git-commit", ["git commit"])];
      const matches = findMatches("git co", cursor("git co"), skills);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedPhrase).toBe("git commit");
      expect(matches[0].matchedText).toBe("git co");
    });

    it("matches a trigger phrase typed after other words", () => {
      const skills = [makeSkill("git-commit", ["git commit"])];
      const input = "please help me git co";
      const matches = findMatches(input, cursor(input), skills);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedText).toBe("git co");
      expect(matches[0].startIndex).toBe(15);
    });

    it("is case-insensitive", () => {
      const skills = [makeSkill("git-commit", ["git commit"])];
      const input = "Git Co";
      const matches = findMatches(input, cursor(input), skills);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedText).toBe("Git Co");
    });

    it("does not match when fewer than 2 characters typed", () => {
      const skills = [makeSkill("git-commit", ["git commit"])];
      const matches = findMatches("g", cursor("g"), skills);
      expect(matches).toHaveLength(0);
    });

    it("matches when exactly 2 characters typed", () => {
      const skills = [makeSkill("git-commit", ["git commit"])];
      const matches = findMatches("gi", cursor("gi"), skills);
      expect(matches).toHaveLength(1);
    });
  });

  describe("word boundary requirement", () => {
    it("does not match a phrase starting mid-word", () => {
      // 'an' from 'bran' should not match 'animation'
      const skills = [makeSkill("animation-timestamps", ["animation timestamps"])];
      const input = "git bran";
      const matches = findMatches(input, cursor(input), skills);
      expect(matches).toHaveLength(0);
    });

    it("does match the same letters when they start at a word boundary", () => {
      const skills = [makeSkill("animation-timestamps", ["animation timestamps"])];
      const input = "please use an";
      const matches = findMatches(input, cursor(input), skills);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedText).toBe("an");
    });

    it("matches at the very start of the input (index 0 is a boundary)", () => {
      const skills = [makeSkill("animation-timestamps", ["animation timestamps"])];
      const input = "anim";
      const matches = findMatches(input, cursor(input), skills);
      expect(matches).toHaveLength(1);
    });

    it("matches after a newline", () => {
      const skills = [makeSkill("git-commit", ["git commit"])];
      const input = "some context\ngit co";
      const matches = findMatches(input, cursor(input), skills);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedText).toBe("git co");
    });
  });

  describe("multiple matching phrases", () => {
    it("returns one result per matching phrase on the same skill", () => {
      const skills = [makeSkill("git-commit", ["git commit", "write commit message", "commit this"])];
      const input = "commit th";
      const matches = findMatches(input, cursor(input), skills);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedPhrase).toBe("commit this");
    });

    it("returns multiple results when multiple phrases match", () => {
      const skills = [makeSkill("git-commit", ["commit message", "commit this"])];
      const input = "commit";
      const matches = findMatches(input, cursor(input), skills);
      expect(matches).toHaveLength(2);
      const phrases = matches.map((m) => m.matchedPhrase);
      expect(phrases).toContain("commit message");
      expect(phrases).toContain("commit this");
    });

    it("returns results from multiple different skills", () => {
      const skills = [makeSkill("skill-a", ["git commit"]), makeSkill("skill-b", ["git branch"])];
      const input = "git b";
      const matches = findMatches(input, cursor(input), skills);
      expect(matches).toHaveLength(1);
      expect(matches[0].skill.id).toBe("skill-b");
    });
  });

  describe("metadata trigger phrases", () => {
    it("matches phrases from metadataTriggerPhrases", () => {
      const skill = {
        id: "git-commit",
        title: "git-commit",
        triggerPhrases: [],
        metadataTriggerPhrases: ["git commit"],
      };
      const matches = findMatches("git co", cursor("git co"), [skill]);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedPhrase).toBe("git commit");
    });

    it("returns separate results for metadata and user phrases when both match", () => {
      const skill = {
        id: "git-commit",
        title: "git-commit",
        triggerPhrases: ["commit this"],
        metadataTriggerPhrases: ["commit message"],
      };
      const input = "commit";
      const matches = findMatches(input, cursor(input), [skill]);
      expect(matches).toHaveLength(2);
    });
  });

  describe("title fallback", () => {
    it("matches skill title when no trigger phrases are defined", () => {
      const skill = makeSkill("my-cool-skill", []);
      const input = "my-co";
      const matches = findMatches(input, cursor(input), [skill]);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedPhrase).toBe("my-cool-skill");
    });

    it("does not use title as fallback when trigger phrases exist", () => {
      const skill = makeSkill("my-cool-skill", ["do the thing"]);
      const input = "my-co";
      const matches = findMatches(input, cursor(input), [skill]);
      expect(matches).toHaveLength(0);
    });

    it("does not use title as fallback when only metadata phrases exist", () => {
      const skill = {
        id: "my-cool-skill",
        title: "my-cool-skill",
        triggerPhrases: [],
        metadataTriggerPhrases: ["do the thing"],
      };
      const input = "my-co";
      const matches = findMatches(input, cursor(input), [skill]);
      expect(matches).toHaveLength(0);
    });
  });

  describe("cursor position", () => {
    it("only matches against text before the cursor", () => {
      const skills = [makeSkill("git-commit", ["git commit"])];
      // cursor is in the middle — after "git " but before "extra"
      const input = "git extra";
      const cursorPos = 4; // after "git "
      const matches = findMatches(input, cursorPos, skills);
      expect(matches).toHaveLength(1);
      expect(matches[0].matchedText).toBe("git ");
    });
  });
});
