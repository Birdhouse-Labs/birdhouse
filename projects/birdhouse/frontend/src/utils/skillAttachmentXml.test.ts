// ABOUTME: Test suite for skill XML parsing utilities used in message rendering.
// ABOUTME: Validates snapshot extraction and XML stripping for attached skills.

import { describe, expect, it } from "vitest";
import { extractSkillsFromXML, stripSkillXML } from "./skillAttachmentXml";

describe("extractSkillsFromXML", () => {
  it("extracts skill snapshots from message content", () => {
    const input = `Please use the docs helper.

<skill name="find-docs">
# Find Docs
</skill>

<skill name="git/spotlight-worktree">
# Spotlight
</skill>`;

    expect(extractSkillsFromXML(input)).toEqual([
      { name: "find-docs", content: "# Find Docs" },
      { name: "git/spotlight-worktree", content: "# Spotlight" },
    ]);
  });

  it("deduplicates repeated skill names and keeps the first snapshot", () => {
    const input = `<skill name="find-docs">
# Find Docs
</skill>

<skill name="find-docs">
# Other Copy
</skill>`;

    expect(extractSkillsFromXML(input)).toEqual([{ name: "find-docs", content: "# Find Docs" }]);
  });
});

describe("stripSkillXML", () => {
  it("removes attached skill XML while preserving the visible message text", () => {
    const input = `Please use the docs helper.

<skill name="find-docs">
# Find Docs
</skill>`;

    expect(stripSkillXML(input)).toBe("Please use the docs helper.");
  });

  it("returns the original content when no skill XML is present", () => {
    expect(stripSkillXML("No attachments here")).toBe("No attachments here");
  });
});
