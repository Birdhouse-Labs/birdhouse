// ABOUTME: Code block demo with syntax highlighting
// ABOUTME: Shows premium VS Code-quality highlighting across multiple languages

import { type Component, createSignal } from "solid-js";
import { CodeBlockContainer, Combobox, type ComboboxOption } from "../../components/ui";
import { codeTheme, isDark, setCodeThemePreference, uiSize } from "../../theme";

import { CODE_THEME_DISPLAY_NAMES, CODE_THEME_IDS, resolveCodeTheme } from "../../theme/codeThemes";
import { type CodeSample, fileExtensions, samples } from "./samples";

const _getFileExtension = (lang: string): string => fileExtensions[lang] ?? lang;

// samples[0] is guaranteed to exist (we have 30+ sample files)
const getDefaultSample = (): CodeSample => {
  const first = samples[0];
  if (!first) {
    throw new Error("No code samples found");
  }
  return first;
};

const CodeBlockDemo: Component = () => {
  const [selectedSample, setSelectedSample] = createSignal<CodeSample>(
    samples.find((s) => s.id === "typescript") ?? getDefaultSample(),
  );

  // Convert samples to combobox options
  const languageOptions: ComboboxOption<CodeSample>[] = samples.map((sample) => ({
    value: sample,
    label: sample.name,
    description: sample.description,
  }));

  // Convert code themes to combobox options
  const codeThemeOptions: ComboboxOption<string>[] = CODE_THEME_IDS.map((themeId) => {
    const displayName = CODE_THEME_DISPLAY_NAMES[themeId] ?? themeId;
    const isDarkOnly = displayName.includes("●");
    const isLightOnly = displayName.includes("○");

    // Clean label without symbols
    const label = displayName.replace(" ●", "").replace(" ○", "");

    // Mode indicator only for dark/light-only themes
    let description: string | undefined;
    if (isDarkOnly) description = "Dark Only";
    if (isLightOnly) description = "Light Only";

    return {
      value: themeId,
      label,
      description,
    };
  });

  const sizeClasses = () => {
    const size = uiSize();
    return {
      text: size === "sm" ? "text-sm" : size === "md" ? "text-base" : "text-lg",
      small: size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
    };
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Code Blocks</h2>
        <p class="text-sm text-text-secondary hidden md:block">Premium syntax highlighting with live preview</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Language and Theme selectors */}
        <div class="flex gap-4">
          <div class="flex-1 space-y-2">
            <span
              class="text-sm font-medium block text-text-secondary"
              classList={{
                [sizeClasses().small]: true,
              }}
            >
              Language
            </span>
            <Combobox
              options={languageOptions}
              value={selectedSample()}
              onSelect={setSelectedSample}
              onPreview={setSelectedSample}
              placeholder="Search languages..."
              noResultsMessage="No matching languages found"
            />
          </div>

          <div class="flex-1 space-y-2">
            <span
              class="text-sm font-medium block text-text-secondary"
              classList={{
                [sizeClasses().small]: true,
              }}
            >
              Code Theme
            </span>
            <Combobox
              options={codeThemeOptions}
              value={codeTheme()}
              onSelect={setCodeThemePreference}
              onPreview={setCodeThemePreference}
              placeholder="Search themes..."
              noResultsMessage="No matching themes found"
            />
          </div>
        </div>

        {/* Code block */}
        <CodeBlockContainer
          code={selectedSample().code}
          language={selectedSample().language}
          displayName={selectedSample().name}
          theme={resolveCodeTheme(codeTheme(), isDark())}
          title={selectedSample().description}
          showCopyButton={true}
        />
      </div>
    </div>
  );
};

export default CodeBlockDemo;
