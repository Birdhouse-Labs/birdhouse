// ABOUTME: Pattern Library UI experiment - VS Code-inspired marketplace with bundle-first approach
// ABOUTME: Explores organizing patterns into installable bundles with user/workspace scope installation

import { useSearchParams } from "@solidjs/router";
import Dialog from "corvu/dialog";
import { LibraryBig, Search, X } from "lucide-solid";
import type { Component } from "solid-js";
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import { Button } from "../../components/ui";
import { serializeModalStack, useModalRoute, useWorkspaceId } from "../../lib/routing";
import { normalizeBundleDisplayCopy } from "../../patterns/utils/patternUiCopy";
import { cardSurfaceFlat } from "../../styles/containerStyles";
import { type BundleAPI, type BundleAPIMetadata, fetchBundle, fetchBundles } from "./bundles-api";

export const metadata = {
  id: "01",
  title: "Bundle-First Marketplace (VS Code Style)",
  description:
    "Skills organized into installable bundles (like VS Code extensions). Features bundle-level install, scope selection (user/workspace), and split-panel browsing.",
  date: "2025-02-23",
};

// ============================================================================
// TYPES
// ============================================================================

interface Pattern {
  id: string;
  title: string;
  description: string; // Brief markdown
  prompt: string; // Full prompt content
  triggerPhrases: string[];
}

interface PatternBundle {
  id: string;
  name: string;
  type: "personal" | "workspace" | "marketplace";
  description: string;
  patterns: Pattern[];
  installed: boolean; // Bundle-level install only
  patternCount: number;
}

/**
 * Convert API bundle metadata to UI bundle type
 */
function adaptBundleMetadata(apiBundles: BundleAPIMetadata[]): PatternBundle[] {
  return apiBundles.map((bundle) => {
    const displayBundle = normalizeBundleDisplayCopy(bundle);

    return {
      id: bundle.id,
      name: displayBundle.name,
      type: bundle.type,
      description: displayBundle.description,
      installed: bundle.installed,
      patternCount: bundle.pattern_count,
      patterns: [], // Will be loaded when bundle is selected
    };
  });
}

/**
 * Convert API bundle with patterns to UI bundle type
 */
function adaptBundleWithPatterns(apiBundle: BundleAPI): PatternBundle {
  const displayBundle = normalizeBundleDisplayCopy(apiBundle);

  return {
    id: apiBundle.id,
    name: displayBundle.name,
    type: apiBundle.type,
    description: displayBundle.description,
    installed: apiBundle.installed,
    patternCount: apiBundle.pattern_count,
    patterns: apiBundle.patterns.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      triggerPhrases: p.trigger_phrases,
      prompt: "", // Prompt content not included in bundle endpoint
    })),
  };
}

// ============================================================================
// MOCK DATA (Fallback for development)
// ============================================================================

