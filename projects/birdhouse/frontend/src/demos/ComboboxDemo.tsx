// ABOUTME: Combobox demo showing various pickers and rendering options
// ABOUTME: Demonstrates horizontal/vertical layouts and theme integration

import type { Component } from "solid-js";
import { Combobox, type ComboboxOption, renderVertical } from "../components/ui";
import {
  activeBaseTheme,
  BASE_THEMES,
  type BaseThemeName,
  CODE_THEME_DISPLAY_NAMES,
  CODE_THEME_IDS,
  type ColorMode,
  codeTheme,
  colorMode,
  setBaseTheme,
  setCodeThemePreference,
  setColorModePreference,
  setUiSizePreference,
  type UiSize,
  uiSize,
} from "../theme";

// UI Theme options - define OUTSIDE component to avoid recreating on every render
const uiThemeOptions: ComboboxOption<BaseThemeName>[] = BASE_THEMES.map((theme) => ({
  value: theme,
  label: theme
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" "),
  description: "App color scheme",
}));

const ComboboxDemo: Component = () => {
  // Code Theme options (vertical layout for variety)
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

  // Color Mode options (horizontal)
  const colorModeOptions: ComboboxOption<ColorMode>[] = [
    { value: "light", label: "Light", description: "Always light mode" },
    { value: "dark", label: "Dark", description: "Always dark mode" },
    { value: "system", label: "System", description: "Match OS preference" },
  ];

  // UI Size options (horizontal)
  const uiSizeOptions: ComboboxOption<UiSize>[] = [
    { value: "sm", label: "Small", description: "Compact interface" },
    { value: "md", label: "Medium", description: "Default size" },
    { value: "lg", label: "Large", description: "Spacious interface" },
  ];

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Combobox</h2>
        <p class="text-sm text-text-secondary hidden md:block">Searchable dropdowns with typeahead and live preview</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Settings Grid */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* UI Theme - Horizontal Layout (Default) */}
          <div class="space-y-2">
            <span class="text-sm font-medium block text-text-secondary">
              UI Theme
              <span class="text-text-muted ml-2 text-xs">(horizontal layout)</span>
            </span>
            <Combobox
              options={uiThemeOptions}
              value={activeBaseTheme()}
              onSelect={setBaseTheme}
              onPreview={setBaseTheme}
              placeholder="Select theme..."
            />
            <p class="text-xs text-text-muted">
              Uses default <code class="text-accent">renderHorizontal</code> renderer
            </p>
          </div>

          {/* Color Mode - Horizontal Layout */}
          <div class="space-y-2">
            <span class="text-sm font-medium block text-text-secondary">
              Color Mode
              <span class="text-text-muted ml-2 text-xs">(horizontal layout)</span>
            </span>
            <Combobox
              options={colorModeOptions}
              value={colorMode()}
              onSelect={setColorModePreference}
              onPreview={setColorModePreference}
              placeholder="Select mode..."
            />
            <p class="text-xs text-text-muted">
              Uses default <code class="text-accent">renderHorizontal</code> renderer
            </p>
          </div>

          {/* Code Theme - Vertical Layout */}
          <div class="space-y-2">
            <span class="text-sm font-medium block text-text-secondary">
              Code Theme
              <span class="text-text-muted ml-2 text-xs">(vertical layout)</span>
            </span>
            <Combobox
              options={codeThemeOptions}
              value={codeTheme()}
              onSelect={setCodeThemePreference}
              renderOption={renderVertical}
              placeholder="Search themes..."
            />
            <p class="text-xs text-text-muted">
              Uses <code class="text-accent">renderVertical</code> for two-line layout
            </p>
          </div>

          {/* UI Size - Horizontal Layout */}
          <div class="space-y-2">
            <span class="text-sm font-medium block text-text-secondary">
              UI Size
              <span class="text-text-muted ml-2 text-xs">(horizontal layout)</span>
            </span>
            <Combobox
              options={uiSizeOptions}
              value={uiSize()}
              onSelect={setUiSizePreference}
              placeholder="Select size..."
            />
            <p class="text-xs text-text-muted">
              Uses default <code class="text-accent">renderHorizontal</code> renderer
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Features</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="rounded-lg border bg-surface-overlay border-border p-4 space-y-2">
              <h4 class="font-medium text-accent">Type-to-Filter</h4>
              <p class="text-sm text-text-secondary">
                Start typing to instantly filter options by label and description
              </p>
            </div>
            <div class="rounded-lg border bg-surface-overlay border-border p-4 space-y-2">
              <h4 class="font-medium text-accent">Keyboard Navigation</h4>
              <p class="text-sm text-text-secondary">Arrow keys to navigate, Enter to select, Escape to cancel</p>
            </div>
            <div class="rounded-lg border bg-surface-overlay border-border p-4 space-y-2">
              <h4 class="font-medium text-accent">Live Preview</h4>
              <p class="text-sm text-text-secondary">See changes as you arrow through options before committing</p>
            </div>
            <div class="rounded-lg border bg-surface-overlay border-border p-4 space-y-2">
              <h4 class="font-medium text-accent">Custom Rendering</h4>
              <p class="text-sm text-text-secondary">Choose from presets (horizontal/vertical) or write your own</p>
            </div>
            <div class="rounded-lg border bg-surface-overlay border-border p-4 space-y-2">
              <h4 class="font-medium text-accent">Theme Integration</h4>
              <p class="text-sm text-text-secondary">Fully styled with CSS variables - works with all themes</p>
            </div>
            <div class="rounded-lg border bg-surface-overlay border-border p-4 space-y-2">
              <h4 class="font-medium text-accent">Accessible</h4>
              <p class="text-sm text-text-secondary">ARIA compliant with proper roles and keyboard support</p>
            </div>
          </div>
        </div>

        {/* Usage Examples */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Usage Examples</h3>
          <div class="rounded-xl border bg-surface-overlay border-border p-6 space-y-4">
            <div>
              <h4 class="font-medium text-heading mb-2">Simple (Default Horizontal)</h4>
              <pre class="text-xs text-text-secondary overflow-x-auto">
                {`<Combobox 
  options={options}
  value={selected}
  onSelect={setSelected}
/>`}
              </pre>
            </div>
            <div>
              <h4 class="font-medium text-heading mb-2">Vertical Layout</h4>
              <pre class="text-xs text-text-secondary overflow-x-auto">
                {`<Combobox 
  options={options}
  value={selected}
  onSelect={setSelected}
  renderOption={renderVertical}
/>`}
              </pre>
            </div>
            <div>
              <h4 class="font-medium text-heading mb-2">Custom Renderer</h4>
              <pre class="text-xs text-text-secondary overflow-x-auto">
                {`<Combobox 
  options={users}
  renderOption={(opt, highlighted) => (
    <div class="flex gap-2">
      <Avatar user={opt.value} />
      <span>{opt.label}</span>
    </div>
  )}
/>`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComboboxDemo;
