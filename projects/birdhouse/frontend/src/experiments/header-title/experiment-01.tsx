// ABOUTME: Header title experiment - Bird + House SVG Mask Gradient
// ABOUTME: Uses inline SVG with shared gradient definition that flows seamlessly across both icons

import type { Component } from "solid-js";

export const metadata = {
  id: "01",
  title: "Bird + House SVG Mask Gradient",
  description: "Uses inline SVG with shared gradient definition, gradient flows seamlessly across both icons",
};

// SVG paths extracted from lucide-solid icons
const BIRD_PATH = "M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20";
const HOME_PATH = "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z";
const HOME_DOOR_PATH = "M9 22V12h6v10";

const Experiment01: Component = () => {
  return (
    <div class="space-y-8">
      {/* Desktop View - Full Text */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Desktop View (Full Text)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Inline SVG with Shared Gradient */}
          <svg
            width="48"
            height="24"
            viewBox="0 0 48 24"
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            aria-hidden="true"
          >
            {/* Shared gradient definition */}
            <defs>
              <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>

            {/* Bird icon positioned at x=0 */}
            <g transform="translate(0, 0)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="url(#headerGradient)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Home icon positioned at x=24 */}
            <g transform="translate(24, 0)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="url(#headerGradient)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="url(#headerGradient)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          </svg>

          <h1 class="text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
            Birdhouse
          </h1>
        </div>
      </div>

      {/* Desktop View - Playground */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Desktop View (Playground Mode)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Inline SVG with Shared Gradient */}
          <svg
            width="48"
            height="24"
            viewBox="0 0 48 24"
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            aria-hidden="true"
          >
            {/* Shared gradient definition */}
            <defs>
              <linearGradient id="headerGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>

            {/* Bird icon positioned at x=0 */}
            <g transform="translate(0, 0)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="url(#headerGradient2)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Home icon positioned at x=24 */}
            <g transform="translate(24, 0)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="url(#headerGradient2)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="url(#headerGradient2)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          </svg>

          <h1 class="text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
            Birdhouse Playground
          </h1>
        </div>
      </div>

      {/* Mobile View - Icons Only */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Mobile View (Icons Only)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border w-fit">
          {/* Inline SVG with Shared Gradient */}
          <svg
            width="48"
            height="24"
            viewBox="0 0 48 24"
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            aria-hidden="true"
          >
            {/* Shared gradient definition */}
            <defs>
              <linearGradient id="headerGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>

            {/* Bird icon positioned at x=0 */}
            <g transform="translate(0, 0)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="url(#headerGradient3)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Home icon positioned at x=24 */}
            <g transform="translate(24, 0)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="url(#headerGradient3)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="url(#headerGradient3)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Comparison: Independent Gradients (for reference) */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Comparison: Independent Colors Per Icon (Not Used)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Independent colors - no gradient flow */}
          <svg
            width="48"
            height="24"
            viewBox="0 0 48 24"
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            aria-hidden="true"
          >
            {/* Bird icon with from color */}
            <g transform="translate(0, 0)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="var(--theme-gradient-from)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Home icon with to color */}
            <g transform="translate(24, 0)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="var(--theme-gradient-to)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="var(--theme-gradient-to)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          </svg>
          <span class="text-sm text-text-muted">(Each icon has separate color - gradient doesn't flow)</span>
        </div>
      </div>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Experiment #01 - Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>Shared Gradient:</strong> A single gradient definition flows across both icons seamlessly
          </li>
          <li>
            <strong>Positioning:</strong> Icons are positioned side-by-side in a single SVG viewport (48x24)
          </li>
          <li>
            <strong>Gradient Direction:</strong> Flows horizontally from left (Bird) to right (House)
          </li>
          <li>
            <strong>Three-Stop Gradient:</strong> Uses from-gradient-from, via-gradient-via, to-gradient-to for richer
            color transition
          </li>
          <li>
            <strong>No Button Behavior:</strong> Icons are decorative only - no hover states or cursor pointer
          </li>
          <li>
            <strong>Responsive:</strong> Shows full "Birdhouse" text on desktop, icons only on mobile
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Experiment01;
