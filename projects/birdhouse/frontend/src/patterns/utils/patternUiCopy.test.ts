// ABOUTME: Tests UI copy normalization for pattern library responses and bundle labels.
// ABOUTME: Verifies legacy pattern-based display strings become skill-based UI copy.

import { describe, expect, it } from "vitest";
import {
  normalizeBundleDisplayCopy,
  normalizeGroupWithPatternsResponse,
  normalizePatternLibraryResponse,
} from "./patternUiCopy";

describe("patternUiCopy", () => {
  it("normalizes legacy pattern library section and default group copy", () => {
    const response = normalizePatternLibraryResponse({
      sections: [
        {
          id: "user",
          title: "Your Patterns",
          subtitle: "These patterns come with you to all your workspaces",
          is_current: false,
          groups: [
            {
              id: "user-default",
              title: "Default Patterns",
              description: "Your default patterns",
              scope: "user" as const,
              workspace_id: null,
              pattern_count: 2,
              readonly: false,
            },
          ],
        },
        {
          id: "workspace-ws-1",
          title: "Workspace One",
          subtitle: "/tmp/workspace-one",
          is_current: true,
          groups: [
            {
              id: "workspace-ws-1-default",
              title: "Workspace One Patterns",
              description: "Patterns specific to the Workspace One workspace",
              scope: "workspace" as const,
              workspace_id: "ws-1",
              pattern_count: 1,
              readonly: false,
            },
            {
              id: "workspace-ws-1-custom",
              title: "Pattern Matching Notes",
              description: "Pattern matching references for the compiler team",
              scope: "workspace" as const,
              workspace_id: "ws-1",
              pattern_count: 1,
              readonly: false,
            },
          ],
        },
        {
          id: "birdhouse",
          title: "Birdhouse Bundled Patterns",
          is_current: false,
          groups: [],
        },
      ],
    });

    const [userSection, workspaceSection, birdhouseSection] = response.sections;
    if (!userSection || !workspaceSection || !birdhouseSection) {
      throw new Error("Expected normalized sections");
    }

    const [userDefaultGroup] = userSection.groups;
    const [workspaceDefaultGroup, workspaceCustomGroup] = workspaceSection.groups;
    if (!userDefaultGroup || !workspaceDefaultGroup || !workspaceCustomGroup) {
      throw new Error("Expected normalized groups");
    }

    expect(userSection.title).toBe("Your Skills");
    expect(userSection.subtitle).toBe("These skills come with you to all your workspaces");
    expect(userDefaultGroup.title).toBe("Default Skills");
    expect(userDefaultGroup.description).toBe("Your default skills");

    expect(workspaceDefaultGroup.title).toBe("Workspace One Skills");
    expect(workspaceDefaultGroup.description).toBe("Skills specific to the Workspace One workspace");

    expect(workspaceCustomGroup.title).toBe("Pattern Matching Notes");
    expect(workspaceCustomGroup.description).toBe("Pattern matching references for the compiler team");

    expect(birdhouseSection.title).toBe("Birdhouse Bundled Skills");
  });

  it("normalizes legacy default group copy for detail responses", () => {
    const group = normalizeGroupWithPatternsResponse({
      id: "workspace-ws-2-default",
      title: "Workspace Default Patterns",
      description: "Patterns for Workspace Two",
      scope: "workspace" as const,
      workspace_id: "ws-2",
      pattern_count: 0,
      readonly: false,
      patterns: [],
    });

    expect(group.title).toBe("Workspace Default Skills");
    expect(group.description).toBe("Skills for Workspace Two");
  });

  it("normalizes bundle display copy without touching unrelated text", () => {
    const personal = normalizeBundleDisplayCopy({
      id: "user",
      name: "Test User's Patterns",
      description: "Your personal patterns",
      type: "personal" as const,
    });

    const workspace = normalizeBundleDisplayCopy({
      id: "workspace",
      name: "Workspace Patterns",
      description: "Workspace-specific patterns",
      type: "workspace" as const,
    });

    const marketplace = normalizeBundleDisplayCopy({
      id: "git-github",
      name: "Git & GitHub",
      description: "Patterns for version control, pull requests, and GitHub workflows.",
      type: "marketplace" as const,
    });

    const untouched = normalizeBundleDisplayCopy({
      id: "custom",
      name: "Pattern Matching Toolkit",
      description: "Advanced regex and AST pattern matching.",
      type: "marketplace" as const,
    });

    expect(personal.name).toBe("Test User's Skills");
    expect(personal.description).toBe("Your personal skills");

    expect(workspace.name).toBe("Workspace Skills");
    expect(workspace.description).toBe("Workspace-specific skills");

    expect(marketplace.description).toBe("Skills for version control, pull requests, and GitHub workflows.");

    expect(untouched.name).toBe("Pattern Matching Toolkit");
    expect(untouched.description).toBe("Advanced regex and AST pattern matching.");
  });
});
