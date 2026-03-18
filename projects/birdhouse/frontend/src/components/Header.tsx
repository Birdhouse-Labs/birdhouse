// ABOUTME: Fixed header component with settings popover
// ABOUTME: Contains app title and settings for color mode, UI size, and theme

import Popover from "corvu/popover";
import { Menu, Settings } from "lucide-solid";
import { type Component, type JSX, Show } from "solid-js";
import { useZIndex } from "../contexts/ZIndexContext";
import { AgentIcon, SkillIcon } from "../design-system";
import { keepAgentInView, setKeepAgentInViewPreference } from "../lib/preferences";
import { useModalRoute, useWorkspaceId } from "../lib/routing";
import {
  activeBaseTheme,
  BASE_THEMES,
  type BaseThemeName,
  CODE_THEME_DISPLAY_NAMES,
  CODE_THEME_IDS,
  type ColorMode,
  codeTheme,
  colorMode,
  isDark,
  setBaseTheme,
  setCodeThemePreference,
  setColorModePreference,
  setUiSizePreference,
  type UiSize,
  uiSize,
} from "../theme";
import { THEME_METADATA } from "../theme/themeMetadata";
import { Button, ButtonGroup, Checkbox, Combobox, type ComboboxOption } from "./ui";
import WorkspaceContextPopover from "./WorkspaceContextPopover";

interface HeaderProps {
  showMenuButton?: boolean;
  menuButtonActive?: boolean;
  onMenuClick?: () => void;
}

// Custom renderer for theme options - shows theme gradient as text color
const renderThemeOption = (option: ComboboxOption<BaseThemeName>, _isHighlighted: boolean): JSX.Element => {
  const metadata = THEME_METADATA[option.value];

  // Fallback if metadata not found
  if (!metadata) {
    return <span class="font-medium text-text-primary">{option.label}</span>;
  }

  const gradient = isDark() ? metadata.gradientDark : metadata.gradientLight;

  return (
    <span
      class="font-medium"
      style={{
        "background-image": `linear-gradient(to right, ${gradient.from}, ${gradient.to})`,
        "-webkit-background-clip": "text",
        "background-clip": "text",
        color: "transparent",
        display: "inline-block",
      }}
    >
      {option.label}
    </span>
  );
};

