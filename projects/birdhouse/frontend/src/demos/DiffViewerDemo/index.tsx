// ABOUTME: Diff viewer demo with visual diffs using @pierre/diffs library
// ABOUTME: Shows before/after code comparisons with syntax highlighting

import { Columns2, RectangleVertical } from "lucide-solid";
import { type Component, createSignal } from "solid-js";
import { ButtonGroup, Combobox, type ComboboxOption } from "../../components/ui";
import EditDiffViewer from "../../components/ui/EditDiffViewer";
import { activeBaseTheme, BASE_THEMES, codeTheme, setBaseTheme, setCodeThemePreference } from "../../theme";
import { CODE_THEME_DISPLAY_NAMES, CODE_THEME_IDS } from "../../theme/codeThemes";
import { type DiffSample, samples } from "./samples";

const getDefaultSample = (): DiffSample => {
  const first = samples[0];
  if (!first) {
    throw new Error("No diff samples found");
  }
  return first;
};

const DiffViewerDemo: Component = () => {
  const [selectedSample, setSelectedSample] = createSignal<DiffSample>(
    samples.find((s) => s.id === "typescript-refactor") ?? getDefaultSample(),
  );

  const [viewMode, setViewMode] = createSignal<"unified" | "split">("unified");

  // Convert samples to combobox options
  const sampleOptions: ComboboxOption<DiffSample>[] = samples.map((sample) => ({
    value: sample,
    label: sample.name,
    description: sample.description,
  }));

  // Convert code themes to combobox options
  const codeThemeOptions: ComboboxOption<string>[] = CODE_THEME_IDS.map((themeId) => {
    const displayName = CODE_THEME_DISPLAY_NAMES[themeId] ?? themeId;
    const isDarkOnly = displayName.includes("●");
    const isLightOnly = displayName.includes("○");
    const label = displayName.replace(" ●", "").replace(" ○", "");
    let description: string | undefined;
    if (isDarkOnly) description = "Dark Only";
    if (isLightOnly) description = "Light Only";
    return { value: themeId, label, description };
  });

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Diff Viewer</h2>
        <p class="text-sm text-text-secondary hidden md:block">Visual diffs with syntax highlighting</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {/* All controls in one compact row */}
        <div class="flex gap-3 items-end">
          <div class="flex-1 min-w-0">
            <span class="text-xs font-medium block text-text-secondary mb-1.5">Sample</span>
            <Combobox
              options={sampleOptions}
              value={selectedSample()}
              onSelect={setSelectedSample}
              onPreview={setSelectedSample}
              placeholder="Search samples..."
              noResultsMessage="No matching samples found"
            />
          </div>

          <div class="w-48 min-w-0">
            <span class="text-xs font-medium block text-text-secondary mb-1.5">UI Theme</span>
            <Combobox
              options={BASE_THEMES.map((theme) => ({
                value: theme,
                label: theme
                  .split("-")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" "),
              }))}
              value={activeBaseTheme()}
              onSelect={setBaseTheme}
              onPreview={setBaseTheme}
              placeholder="Select theme..."
              noResultsMessage="No matching themes found"
            />
          </div>

          <div class="w-48 min-w-0">
            <span class="text-xs font-medium block text-text-secondary mb-1.5">Code Theme</span>
            <Combobox
              options={codeThemeOptions}
              value={codeTheme()}
              onSelect={setCodeThemePreference}
              onPreview={setCodeThemePreference}
              placeholder="Search themes..."
              noResultsMessage="No matching themes found"
            />
          </div>

          <div class="shrink-0">
            <span class="text-xs font-medium block text-text-secondary mb-1.5">View</span>
            <ButtonGroup
              items={[
                {
                  value: "unified",
                  icon: (
                    <div class="flex items-center gap-1.5">
                      <RectangleVertical size={16} />
                      <span>Unified</span>
                    </div>
                  ),
                  title: "Unified view (stacked)",
                },
                {
                  value: "split",
                  icon: (
                    <div class="flex items-center gap-1.5">
                      <Columns2 size={16} />
                      <span>Split</span>
                    </div>
                  ),
                  title: "Split view (side-by-side)",
                },
              ]}
              value={viewMode()}
              onChange={(value) => setViewMode(value as "unified" | "split")}
            />
          </div>
        </div>

        {/* Diff viewer */}
        <div class="rounded-lg overflow-hidden border border-border">
          <EditDiffViewer
            before={selectedSample().before}
            after={selectedSample().after}
            filePath={selectedSample().filePath}
            mode={viewMode()}
          />
        </div>
      </div>
    </div>
  );
};

export default DiffViewerDemo;
