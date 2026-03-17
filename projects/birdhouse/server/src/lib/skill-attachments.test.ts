// ABOUTME: Tests the server-owned skill link parser and XML enrichment.
// ABOUTME: Verifies explicit markdown link parsing, deduplication, and payload formatting.

import { describe, expect, it } from "bun:test";
import {
  buildSkillAttachmentPreview,
  enrichMessageWithSkillAttachments,
  extractLinkedSkillNames,
  generateSkillXML,
} from "./skill-attachments";

describe("skill-attachments", () => {
  describe("extractLinkedSkillNames", () => {
    it("extracts linked skill names in first-link order and deduplicates repeated links", () => {
      const linkedSkillNames = extractLinkedSkillNames(
        "Use [docs helper](birdhouse:skill/find-docs), then [spotlight](birdhouse:skill/git%2Fspotlight-worktree), then [docs again](birdhouse:skill/find-docs).",
      );

      expect(linkedSkillNames).toEqual(["find-docs", "git/spotlight-worktree"]);
    });

    it("fails safe for malformed or undecodable skill links", () => {
      const linkedSkillNames = extractLinkedSkillNames(
        "Use [broken](birdhouse:skill/%E0%A4%A) and [plain text](https://example.com) and [missing close](birdhouse:skill/find-docs.",
      );

      expect(linkedSkillNames).toEqual([]);
    });
  });

  describe("buildSkillAttachmentPreview", () => {
    it("resolves only explicitly linked skills and keeps first-link order", () => {
      const attachments = buildSkillAttachmentPreview(
        "Please use [docs helper](birdhouse:skill/find-docs), then [spotlight](birdhouse:skill/git%2Fspotlight-worktree).",
        [
          {
            name: "find-docs",
            content: "# Find Docs",
          },
          {
            name: "git/spotlight-worktree",
            content: "# Spotlight",
          },
        ],
      );

      expect(attachments).toEqual([
        { name: "find-docs", content: "# Find Docs" },
        { name: "git/spotlight-worktree", content: "# Spotlight" },
      ]);
    });

    it("does not attach raw trigger phrase text without an explicit skill link", () => {
      const attachments = buildSkillAttachmentPreview("Please docs please before you start.", [
        {
          name: "find-docs",
          content: "# Find Docs",
        },
      ]);

      expect(attachments).toEqual([]);
    });

    it("fails safe when a linked skill is stale or missing from the visible skill list", () => {
      const attachments = buildSkillAttachmentPreview("Please use [docs helper](birdhouse:skill/find-docs).", [
        {
          name: "git/spotlight-worktree",
          content: "# Spotlight",
        },
      ]);

      expect(attachments).toEqual([]);
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
