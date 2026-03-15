// ABOUTME: Tests the server-owned skill attachment matcher and XML enrichment.
// ABOUTME: Verifies trigger phrase matching, deduplication, ordering, and payload formatting.

import { describe, expect, it } from "bun:test";
import { buildSkillAttachmentPreview, enrichMessageWithSkillAttachments, generateSkillXML } from "./skill-attachments";

describe("skill-attachments", () => {
  describe("buildSkillAttachmentPreview", () => {
    it("matches trigger phrases case-insensitively and keeps attachment order by first occurrence", () => {
      const attachments = buildSkillAttachmentPreview(
        "Please docs please, then spotlight this branch, then DOCS PLEASE again.",
        [
          {
            name: "find-docs",
            content: "# Find Docs",
            trigger_phrases: ["docs please"],
          },
          {
            name: "git/spotlight-worktree",
            content: "# Spotlight",
            trigger_phrases: ["spotlight this branch"],
          },
        ],
      );

      expect(attachments).toEqual([
        { name: "find-docs", content: "# Find Docs" },
        { name: "git/spotlight-worktree", content: "# Spotlight" },
      ]);
    });

    it("prefers the longest trigger phrase for a skill and deduplicates repeated matches", () => {
      const attachments = buildSkillAttachmentPreview("Please use docs and then look up framework docs.", [
        {
          name: "find-docs",
          content: "# Find Docs",
          trigger_phrases: ["docs", "look up framework docs"],
        },
      ]);

      expect(attachments).toEqual([{ name: "find-docs", content: "# Find Docs" }]);
    });
  });

  describe("generateSkillXML", () => {
    it("formats a readable XML block with the skill name", () => {
      expect(generateSkillXML("find-docs", "# Find Docs")).toBe(`<skill name="find-docs">
# Find Docs
</skill>`);
    });
  });

  describe("enrichMessageWithSkillAttachments", () => {
    it("appends one XML block per attachment", () => {
      const enriched = enrichMessageWithSkillAttachments("Help me", [
        { name: "find-docs", content: "# Find Docs" },
        { name: "git/spotlight-worktree", content: "# Spotlight" },
      ]);

      expect(enriched).toBe(`Help me

<skill name="find-docs">
# Find Docs
</skill>

<skill name="git/spotlight-worktree">
# Spotlight
</skill>`);
    });
  });
});