// Birdhouse icon component with gradient support
const BirdhouseIcon: Component<{ size?: number; gradientId: string }> = (props) => {
  const size = () => props.size || 24;
  return (
    <svg
      width={size()}
      height={size()}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="flex-shrink-0"
      role="img"
      aria-label="Birdhouse icon"
    >
      <title>Birdhouse icon</title>
      <defs>
        <linearGradient id={props.gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:var(--theme-gradient-from)" />
          <stop offset="50%" style="stop-color:var(--theme-gradient-via)" />
          <stop offset="100%" style="stop-color:var(--theme-gradient-to)" />
        </linearGradient>
      </defs>
      <path
        d="M12 18v4"
        fill="none"
        stroke={`url(#${props.gradientId})`}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="m17 18 1.956-11.468"
        stroke={`url(#${props.gradientId})`}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="m3 8 7.82-5.615a2 2 0 0 1 2.36 0L21 8"
        stroke={`url(#${props.gradientId})`}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M4 18h16"
        stroke={`url(#${props.gradientId})`}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M7 18 5.044 6.532"
        stroke={`url(#${props.gradientId})`}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        cx="12"
        cy="10"
        r="2"
        stroke={`url(#${props.gradientId})`}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

const Header: Component<HeaderProps> = (props) => {
  const workspaceId = useWorkspaceId();
  const baseZIndex = useZIndex();
  const { openModal } = useModalRoute();

  // New Agent button href - navigate to workspace agents page
  const newAgentHref = () => {
    const wsId = workspaceId();
    return wsId ? `/#/workspace/${wsId}/agents` : "/#/";
  };

  return (
    <header class="z-30 h-11 flex items-center justify-between px-4 bg-surface-raised rounded-lg mb-2 flex-shrink-0 mx-2 mt-2">
      {/* Left Side: Menu Button + App Title */}
      <div class="flex items-center gap-3 flex-1">
        <Show when={props.showMenuButton}>
          <button
            type="button"
            onClick={props.onMenuClick}
            class="flex items-center justify-center p-2 rounded-lg transition-all hover:bg-surface-overlay"
            classList={{
              "text-accent": props.menuButtonActive,
              "text-text-secondary": !props.menuButtonActive,
            }}
            aria-label="Toggle navigation menu"
            data-ph-capture-attribute-button-type="toggle-mobile-nav"
            data-ph-capture-attribute-is-active={props.menuButtonActive ? "true" : "false"}
          >
            <Menu size={20} />
          </button>
        </Show>

        {/* Desktop: Icon + Text */}
        <div class="hidden sm:flex items-center gap-2 flex-shrink-0">
          <BirdhouseIcon size={20} gradientId="header-birdhouse-gradient-desktop" />
          <h1 class="text-sm sm:text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
            Birdhouse
          </h1>
        </div>

        {/* Mobile: Icon Only */}
        <div class="sm:hidden flex items-center flex-shrink-0">
          <BirdhouseIcon size={20} gradientId="header-birdhouse-gradient-mobile" />
        </div>
      </div>

      {/* Center: New Agent Button */}
      <Button
        variant="primary"
        href={newAgentHref()}
        leftIcon={<AgentIcon size={16} />}
        class="whitespace-nowrap flex-shrink-0"
        data-ph-capture-attribute-button-type="new-agent"
        data-ph-capture-attribute-workspace-id={workspaceId()}
      >
        <span class="hidden sm:inline">New Agent</span>
      </Button>

      {/* Right Side: Workspace Context + Skills + Settings */}
      <div class="flex items-center gap-2 flex-1 justify-end">
        {/* Workspace Context Popover */}
        <WorkspaceContextPopover />

        {/* Skills Button */}
        <button
          type="button"
          onClick={() => openModal("skill-library-v2", "main")}
          class="flex items-center justify-center p-2 rounded-lg transition-all hover:bg-surface-overlay text-text-secondary"
          aria-label="Browse skills"
          title="Browse skills"
          data-ph-capture-attribute-button-type="open-skills-dialog"
          data-ph-capture-attribute-workspace-id={workspaceId()}
        >
          <SkillIcon size={18} />
        </button>

        {/* Settings Popover */}
        <Popover>
          <Popover.Trigger
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:bg-surface-overlay text-text-secondary"
            data-ph-capture-attribute-button-type="open-settings-popover"
          >
            <Settings size={18} />
            <span class="text-sm font-medium">Settings</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              class="w-fit min-w-72 max-w-96 max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-xl p-4 border shadow-2xl bg-surface-raised border-border"
              style={{ "z-index": baseZIndex }}
            >
              <Popover.Label class="font-bold mb-4 block text-lg text-heading">Settings</Popover.Label>

              <div class="space-y-4">
                {/* Color Mode Section */}
                <div class="space-y-2">
                  <span class="text-sm font-medium block text-text-secondary">Color Mode</span>
                  <ButtonGroup
                    items={[
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                      { value: "system", label: "System" },
                    ]}
                    value={colorMode()}
                    onChange={(value) => setColorModePreference(value as ColorMode)}
                    data-ph-capture-attribute-element-type="color-mode-selector"
                  />
                </div>

                {/* UI Size Section */}
                <div class="space-y-2">
                  <span class="text-sm font-medium block text-text-secondary">UI Size</span>
                  <ButtonGroup
                    items={[
                      { value: "sm", label: "Small" },
                      { value: "md", label: "Medium" },
                      { value: "lg", label: "Large" },
                    ]}
                    value={uiSize()}
                    onChange={(value) => setUiSizePreference(value as UiSize)}
                    data-ph-capture-attribute-element-type="ui-size-selector"
                  />
                </div>

                {/* Theme Section */}
                <div class="space-y-2">
                  <span class="text-sm font-medium block text-text-secondary">Theme</span>
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
                    renderOption={renderThemeOption}
                    placeholder="Select theme..."
                    inputClass="w-full px-3 py-2 rounded-lg text-sm border transition-colors bg-surface-overlay border-border-muted text-text-primary placeholder:text-text-muted focus:border-accent outline-none"
                  />
                </div>

                {/* Code Theme Section */}
                <div class="space-y-2">
                  <span class="text-sm font-medium block text-text-secondary">Code Theme</span>
                  <Combobox
                    options={CODE_THEME_IDS.map((themeId) => {
                      const displayName = CODE_THEME_DISPLAY_NAMES[themeId] ?? themeId;
                      const isDarkOnly = displayName.includes("●");
                      const isLightOnly = displayName.includes("○");
                      const label = displayName.replace(" ●", "").replace(" ○", "");
                      let description: string | undefined;
                      if (isDarkOnly) description = "Dark Only";
                      if (isLightOnly) description = "Light Only";
                      return { value: themeId, label, description };
                    })}
                    value={codeTheme()}
                    onSelect={setCodeThemePreference}
                    onPreview={setCodeThemePreference}
                    placeholder="Select code theme..."
                    inputClass="w-full px-3 py-2 rounded-lg text-sm border transition-colors bg-surface-overlay border-border-muted text-text-primary placeholder:text-text-muted focus:border-accent outline-none"
                  />
                </div>

                {/* Keep Agent in View Section */}
                <div class="space-y-2">
                  <span class="text-sm font-medium block text-text-secondary">Agent Tree Behavior</span>
                  <Checkbox
                    checked={keepAgentInView()}
                    onChange={setKeepAgentInViewPreference}
                    label="Keep selected agent in view"
                  />
                </div>
              </div>

              <Show when={workspaceId()}>
                <div class="mt-4 pt-4 border-t border-border">
                  <Button
                    variant="secondary"
                    leftIcon={<Settings size={16} />}
                    class="w-full"
                    onClick={() => openModal("workspace_config", workspaceId() ?? "")}
                  >
                    Workspace Settings
                  </Button>
                </div>
              </Show>

              <Popover.Arrow class="fill-surface-raised" />
            </Popover.Content>
          </Popover.Portal>
        </Popover>
      </div>
    </header>
  );
};

export default Header;
