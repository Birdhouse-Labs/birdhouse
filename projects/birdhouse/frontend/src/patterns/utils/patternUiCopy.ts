// ABOUTME: Normalizes legacy pattern-based display copy into skill-based UI labels.
// ABOUTME: Keeps API shapes and internal identifiers unchanged while updating visible text.

type PatternScope = "user" | "workspace" | "birdhouse";

type PatternGroupLike = {
  id: string;
  title: string;
  description: string;
  scope: PatternScope;
};

type PatternSectionLike<TGroup extends PatternGroupLike> = {
  id: string;
  title: string;
  subtitle?: string;
  groups: TGroup[];
};

type PatternLibraryResponseLike<TGroup extends PatternGroupLike, TSection extends PatternSectionLike<TGroup>> = {
  sections: TSection[];
};

type BundleDisplayLike = {
  id: string;
  name: string;
  description: string;
  type: "personal" | "workspace" | "marketplace";
};

function isDefaultGroupId(groupId: string): boolean {
  return groupId === "default" || groupId === "user-default" || groupId.endsWith("-default");
}

function replaceTrailingPatterns(value: string): string {
  return value.endsWith(" Patterns") ? `${value.slice(0, -" Patterns".length)} Skills` : value;
}

function normalizeDefaultGroupTitle(group: PatternGroupLike): string {
  if (!isDefaultGroupId(group.id)) {
    return group.title;
  }

  if (group.scope === "user" && group.title === "Default Patterns") {
    return "Default Skills";
  }

  if (group.scope === "workspace") {
    if (group.title === "Workspace Default Patterns") {
      return "Workspace Default Skills";
    }

    return replaceTrailingPatterns(group.title);
  }

  return group.title;
}

function normalizeDefaultGroupDescription(group: PatternGroupLike): string {
  if (!isDefaultGroupId(group.id)) {
    return group.description;
  }

  if (group.description === "Your default patterns") {
    return "Your default skills";
  }

  if (group.description === "User default patterns") {
    return "User default skills";
  }

  if (group.description === "Your personal patterns") {
    return "Your personal skills";
  }

  const workspaceSpecificMatch = group.description.match(/^Patterns specific to the (.+) workspace$/);
  if (workspaceSpecificMatch) {
    return `Skills specific to the ${workspaceSpecificMatch[1]} workspace`;
  }

  const workspaceForMatch = group.description.match(/^Patterns for (.+)$/);
  if (workspaceForMatch) {
    return `Skills for ${workspaceForMatch[1]}`;
  }

  return group.description;
}

function normalizePatternSection<TGroup extends PatternGroupLike, TSection extends PatternSectionLike<TGroup>>(
  section: TSection,
): TSection {
  const normalizedGroups = section.groups.map((group) => normalizeGroupWithPatternsResponse(group));

  if (section.id === "user") {
    return {
      ...section,
      title: "Your Skills",
      subtitle: "These skills come with you to all your workspaces",
      groups: normalizedGroups,
    };
  }

  if (section.id === "birdhouse") {
    return {
      ...section,
      title: "Birdhouse Bundled Skills",
      groups: normalizedGroups,
    };
  }

  return {
    ...section,
    groups: normalizedGroups,
  };
}

export function normalizeGroupWithPatternsResponse<T extends PatternGroupLike>(group: T): T {
  return {
    ...group,
    title: normalizeDefaultGroupTitle(group),
    description: normalizeDefaultGroupDescription(group),
  };
}

export function normalizePatternLibraryResponse<
  TGroup extends PatternGroupLike,
  TSection extends PatternSectionLike<TGroup>,
  TResponse extends PatternLibraryResponseLike<TGroup, TSection>,
>(response: TResponse): TResponse {
  return {
    ...response,
    sections: response.sections.map((section) => normalizePatternSection(section)),
  };
}

export function normalizeBundleDisplayCopy<T extends BundleDisplayLike>(bundle: T): T {
  let name = bundle.name;
  let description = bundle.description;

  if (bundle.type === "personal" || bundle.type === "workspace") {
    name = replaceTrailingPatterns(name);
  }

  if (bundle.type === "personal" && description === "Your personal patterns") {
    description = "Your personal skills";
  }

  if (bundle.type === "workspace" && description === "Workspace-specific patterns") {
    description = "Workspace-specific skills";
  }

  if (description === "Patterns for version control, pull requests, and GitHub workflows.") {
    description = "Skills for version control, pull requests, and GitHub workflows.";
  }

  if (description === "Essential patterns for working with Birdhouse agents and orchestration.") {
    description = "Essential skills for working with Birdhouse agents and orchestration.";
  }

  if (description === "Patterns for common multi-agent development workflows.") {
    description = "Skills for common multi-agent development workflows.";
  }

  return {
    ...bundle,
    name,
    description,
  };
}