const MOCK_BUNDLES_FALLBACK: PatternBundle[] = [
  {
    id: "birdhouse-core",
    name: "Birdhouse Core",
    type: "marketplace",
    description:
      "Essential skills for agent orchestration and collaboration. Covers delegation strategies, skill creation workflows, inter-agent communication, and testing delegation patterns.",
    installed: true,
    patternCount: 4,
    patterns: [
      {
        id: "agent-delegation",
        title: "Agent Delegation Strategy",
        description:
          "Guidelines for when and how to delegate tasks to child agents. Covers parallel work, context isolation, and manager patterns.",
        prompt: `# Agent Delegation Strategy

When delegating work to child agents, follow these principles:

## When to Delegate
- **Context isolation**: Keep separate concerns in separate agents
- **Parallel work**: Spawn multiple agents for independent tasks
- **Noise reduction**: Delegate long investigations or implementations

## Delegation Patterns
1. **Plan-then-implement**: Research agent → Clone for implementation
2. **Manager pattern**: Parent coordinates, children execute
3. **Exploration pattern**: Clone yourself to explore alternatives

## Best Practices
- Give clear, focused prompts
- Review plans before implementation
- Use agent_tree() to track your team`,
        triggerPhrases: ["delegate this task", "create a child agent", "spawn an agent"],
      },
      {
        id: "pattern-creation",
        title: "Creating New Skills",
        description:
          "Step-by-step guide for creating skills in the Birdhouse system. Covers directory structure, metadata, and testing.",
        prompt: `# Creating New Skills

Skills are reusable prompt templates stored in your workspace.

## Structure
\`\`\`
patterns/
  my-pattern/
    pattern.md     # The main prompt
    README.md      # Documentation
    metadata.json  # Trigger phrases, scope
\`\`\`

## Metadata Format
\`\`\`json
{
  "id": "my-pattern",
  "title": "My Pattern",
  "triggerPhrases": ["use my pattern"],
  "scope": "workspace"
}
\`\`\`

## Testing
Test your skill by using a trigger phrase in a conversation.`,
        triggerPhrases: ["create a pattern", "add a new pattern", "pattern template"],
      },
      {
        id: "inter-agent-comms",
        title: "Inter-Agent Communication",
        description: "Skills for agents communicating and collaborating across the tree hierarchy.",
        prompt: `# Inter-Agent Communication

You're part of a team. Use the agent tree to collaborate effectively.

## Discovery
Use \`agent_tree()\` to see:
- Planning agents (architectural decisions)
- Implementation agents (feature work)
- Investigation agents (research findings)

## Communication Patterns
- **Ask questions**: "Why did you choose this approach?"
- **Request changes**: "Can you adjust your implementation for this edge case?"
- **Report issues**: "Your tests are failing. Can you fix X?"
- **Share discoveries**: "I found a better solution. Should we switch?"

## When to Communicate
- Before duplicating work another agent might have done
- When you need context about past decisions
- When you find issues in another agent's work`,
        triggerPhrases: ["talk to another agent", "collaborate with agents", "agent communication"],
      },
      {
        id: "testing-workflow",
        title: "Testing Workflow Delegation",
        description: "Skill for delegating test writing to keep implementation context clean.",
        prompt: `# Testing Workflow Delegation

Keep implementation and testing concerns separate by delegating test writing.

## When to Delegate
- Writing comprehensive test suites
- Converting specs into test cases
- Adding coverage for edge cases

## What to Provide
1. **What you built**: Code/features to test
2. **Expected behavior**: How it should work
3. **Edge cases**: Known failure modes
4. **Integration points**: External dependencies

## Review Process
1. Child agent proposes test structure
2. Review for completeness
3. Approve and let them implement
4. Child runs tests and reports results`,
        triggerPhrases: ["write tests for this", "delegate testing", "test coverage"],
      },
    ],
  },
  {
    id: "git-github",
    name: "Git & GitHub",
    type: "marketplace",
    description:
      "Comprehensive skills for version control workflows. Includes commit message guidelines, pull request best practices, branch management strategies, and code review processes.",
    installed: false,
    patternCount: 3,
    patterns: [
      {
        id: "commit-messages",
        title: "Subject-First Commit Messages",
        description: "Writing scannable, searchable commit messages that prioritize the what over the why.",
        prompt: `# Subject-First Commit Messages

Write commit messages optimized for scanning and searching.

## Format
\`\`\`
Short subject line (50 chars max)

Optional body with details:
- Why this change was needed
- What alternatives were considered
- Links to issues/docs
\`\`\`

## Subject Line Rules
- Start with the changed subject (file, feature, component)
- Use present tense verbs
- No period at end
- Be specific: "UserAuth: fix session timeout" not "fix bug"

## Examples
**Good:**
- \`AgentCard: add gradient border on hover\`
- \`PatternsDialog: fix mobile responsive layout\`

**Bad:**
- \`Fixed a bug\` (what bug? where?)
- \`Implementing new feature\` (what feature?)`,
        triggerPhrases: ["write commit message", "commit this", "git commit"],
      },
      {
        id: "pr-creation",
        title: "Creating Pull Requests",
        description: "Guidelines for creating clear, reviewable PRs with proper context and structure.",
        prompt: `# Creating Pull Requests

Make your PRs easy to review and understand.

## Before Creating
1. Review all commits since branch divergence (\`git log main..HEAD\`)
2. Ensure tests pass
3. Check CI status
4. Review your own diff

## PR Structure
### Title
Clear, specific description of what changed

### Summary
- **Problem**: What issue does this solve?
- **Solution**: How does this PR address it?
- **Testing**: How was this verified?

### Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Screenshots for UI changes

## Size Guidelines
- Keep PRs focused on one concern
- Large changes? Split into multiple PRs
- Aim for < 400 lines changed`,
        triggerPhrases: ["create a pull request", "create pr", "open a pr"],
      },
      {
        id: "branch-management",
        title: "Branch Management",
        description: "Best practices for branch naming, lifecycle, and cleanup.",
        prompt: `# Branch Management

Keep your repository clean and organized.

## Naming Conventions
- \`feature/short-description\`
- \`fix/bug-description\`
- \`experiment/exploration-name\`

## Lifecycle
1. **Create**: Branch from latest main
2. **Work**: Commit frequently
3. **Sync**: Rebase on main regularly
4. **Merge**: Squash or merge based on team policy
5. **Clean**: Delete after merge

## WIP Branches
For exploratory work, use \`wip/description\` prefix. These are candidates for cleanup.

## Cleanup
Regularly audit branches:
\`\`\`bash
git branch --merged main
git branch --no-merged main
\`\`\``,
        triggerPhrases: ["create a branch", "branch strategy", "git branch"],
      },
    ],
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Experiment01: Component = () => {
  // Modal routing
  const { openModal, closeModal, currentModal, modalStack } = useModalRoute();
  const [_searchParams, setSearchParams] = useSearchParams<{ modals?: string }>();

  // Get workspace ID from route params
  const workspaceId = useWorkspaceId();

  // Fetch bundles from API
  const [bundlesData, { refetch: refetchBundles }] = createResource(workspaceId, async (wsId) => {
    const apiBundles = await fetchBundles(wsId);
    return adaptBundleMetadata(apiBundles);
  });

  // Computed bundles list (with fallback to mock data during development)
  const bundles = createMemo(() => bundlesData() || MOCK_BUNDLES_FALLBACK);

  // Organize bundles by ownership (user/workspace vs marketplace)
  const organizedBundles = createMemo(() => {
    const allBundles = bundles();
    return {
      owned: allBundles.filter((b) => b.type === "personal" || b.type === "workspace"),
      marketplace: allBundles.filter((b) => b.type === "marketplace"),
    };
  });

  // Parse modal stack to get selected bundle and pattern
  const selectedBundleId = createMemo(() => {
    const modal = currentModal();
    if (modal?.type === "pattern-library") {
      // ID format: "demo" for library home, or "demo:bundle-id" for bundle view
      const parts = modal.id.split(":");
      return parts.length > 1 ? parts[1] : null;
    }
    return null;
  });

  // Fetch full bundle details when a bundle is selected
  const [selectedBundleData] = createResource(
    () => {
      const bundleId = selectedBundleId();
      const wsId = workspaceId();
      return bundleId && wsId ? { bundleId, wsId } : null;
    },
    async ({ bundleId, wsId }) => {
      const apiBundle = await fetchBundle(bundleId, wsId);
      return adaptBundleWithPatterns(apiBundle);
    },
  );

  const selectedPatternId = createMemo(() => {
    const stack = modalStack();
    // Look for a "pattern" modal in the stack
    const patternModal = stack.find((m) => m.type === "pattern");
    return patternModal?.id || null;
  });

  // UI state
  const [filterMode, setFilterMode] = createSignal<"all" | "installed" | "not-installed">("all");
  const [searchQuery, setSearchQuery] = createSignal("");

  // Trigger phrase editing state (for installed patterns only)
  const [editingPhrase, setEditingPhrase] = createSignal<string | null>(null);
  const [editPhraseInput, setEditPhraseInput] = createSignal("");
  const [isAddingPhrase, setIsAddingPhrase] = createSignal(false);
  const [newPhraseInput, setNewPhraseInput] = createSignal("");
  const [confirmingDelete, setConfirmingDelete] = createSignal<string | null>(null);
  let deleteTimeoutId: number | undefined;
  let editInputRef: HTMLInputElement | undefined;
  let addInputRef: HTMLInputElement | undefined;

  // Computed values
  const filteredBundles = createMemo(() => {
    const mode = filterMode();
    const query = searchQuery().toLowerCase();
    const { owned, marketplace } = organizedBundles();

    const filterBundle = (bundle: PatternBundle) => {
      // Apply install filter at bundle level
      if (mode === "installed" && !bundle.installed) return false;
      if (mode === "not-installed" && bundle.installed) return false;

      // Apply search filter to bundle name and description
      if (query) {
        const matchesName = bundle.name.toLowerCase().includes(query);
        const matchesDesc = bundle.description.toLowerCase().includes(query);
        // For now, just search bundle-level fields
        // Pattern-level search would require fetching all bundles' patterns
        return matchesName || matchesDesc;
      }

      return true;
    };

    return {
      owned: owned.filter(filterBundle),
      marketplace: marketplace.filter(filterBundle),
    };
  });

  const selectedBundle = createMemo(() => {
    const id = selectedBundleId();
    if (!id) return null;

    // If we have fetched bundle data with patterns, use that
    const fetchedBundle = selectedBundleData();
    if (fetchedBundle) {
      return fetchedBundle;
    }

    // Otherwise, fall back to bundle metadata from list (no patterns)
    return bundles().find((b) => b.id === id) || null;
  });

  const selectedPattern = createMemo(() => {
    const patternId = selectedPatternId();
    if (!patternId) return null;

    // First check the currently selected bundle (which has full pattern details)
    const currentBundle = selectedBundle();
    if (currentBundle) {
      const pattern = currentBundle.patterns.find((p) => p.id === patternId);
      if (pattern) return { pattern, bundle: currentBundle };
    }

    // Fallback to searching all bundles (though patterns won't be loaded)
    for (const bundle of bundles()) {
      const pattern = bundle.patterns.find((p) => p.id === patternId);
      if (pattern) return { pattern, bundle };
    }
    return null;
  });

  // Actions
  const selectBundle = (bundleId: string) => {
    // Update the pattern-library modal to show this bundle
    // Remove pattern modals when changing bundles for clean state
    const stack = modalStack();
    const updatedStack = stack
      .filter((m) => m.type === "pattern-library")
      .map(() => ({
        type: "pattern-library" as const,
        id: `demo:${bundleId}`,
      }));

    setSearchParams({ modals: serializeModalStack(updatedStack) });
  };

  const selectPattern = (patternId: string) => {
    // Push a new "pattern" modal onto the stack
    openModal("pattern", patternId);
  };

  const toggleBundleInstall = (_bundleId: string) => {
    // TODO: Implement bundle install API call
    // For now, just log - no state mutation
  };

  // Trigger phrase editing functions (stubbed - not yet implemented with API)
  const startEditPhrase = (phrase: string) => {
    setEditingPhrase(phrase);
    setEditPhraseInput(phrase);
  };

  const saveEditPhrase = (_patternId: string, _oldPhrase: string) => {
    const newPhrase = editPhraseInput().trim();
    if (!newPhrase) return;
    // TODO: Implement API call to update trigger phrases

    setEditingPhrase(null);
    setEditPhraseInput("");
  };

  const cancelEditPhrase = () => {
    setEditingPhrase(null);
    setEditPhraseInput("");
  };

  const startDeleteConfirmation = (phrase: string) => {
    if (deleteTimeoutId !== undefined) {
      clearTimeout(deleteTimeoutId);
    }
    setConfirmingDelete(phrase);
    deleteTimeoutId = setTimeout(() => {
      setConfirmingDelete(null);
    }, 2000) as unknown as number;
  };

  const removeTriggerPhrase = (_patternId: string, _phrase: string) => {
    if (deleteTimeoutId !== undefined) {
      clearTimeout(deleteTimeoutId);
    }
    // TODO: Implement API call to remove trigger phrase

    setConfirmingDelete(null);
  };

  const addTriggerPhrase = (_patternId: string) => {
    const phrase = newPhraseInput().trim();
    if (!phrase) return;
    // TODO: Implement API call to add trigger phrase

    setNewPhraseInput("");
    setIsAddingPhrase(false);
  };

  const cancelAddPhrase = () => {
    setNewPhraseInput("");
    setIsAddingPhrase(false);
  };

  // Auto-focus inputs
  createEffect(() => {
    if (editingPhrase()) {
      queueMicrotask(() => editInputRef?.focus());
    }
  });

  createEffect(() => {
    if (isAddingPhrase()) {
      queueMicrotask(() => addInputRef?.focus());
    }
  });

  const handleDialogChange = (open: boolean) => {
    if (!open) {
      closeModal();
      // Reset state when closing
      setSearchQuery("");
    }
  };

  // Check if pattern library modal is open (check the modal stack, not just current)
  const isPatternLibraryOpen = createMemo(() => {
    return modalStack().some((m) => m.type === "pattern-library");
  });

  return (
    <div class="space-y-4">
      {/* Demo Controls */}
      <div class="flex gap-4 items-center">
        <Button variant="primary" onClick={() => openModal("pattern-library", "demo")}>
          <span class="flex items-center gap-2 whitespace-nowrap">
            <LibraryBig size={16} />
            Skills Library
          </span>
        </Button>
      </div>

      {/* Full-screen Dialog */}
      <Dialog
        open={isPatternLibraryOpen()}
        onOpenChange={handleDialogChange}
        closeOnOutsidePointer={false}
        closeOnOutsideFocus={false}
        preventScroll={false}
        restoreScrollPosition={false}
      >
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" />
          <Dialog.Content
            class={`fixed rounded-2xl ${cardSurfaceFlat} shadow-2xl
                   w-[95vw] h-[95dvh] max-w-[1600px]
                   left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                   flex flex-col overflow-hidden z-[100]`}
          >
            {/* Header */}
            <div class="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
              <Dialog.Label class="text-lg font-semibold text-heading flex items-center gap-2">
                <LibraryBig size={18} />
                Skills Library
              </Dialog.Label>

              <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
                <X size={20} />
              </Dialog.Close>
            </div>

            {/* Split Panel Content */}
            <div class="flex-1 overflow-hidden flex gap-2 p-2">
              {/* LEFT PANEL - Bundle List */}
              <div class="w-[380px] flex-shrink-0 bg-surface-raised rounded-lg overflow-hidden flex flex-col">
                {/* Filter & Search */}
                <div class="p-4 border-b border-border space-y-3">
                  {/* Filter Pills */}
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterMode("all")}
                      class="px-3 py-1 text-xs rounded-full transition-colors"
                      classList={{
                        "bg-accent text-text-on-accent": filterMode() === "all",
                        "bg-surface-overlay text-text-secondary hover:text-text-primary": filterMode() !== "all",
                      }}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode("installed")}
                      class="px-3 py-1 text-xs rounded-full transition-colors"
                      classList={{
                        "bg-accent text-text-on-accent": filterMode() === "installed",
                        "bg-surface-overlay text-text-secondary hover:text-text-primary": filterMode() !== "installed",
                      }}
                    >
                      Installed
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode("not-installed")}
                      class="px-3 py-1 text-xs rounded-full transition-colors"
                      classList={{
                        "bg-accent text-text-on-accent": filterMode() === "not-installed",
                        "bg-surface-overlay text-text-secondary hover:text-text-primary":
                          filterMode() !== "not-installed",
                      }}
                    >
                      Not Installed
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div class="relative">
                    <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Search skills..."
                      value={searchQuery()}
                      onInput={(e) => setSearchQuery(e.currentTarget.value)}
                      class="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent text-text-primary placeholder-text-muted"
                    />
                  </div>
                </div>

                {/* Bundle List */}
                <div class="flex-1 overflow-y-auto">
                  {/* Loading State */}
                  <Show when={bundlesData.loading}>
                    <div class="flex items-center justify-center p-8">
                      <div class="text-sm text-text-muted">Loading bundles...</div>
                    </div>
                  </Show>

                  {/* Error State */}
                  <Show when={bundlesData.error}>
                    <div class="p-4 space-y-3">
                      <div class="text-sm text-danger">Failed to load bundles</div>
                      <div class="text-xs text-text-muted">{bundlesData.error?.message}</div>
                      <button
                        type="button"
                        onClick={() => refetchBundles()}
                        class="px-3 py-1.5 text-xs bg-accent text-text-on-accent rounded hover:opacity-90"
                      >
                        Retry
                      </button>
                    </div>
                  </Show>

                  {/* Bundle List - Success State */}
                  <Show when={!bundlesData.loading && !bundlesData.error}>
                    {/* Personal/Workspace Bundles - No Section Header */}
                    <Show when={filteredBundles().owned.length > 0}>
                      <For each={filteredBundles().owned}>
                        {(bundle) => (
                          <button
                            type="button"
                            onClick={() => selectBundle(bundle.id)}
                            class="w-full text-left p-4 border-b border-border-muted hover:bg-surface-overlay transition-colors"
                            classList={{
                              "bg-surface-overlay": selectedBundleId() === bundle.id,
                            }}
                          >
                            <div class="flex items-start justify-between gap-3 mb-2">
                              <h3 class="text-sm font-semibold text-heading">{bundle.name}</h3>
                              <div class="flex items-center gap-2 flex-shrink-0">
                                <span class="text-xs text-text-muted">
                                  {bundle.patternCount} {bundle.patternCount === 1 ? "skill" : "skills"}
                                </span>
                                <Show when={bundle.installed}>
                                  <span class="text-xs text-green-500">✓</span>
                                </Show>
                              </div>
                            </div>
                            <p class="text-xs text-text-secondary line-clamp-2">{bundle.description}</p>
                          </button>
                        )}
                      </For>
                    </Show>

                    {/* Marketplace Section */}
                    <Show when={filteredBundles().marketplace.length > 0}>
                      <div
                        class="px-4 py-2 border-b border-border-muted"
                        classList={{
                          "mt-2": filteredBundles().owned.length > 0,
                        }}
                      >
                        <h4 class="text-xs font-semibold text-text-secondary uppercase tracking-wide">Marketplace</h4>
                      </div>
                      <For each={filteredBundles().marketplace}>
                        {(bundle) => (
                          <button
                            type="button"
                            onClick={() => selectBundle(bundle.id)}
                            class="w-full text-left p-4 border-b border-border-muted last:border-b-0 hover:bg-surface-overlay transition-colors"
                            classList={{
                              "bg-surface-overlay": selectedBundleId() === bundle.id,
                            }}
                          >
                            <div class="flex items-start justify-between gap-3 mb-2">
                              <h3 class="text-sm font-semibold text-heading">{bundle.name}</h3>
                              <div class="flex items-center gap-2 flex-shrink-0">
                                <span class="text-xs text-text-muted">
                                  {bundle.patternCount} {bundle.patternCount === 1 ? "skill" : "skills"}
                                </span>
                                <Show when={bundle.installed}>
                                  <span class="text-xs text-green-500">✓</span>
                                </Show>
                              </div>
                            </div>
                            <p class="text-xs text-text-secondary line-clamp-2">{bundle.description}</p>
                          </button>
                        )}
                      </For>
                    </Show>

                    {/* Empty State */}
                    <Show when={filteredBundles().owned.length === 0 && filteredBundles().marketplace.length === 0}>
                      <div class="flex items-center justify-center p-8">
                        <div class="text-sm text-text-muted">No bundles found</div>
                      </div>
                    </Show>
                  </Show>
                </div>
              </div>

              {/* RIGHT PANEL - Bundle or Pattern Details */}
              <div class="flex-1 bg-surface rounded-lg overflow-hidden">
                <Show
                  when={selectedBundle()}
                  fallback={
                    <div class="flex items-center justify-center h-full text-center px-4">
                      <div class="space-y-2">
                        <p class="text-lg text-text-primary">← Choose a bundle from the library</p>
                        <p class="text-sm text-text-muted">Select a bundle to view its skills</p>
                      </div>
                    </div>
                  }
                >
                  {(bundle) => (
                    <div class="flex flex-col h-full">
                      {/* Bundle Header */}
                      <div class="px-6 py-4 border-b border-border flex-shrink-0">
                        <div class="flex items-start justify-between gap-4">
                          <div class="flex-1">
                            <h2 class="text-xl font-semibold text-heading mb-1">{bundle().name}</h2>
                            <p class="text-sm text-text-secondary">
                              {bundle().patternCount} {bundle().patternCount === 1 ? "skill" : "skills"}
                            </p>
                          </div>

                          {/* Install/Uninstall Button (Marketplace only) */}
                          <Show when={bundle().type === "marketplace"}>
                            <button
                              type="button"
                              onClick={() => toggleBundleInstall(bundle().id)}
                              class="px-4 py-2 text-sm rounded transition-colors"
                              classList={{
                                "bg-green-500/10 text-green-500 border border-green-500/20": bundle().installed,
                                "bg-accent text-text-on-accent hover:opacity-90": !bundle().installed,
                              }}
                            >
                              {bundle().installed ? "Uninstall" : "Install"}
                            </button>
                          </Show>
                        </div>
                      </div>

                      {/* Scrollable Content */}
                      <div class="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Bundle Description */}
                        <section>
                          <h3 class="text-sm font-semibold text-heading mb-3">About This Bundle</h3>
                          <div class={`rounded-lg ${cardSurfaceFlat} p-4`}>
                            <p class="text-sm text-text-primary">{bundle().description}</p>
                          </div>
                        </section>

                        {/* Patterns List */}
                        <section>
                          <h3 class="text-sm font-semibold text-heading mb-3">Skills</h3>
                          <div class="space-y-2">
                            <For each={bundle().patterns}>
                              {(pattern) => (
                                <div class={`p-4 rounded-lg ${cardSurfaceFlat}`}>
                                  <div class="flex items-start justify-between gap-3 mb-2">
                                    <div class="flex-1 min-w-0">
                                      <h4 class="text-sm font-semibold text-heading mb-1">{pattern.title}</h4>
                                      <p class="text-xs text-text-secondary line-clamp-2">{pattern.description}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => selectPattern(pattern.id)}
                                      class="px-3 py-1.5 text-xs bg-accent text-text-on-accent rounded hover:opacity-90 transition-opacity flex-shrink-0"
                                    >
                                      View
                                    </button>
                                  </div>
                                  <div class="flex flex-wrap gap-1">
                                    <For each={pattern.triggerPhrases.slice(0, 2)}>
                                      {(phrase) => (
                                        <span class="px-2 py-0.5 text-xs bg-surface-overlay text-text-muted rounded font-mono">
                                          {phrase}
                                        </span>
                                      )}
                                    </For>
                                    <Show when={pattern.triggerPhrases.length > 2}>
                                      <span class="px-2 py-0.5 text-xs text-text-muted">
                                        +{pattern.triggerPhrases.length - 2} more
                                      </span>
                                    </Show>
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </section>
                      </div>
                    </div>
                  )}
                </Show>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      {/* Nested Pattern Details Modal */}
      <Show when={selectedPattern()}>
        {(data) => (
          <Dialog
            open={selectedPatternId() !== null}
            onOpenChange={(open) => {
              if (!open) closeModal(); // Close the pattern modal
            }}
            closeOnOutsidePointer={false}
            closeOnOutsideFocus={false}
            preventScroll={false}
            restoreScrollPosition={false}
          >
            <Dialog.Portal mount={document.body}>
              <Dialog.Overlay class="fixed inset-0 bg-black/20" style={{ "z-index": "110" }} />
              <Dialog.Content
                class="fixed rounded-2xl shadow-2xl w-[90vw] h-[90dvh] max-w-[1200px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden bg-surface"
                style={{ "z-index": "112" }}
              >
                {/* Header - matches playground demo style */}
                <div class="px-6 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
                  <Dialog.Label class="text-lg font-semibold text-heading">{data().pattern.title}</Dialog.Label>
                  <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors">
                    <X size={20} />
                  </Dialog.Close>
                </div>

                {/* Scrollable Content - dark background like playground */}
                <div class="flex-1 overflow-y-auto p-8 space-y-8">
                  {/* Description */}
                  <section class="space-y-4">
                    <h3 class="text-lg font-semibold text-heading">Description</h3>
                    <div class={`rounded-xl ${cardSurfaceFlat} px-6 py-4`}>
                      <MarkdownRenderer content={data().pattern.description} />
                    </div>
                  </section>

                  {/* Trigger Phrases - moved above LLM content */}
                  <section class="space-y-4">
                    <h3 class="text-lg font-semibold text-heading">Trigger Phrases</h3>

                    <Show when={!data().bundle.installed}>
                      <p class="text-sm text-text-muted mb-2">Install this bundle to customize trigger phrases.</p>
                    </Show>

                    <div class={`rounded-xl ${cardSurfaceFlat} p-6 space-y-1`}>
                      <For each={data().pattern.triggerPhrases}>
                        {(phrase) => (
                          <Show
                            when={data().bundle.installed && editingPhrase() === phrase}
                            fallback={
                              <div class="flex items-center gap-2 group">
                                <span class="text-text-muted flex-shrink-0">•</span>
                                <span class="text-sm font-mono text-text-primary flex-1">{phrase}</span>
                                <Show when={data().bundle.installed}>
                                  <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => startEditPhrase(phrase)}
                                      class="p-1 hover:bg-accent/10 rounded transition-all flex-shrink-0"
                                      title="Edit trigger phrase"
                                    >
                                      <svg
                                        class="w-3 h-3 text-text-muted hover:text-accent"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                      >
                                        <path
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                          stroke-width="2"
                                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                        />
                                      </svg>
                                    </button>
                                    <Show
                                      when={confirmingDelete() === phrase}
                                      fallback={
                                        <button
                                          type="button"
                                          onClick={() => startDeleteConfirmation(phrase)}
                                          class="p-1 hover:bg-danger/10 rounded transition-all flex-shrink-0"
                                          title="Remove trigger phrase"
                                        >
                                          <svg
                                            class="w-3 h-3 text-text-muted hover:text-danger"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                          >
                                            <path
                                              stroke-linecap="round"
                                              stroke-linejoin="round"
                                              stroke-width="2"
                                              d="M6 18L18 6M6 6l12 12"
                                            />
                                          </svg>
                                        </button>
                                      }
                                    >
                                      <button
                                        type="button"
                                        onClick={() => removeTriggerPhrase(data().pattern.id, phrase)}
                                        class="px-2 py-1 bg-danger/10 hover:bg-danger/20 rounded transition-all flex-shrink-0 text-xs font-medium text-danger"
                                        title="Click again to confirm deletion"
                                      >
                                        Confirm
                                      </button>
                                    </Show>
                                  </div>
                                </Show>
                              </div>
                            }
                          >
                            <div class="flex items-center gap-2">
                              <span class="text-text-muted flex-shrink-0">•</span>
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editPhraseInput()}
                                onInput={(e) => setEditPhraseInput(e.currentTarget.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    saveEditPhrase(data().pattern.id, phrase);
                                  } else if (e.key === "Escape") {
                                    cancelEditPhrase();
                                  }
                                }}
                                class="flex-1 px-2 py-1 text-sm font-mono text-text-primary bg-surface-raised border border-border-muted rounded focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                              />
                              <button
                                type="button"
                                onClick={() => saveEditPhrase(data().pattern.id, phrase)}
                                class="px-2 py-1 text-xs bg-accent text-text-on-accent rounded hover:opacity-90 transition-opacity"
                                disabled={!editPhraseInput().trim()}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditPhrase}
                                class="px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </Show>
                        )}
                      </For>

                      {/* Add new phrase input or button */}
                      <Show when={data().bundle.installed}>
                        <Show
                          when={isAddingPhrase()}
                          fallback={
                            <button
                              type="button"
                              onClick={() => setIsAddingPhrase(true)}
                              class="flex items-center gap-2 text-sm text-text-muted hover:text-accent transition-colors group mt-2"
                            >
                              <svg
                                class="w-3 h-3 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                              <span>Add trigger phrase</span>
                            </button>
                          }
                        >
                          <div class="flex items-center gap-2">
                            <input
                              ref={addInputRef}
                              type="text"
                              value={newPhraseInput()}
                              onInput={(e) => setNewPhraseInput(e.currentTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  addTriggerPhrase(data().pattern.id);
                                } else if (e.key === "Escape") {
                                  cancelAddPhrase();
                                }
                              }}
                              placeholder="Enter trigger phrase..."
                              class="flex-1 px-3 py-2 text-sm font-mono text-text-primary bg-surface-raised border border-border-muted rounded focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                            />
                            <button
                              type="button"
                              onClick={() => addTriggerPhrase(data().pattern.id)}
                              class="px-3 py-2 text-sm bg-accent text-text-on-accent rounded hover:opacity-90 transition-opacity"
                              disabled={!newPhraseInput().trim()}
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={cancelAddPhrase}
                              class="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </Show>
                      </Show>
                    </div>
                  </section>

                  {/* What Gets Sent to LLM */}
                  <section class="space-y-4">
                    <h3 class="text-lg font-semibold text-heading">What Gets Sent to the LLM</h3>
                    <div class={`rounded-xl ${cardSurfaceFlat} overflow-hidden`}>
                      <div class="px-4 py-2 bg-surface-overlay border-b border-border-muted font-mono text-xs text-text-muted">
                        &lt;birdhouse-pattern id="{data().pattern.id}"&gt;
                      </div>
                      <div class="p-4">
                        <MarkdownRenderer content={data().pattern.prompt} />
                      </div>
                      <div class="px-4 py-2 bg-surface-overlay border-t border-border-muted font-mono text-xs text-text-muted">
                        &lt;/birdhouse-pattern&gt;
                      </div>
                    </div>
                  </section>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog>
        )}
      </Show>
    </div>
  );
};

export default Experiment01;
