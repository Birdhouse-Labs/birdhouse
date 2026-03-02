// ABOUTME: Header title experiment - Single Birdhouse Icon
// ABOUTME: Uses just the Birdhouse icon with gradient, simplest approach

import { type Component, createSignal } from "solid-js";
import { Button } from "../../components/ui";

export const metadata = {
  id: "07",
  title: "Single Birdhouse Icon",
  description: "Simplest approach - just the Birdhouse icon with gradient, matches current text gradient technique",
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

const Experiment07: Component = () => {
  const [viewMode, setViewMode] = createSignal<"desktop" | "mobile">("desktop");

  return (
    <div class="space-y-6">
      {/* Demo Controls */}
      <div class="flex gap-2">
        <Button variant={viewMode() === "desktop" ? "primary" : "secondary"} onClick={() => setViewMode("desktop")}>
          Desktop View
        </Button>
        <Button variant={viewMode() === "mobile" ? "primary" : "secondary"} onClick={() => setViewMode("mobile")}>
          Mobile View
        </Button>
      </div>

      {/* Desktop View - Full Text with Icon */}
      {viewMode() === "desktop" && (
        <div class="space-y-4">
          <h3 class="text-sm font-medium text-text-secondary">Desktop: Icon + "Birdhouse" Text</h3>
          <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
            <BirdhouseIcon size={24} gradientId="birdhouse-gradient-1" />
            <h1 class="text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
              Birdhouse
            </h1>
          </div>

          <h3 class="text-sm font-medium text-text-secondary">Desktop: Icon + "Birdhouse Playground" Text</h3>
          <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
            <BirdhouseIcon size={24} gradientId="birdhouse-gradient-2" />
            <h1 class="text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
              Birdhouse Playground
            </h1>
          </div>
        </div>
      )}

      {/* Mobile View - Icon Only */}
      {viewMode() === "mobile" && (
        <div class="space-y-4">
          <h3 class="text-sm font-medium text-text-secondary">Mobile: Icon Only</h3>
          <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border w-fit">
            <BirdhouseIcon size={24} gradientId="birdhouse-gradient-mobile" />
          </div>
        </div>
      )}

      {/* Size Variations */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Size Variations</h3>
        <div class="flex items-center gap-6 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Small */}
          <div class="flex flex-col items-center gap-1">
            <BirdhouseIcon size={16} gradientId="birdhouse-gradient-16" />
            <span class="text-xs text-text-muted">16px</span>
          </div>

          {/* Medium */}
          <div class="flex flex-col items-center gap-1">
            <BirdhouseIcon size={20} gradientId="birdhouse-gradient-20" />
            <span class="text-xs text-text-muted">20px</span>
          </div>

          {/* Default (header size) */}
          <div class="flex flex-col items-center gap-1">
            <BirdhouseIcon size={24} gradientId="birdhouse-gradient-24" />
            <span class="text-xs text-text-muted">24px</span>
          </div>

          {/* Large */}
          <div class="flex flex-col items-center gap-1">
            <BirdhouseIcon size={32} gradientId="birdhouse-gradient-32" />
            <span class="text-xs text-text-muted">32px</span>
          </div>
        </div>
      </div>

      {/* In Context: Mock Header */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">In Context: Mock Header</h3>
        <div class="bg-surface-raised rounded-lg border border-border overflow-hidden">
          {/* Mock header bar */}
          <div class="h-11 flex items-center justify-between px-4">
            {/* Left: Menu + Title */}
            <div class="flex items-center gap-3">
              {/* Mock menu button */}
              <div class="w-5 h-5 rounded bg-surface-overlay" />

              {/* Title with icon - Desktop */}
              <div class="hidden sm:flex items-center gap-2">
                <BirdhouseIcon size={20} gradientId="birdhouse-gradient-header-desktop" />
                <h1 class="text-sm sm:text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
                  Birdhouse
                </h1>
              </div>

              {/* Icon only - Mobile */}
              <div class="sm:hidden flex items-center">
                <BirdhouseIcon size={20} gradientId="birdhouse-gradient-header-mobile" />
              </div>
            </div>

            {/* Right: Mock buttons */}
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded bg-surface-overlay" />
              <div class="w-5 h-5 rounded bg-surface-overlay" />
              <div class="w-16 h-7 rounded bg-surface-overlay" />
            </div>
          </div>
        </div>
      </div>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Experiment #07 - Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>Simplest Approach:</strong> Single Birdhouse icon (the "birdhouse" from Lucide) with gradient
          </li>
          <li>
            <strong>SVG Gradient Technique:</strong> Uses inline SVG with linearGradient definition to apply gradient to
            stroke (bg-clip-text doesn't work with SVG strokes)
          </li>
          <li>
            <strong>No Cross-Icon Gradient Issues:</strong> Only one icon, so no complexity with spanning gradients
          </li>
          <li>
            <strong>Consistent Styling:</strong> Icon gradient uses same CSS variables as text gradient
          </li>
          <li>
            <strong>Responsive:</strong> Desktop shows icon + text, mobile shows just icon
          </li>
          <li>
            <strong>Clean & Maintainable:</strong> Extracted into a reusable component with gradient ID prop
          </li>
          <li>
            <strong>Semantic:</strong> A house icon for "Birdhouse" is clear and recognizable
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Experiment07;
