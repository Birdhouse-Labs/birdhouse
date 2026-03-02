// ABOUTME: Button styles demo serving as a theme preview page
// ABOUTME: Shows canonical button variants: Primary, Secondary, Tertiary, Success, Danger

import {
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit,
  Heart,
  Mail,
  Menu,
  Plus,
  Search,
  Settings,
  Share2,
  Star,
  Trash2,
  User,
  X,
} from "lucide-solid";
import { type Component, createSignal } from "solid-js";
import { Button, ButtonGroup, IconButton, MenuItemButton } from "../components/ui";
import { cardSurfaceFlat } from "../styles/containerStyles";
import { setUiSizePreference, uiSize } from "../theme";

const ButtonStylesDemo: Component = () => {
  const [timeRange, setTimeRange] = createSignal<"day" | "week" | "month">("week");
  const [isFavorite, setIsFavorite] = createSignal(false);
  const [isLiked, setIsLiked] = createSignal(false);

  const sizeClasses = () => {
    const size = uiSize();
    return {
      button: size === "sm" ? "px-3 py-1.5 text-sm" : size === "md" ? "px-4 py-2 text-sm" : "px-5 py-2.5 text-base",
      iconButton: size === "sm" ? "w-8 h-8" : size === "md" ? "w-9 h-9" : "w-10 h-10",
      iconSize: size === "sm" ? 16 : size === "md" ? 18 : 20,
    };
  };

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Button Styles</h2>
        <p class="text-sm text-text-secondary hidden md:block">Comprehensive button variations and states</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Button demos container - matches typical usage background */}
        <div class={`rounded-xl ${cardSurfaceFlat} p-6 space-y-8`}>
          {/* Size Toggle */}
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-heading">Global UI Size</h3>
            <ButtonGroup
              items={[
                { value: "sm", label: "Small" },
                { value: "md", label: "Medium" },
                { value: "lg", label: "Large" },
              ]}
              value={uiSize()}
              onChange={(value) => setUiSizePreference(value as "sm" | "md" | "lg")}
            />
          </div>

          {/* Primary Buttons */}
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-heading">Primary Buttons</h3>
            <div class="flex flex-wrap gap-3">
              <Button variant="primary">Get Started</Button>
              <Button variant="primary" leftIcon={<Download size={sizeClasses().iconSize} />}>
                Download
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
          </div>

          {/* Secondary Buttons */}
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-heading">Secondary Buttons</h3>
            <div class="flex flex-wrap gap-3">
              <Button variant="secondary">View Details</Button>
              <Button variant="secondary" rightIcon={<Share2 size={sizeClasses().iconSize} />}>
                Share
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </div>
          </div>

          {/* Tertiary/Ghost Buttons */}
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-heading">Tertiary / Ghost Buttons</h3>
            <div class="flex flex-wrap gap-3">
              <Button variant="tertiary">Skip</Button>
              <Button variant="tertiary" leftIcon={<Clock size={sizeClasses().iconSize} />}>
                Maybe Later
              </Button>
              <Button variant="tertiary" disabled>
                Disabled
              </Button>
            </div>
          </div>

          {/* Success Buttons */}
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-heading">Success Buttons</h3>
            <div class="flex flex-wrap gap-3">
              <Button variant="success">Apply</Button>
              <Button variant="success" leftIcon={<Check size={sizeClasses().iconSize} />}>
                Save
              </Button>
              <Button variant="success" disabled>
                Disabled
              </Button>
            </div>
          </div>

          {/* Danger/Destructive Buttons */}
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-heading">Danger / Destructive Buttons</h3>
            <div class="flex flex-wrap gap-3">
              <Button variant="danger">Clear All</Button>
              <Button variant="danger" leftIcon={<Trash2 size={sizeClasses().iconSize} />}>
                Delete
              </Button>
              <Button variant="danger" disabled>
                Disabled
              </Button>
            </div>
          </div>

          {/* Icon Buttons */}
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-heading">Icon Buttons</h3>

            {/* Variants */}
            <div class="space-y-2">
              <p class="text-sm font-medium text-text-secondary">Variants</p>
              <div class="flex flex-wrap gap-3 items-center">
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<Settings />} aria-label="Settings" />
                  <span class="text-xs text-slate-500">secondary</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<Plus />} variant="primary" aria-label="Add" />
                  <span class="text-xs text-slate-500">primary</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<Download />} variant="ghost" aria-label="Download" />
                  <span class="text-xs text-slate-500">ghost</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<Trash2 />} variant="ghost-danger" aria-label="Delete" />
                  <span class="text-xs text-slate-500">ghost-danger</span>
                </div>
              </div>
            </div>

            {/* Shapes */}
            <div class="space-y-2">
              <p class="text-sm font-medium text-text-secondary">Shapes</p>
              <div class="flex flex-wrap gap-3 items-center">
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<Bell />} aria-label="Notifications" />
                  <span class="text-xs text-slate-500">square (default)</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<Bell />} shape="circular" aria-label="Notifications" />
                  <span class="text-xs text-slate-500">circular</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<Plus />} variant="primary" shape="circular" aria-label="Add" />
                  <span class="text-xs text-slate-500">primary + circular</span>
                </div>
              </div>
            </div>

            {/* Fixed Size */}
            <div class="space-y-2">
              <p class="text-sm font-medium text-text-secondary">Fixed Size (ignores global UI size)</p>
              <div class="flex flex-wrap gap-3 items-center">
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<X />} shape="circular" fixedSize aria-label="Close" />
                  <span class="text-xs text-slate-500">fixedSize</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<ChevronDown />} shape="circular" fixedSize aria-label="Expand" />
                  <span class="text-xs text-slate-500">fixedSize</span>
                </div>
                <div class="flex flex-col items-center gap-1">
                  <IconButton icon={<Menu />} fixedSize aria-label="Menu" />
                  <span class="text-xs text-slate-500">fixedSize square</span>
                </div>
              </div>
            </div>

            {/* Interactive Example */}
            <div class="space-y-2">
              <p class="text-sm font-medium text-text-secondary">Interactive Toggles</p>
              <div class="flex flex-wrap gap-6 items-center">
                <div class="flex items-center gap-2">
                  <IconButton
                    icon={<Heart fill={isFavorite() ? "currentColor" : "none"} />}
                    variant={isFavorite() ? "primary" : "secondary"}
                    aria-label={isFavorite() ? "Remove from favorites" : "Add to favorites"}
                    onClick={() => setIsFavorite(!isFavorite())}
                  />
                  <span class="text-sm text-text-secondary">{isFavorite() ? "Favorited!" : "Click to favorite"}</span>
                </div>
                <div class="flex items-center gap-2">
                  <IconButton
                    icon={
                      <Heart
                        fill={isLiked() ? "currentColor" : "none"}
                        class={isLiked() ? "text-accent-secondary" : ""}
                      />
                    }
                    variant="ghost"
                    fixedSize
                    aria-label={isLiked() ? "Unlike" : "Like"}
                    onClick={() => setIsLiked(!isLiked())}
                  />
                  <span class="text-sm text-text-secondary">{isLiked() ? "Liked!" : "Small ghost heart"}</span>
                </div>
              </div>
            </div>

            {/* Common Use Cases */}
            <div class="space-y-2">
              <p class="text-sm font-medium text-text-secondary">Common Use Cases</p>
              <div class="flex flex-wrap gap-2 items-center">
                <IconButton icon={<Search />} aria-label="Search" />
                <IconButton icon={<Bell />} aria-label="Notifications" />
                <IconButton icon={<Mail />} aria-label="Mail" />
                <IconButton icon={<User />} aria-label="User Profile" />
                <IconButton icon={<Star />} aria-label="Star" />
                <IconButton icon={<Bookmark />} aria-label="Bookmark" />
                <IconButton icon={<Share2 />} variant="ghost" aria-label="Share" />
                <IconButton icon={<Copy />} variant="ghost" aria-label="Copy" />
                <IconButton icon={<Edit />} variant="ghost" aria-label="Edit" />
              </div>
            </div>
          </div>

          {/* Button Groups */}
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-heading">Button Groups</h3>
            <div class="flex flex-wrap gap-6">
              {/* Joined buttons */}
              <ButtonGroup
                items={[
                  { value: "day", label: "Day" },
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                ]}
                value={timeRange()}
                onChange={(value) => setTimeRange(value as "day" | "week" | "month")}
              />

              {/* Icon group - action buttons */}
              <div class="inline-flex rounded-lg overflow-hidden border border-border-muted">
                <button
                  type="button"
                  classList={{
                    "px-3 py-1.5 text-sm": uiSize() === "sm",
                    "px-4 py-2 text-sm": uiSize() === "md",
                    "px-5 py-2.5 text-base": uiSize() === "lg",
                  }}
                  class="transition-all active:brightness-90 border-r bg-surface-overlay hover:bg-surface-raised text-text-primary border-border-muted"
                  title="More Options"
                >
                  <svg aria-hidden="true" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 12h.01M12 12h.01M18 12h.01"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  classList={{
                    "px-3 py-1.5 text-sm": uiSize() === "sm",
                    "px-4 py-2 text-sm": uiSize() === "md",
                    "px-5 py-2.5 text-base": uiSize() === "lg",
                  }}
                  class="transition-all active:brightness-90 border-r bg-surface-overlay hover:bg-surface-raised text-text-primary border-border-muted"
                  title="Edit"
                >
                  <svg aria-hidden="true" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  classList={{
                    "px-3 py-1.5 text-sm": uiSize() === "sm",
                    "px-4 py-2 text-sm": uiSize() === "md",
                    "px-5 py-2.5 text-base": uiSize() === "lg",
                  }}
                  class="transition-all active:brightness-90 bg-surface-overlay hover:bg-surface-raised text-text-primary"
                  title="Link"
                >
                  <svg aria-hidden="true" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Items / Dropdown Buttons */}
        <div class="space-y-3">
          <h3 class="text-lg font-semibold text-heading">Menu Items / Dropdown Buttons</h3>
          <p class="text-sm text-text-secondary">
            Buttons designed for use in popovers, dropdowns, and context menus. Key characteristic: hover uses{" "}
            <code class="px-1 py-0.5 rounded bg-surface-overlay text-accent text-xs">hover:bg-surface-overlay</code>{" "}
            (lighter) not{" "}
            <code class="px-1 py-0.5 rounded bg-surface-overlay text-danger text-xs line-through">
              hover:bg-surface
            </code>{" "}
            (darker).
          </p>

          {/* Basic Menu Items */}
          <div class="space-y-2">
            <p class="text-sm font-medium text-text-secondary">Basic Text Menu Items</p>
            <div class={`w-56 rounded-xl py-1 px-2 ${cardSurfaceFlat} shadow-2xl`}>
              <MenuItemButton>Profile Settings</MenuItemButton>
              <MenuItemButton>Preferences</MenuItemButton>
              <MenuItemButton>Help & Support</MenuItemButton>
              <MenuItemButton disabled>Disabled Item</MenuItemButton>
            </div>
          </div>

          {/* Menu Items with Icons */}
          <div class="space-y-2">
            <p class="text-sm font-medium text-text-secondary">Menu Items with Icons</p>
            <div class={`w-56 rounded-xl py-1 px-2 ${cardSurfaceFlat} shadow-2xl`}>
              <MenuItemButton icon={<Edit size={16} />}>Edit</MenuItemButton>
              <MenuItemButton icon={<Copy size={16} />}>Duplicate</MenuItemButton>
              <MenuItemButton icon={<Download size={16} />}>Download</MenuItemButton>
              <MenuItemButton icon={<Share2 size={16} />}>Share</MenuItemButton>
              <div class="my-1 mx-2 border-t border-border-muted" />
              <MenuItemButton icon={<Trash2 size={16} />} variant="danger">
                Delete
              </MenuItemButton>
            </div>
          </div>

          {/* States Demonstration */}
          <div class="space-y-2">
            <p class="text-sm font-medium text-text-secondary">State Variants</p>
            <div class="flex flex-wrap gap-6">
              {/* Normal state */}
              <div class="space-y-1">
                <p class="text-xs text-text-muted">Normal</p>
                <div class={`w-48 rounded-xl py-1 px-2 ${cardSurfaceFlat} shadow-2xl`}>
                  <MenuItemButton icon={<Edit size={16} />}>Edit Item</MenuItemButton>
                </div>
              </div>

              {/* Hover state (simulated with explicit class) */}
              <div class="space-y-1">
                <p class="text-xs text-text-muted">Hover (simulated)</p>
                <div class={`w-48 rounded-xl py-1 px-2 ${cardSurfaceFlat} shadow-2xl`}>
                  <MenuItemButton icon={<Edit size={16} />} class="bg-surface-overlay">
                    Edit Item
                  </MenuItemButton>
                </div>
              </div>

              {/* Disabled state */}
              <div class="space-y-1">
                <p class="text-xs text-text-muted">Disabled</p>
                <div class={`w-48 rounded-xl py-1 px-2 ${cardSurfaceFlat} shadow-2xl`}>
                  <MenuItemButton icon={<Edit size={16} />} disabled>
                    Edit Item
                  </MenuItemButton>
                </div>
              </div>

              {/* Danger variant */}
              <div class="space-y-1">
                <p class="text-xs text-text-muted">Danger</p>
                <div class={`w-48 rounded-xl py-1 px-2 ${cardSurfaceFlat} shadow-2xl`}>
                  <MenuItemButton icon={<Trash2 size={16} />} variant="danger">
                    Delete Item
                  </MenuItemButton>
                </div>
              </div>
            </div>
          </div>

          {/* CSS Reference */}
          <div class="space-y-2">
            <p class="text-sm font-medium text-text-secondary">CSS Class Reference</p>
            <div class="p-4 rounded-lg bg-surface-raised border border-border-muted">
              <p class="text-xs text-text-secondary mb-2">Core menu item classes:</p>
              <code class="text-xs text-accent block font-mono">
                w-full px-4 py-2 text-left text-sm text-text-primary
                <br />
                hover:bg-surface-overlay transition-all rounded-lg cursor-pointer
                <br />
                flex items-center gap-2
              </code>
              <p class="text-xs text-text-secondary mt-3 mb-2">Danger variant:</p>
              <code class="text-xs text-danger block font-mono">text-danger hover:bg-danger/10</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ButtonStylesDemo;
