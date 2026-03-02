// ABOUTME: Header title experiment - Single SVG with Icon Paths + Text
// ABOUTME: Custom SVG combining icon paths and text in one element with unified gradient

import type { Component } from "solid-js";

export const metadata = {
  id: "06",
  title: "Single SVG with Icon Paths + Text",
  description: "Custom SVG combining icon paths and text in one element with unified gradient",
};

// SVG paths extracted from lucide-solid icons (24x24 viewport)
const BIRD_PATH = "M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20";
const HOME_PATH = "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z";
const HOME_DOOR_PATH = "M9 22V12h6v10";

const Experiment06: Component = () => {
  return (
    <div class="space-y-8">
      {/* Desktop View - Full Text */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Desktop View (Full Text)</h3>
        <div class="flex items-center px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Single SVG with icons and text in one coordinate system */}
          <svg
            width="200"
            height="32"
            viewBox="0 0 200 32"
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            aria-label="Birdhouse"
          >
            <title>Birdhouse</title>
            {/* Single gradient definition for entire SVG */}
            <defs>
              <linearGradient id="unifiedGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>

            {/* Bird icon - positioned at x=0, scaled to fit 32px height */}
            <g transform="translate(4, 4) scale(1)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="url(#unifiedGradient1)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Home icon - positioned at x=28 */}
            <g transform="translate(28, 4) scale(1)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="url(#unifiedGradient1)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="url(#unifiedGradient1)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Text element - positioned after icons */}
            <text
              x="60"
              y="22"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="18"
              font-weight="600"
              fill="url(#unifiedGradient1)"
            >
              Birdhouse
            </text>
          </svg>
        </div>
      </div>

      {/* Desktop View - Playground */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Desktop View (Playground Mode)</h3>
        <div class="flex items-center px-4 py-3 bg-surface-raised rounded-lg border border-border">
          <svg
            width="280"
            height="32"
            viewBox="0 0 280 32"
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            aria-label="Birdhouse Playground"
          >
            <title>Birdhouse Playground</title>
            <defs>
              <linearGradient id="unifiedGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>

            {/* Bird icon */}
            <g transform="translate(4, 4) scale(1)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="url(#unifiedGradient2)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Home icon */}
            <g transform="translate(28, 4) scale(1)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="url(#unifiedGradient2)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="url(#unifiedGradient2)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Text element */}
            <text
              x="60"
              y="22"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="18"
              font-weight="600"
              fill="url(#unifiedGradient2)"
            >
              Birdhouse Playground
            </text>
          </svg>
        </div>
      </div>

      {/* Mobile View - Icons Only */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Mobile View (Icons Only)</h3>
        <div class="flex items-center px-4 py-3 bg-surface-raised rounded-lg border border-border w-fit">
          <svg
            width="56"
            height="32"
            viewBox="0 0 56 32"
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            aria-label="Birdhouse"
          >
            <title>Birdhouse</title>
            <defs>
              <linearGradient id="unifiedGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>

            {/* Bird icon */}
            <g transform="translate(4, 4) scale(1)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="url(#unifiedGradient3)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Home icon */}
            <g transform="translate(28, 4) scale(1)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="url(#unifiedGradient3)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="url(#unifiedGradient3)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Larger Size Example - Shows gradient flow better */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Larger Size (Shows Gradient Flow)</h3>
        <div class="flex items-center px-4 py-3 bg-surface-raised rounded-lg border border-border">
          <svg
            width="400"
            height="64"
            viewBox="0 0 400 64"
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            aria-label="Birdhouse"
          >
            <title>Birdhouse</title>
            <defs>
              <linearGradient id="unifiedGradient4" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>

            {/* Bird icon - scaled 2x */}
            <g transform="translate(8, 8) scale(2)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="url(#unifiedGradient4)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Home icon - scaled 2x */}
            <g transform="translate(56, 8) scale(2)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="url(#unifiedGradient4)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="url(#unifiedGradient4)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Text element - larger */}
            <text
              x="120"
              y="44"
              font-family="system-ui, -apple-system, sans-serif"
              font-size="36"
              font-weight="600"
              fill="url(#unifiedGradient4)"
            >
              Birdhouse
            </text>
          </svg>
        </div>
      </div>

      {/* Comparison: Separate Elements */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Comparison: Separate Elements (Current Approach)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          <svg
            width="48"
            height="24"
            viewBox="0 0 48 24"
            xmlns="http://www.w3.org/2000/svg"
            class="flex-shrink-0"
            aria-hidden="true"
          >
            <title>Bird and Home icons</title>
            <defs>
              <linearGradient id="separateGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>

            <g transform="translate(0, 0)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="url(#separateGradient1)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            <g transform="translate(24, 0)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="url(#separateGradient1)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="url(#separateGradient1)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          </svg>

          {/* Separate text element with its own gradient */}
          <h1 class="text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
            Birdhouse
          </h1>

          <span class="text-sm text-text-muted ml-4">(Icons and text are separate - gradient restarts)</span>
        </div>
      </div>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Experiment #06 - Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>Unified SVG:</strong> Icon paths and text elements are in ONE SVG with a single coordinate system
          </li>
          <li>
            <strong>Single Gradient:</strong> One gradient definition flows seamlessly from left edge (bird icon)
            through text to right edge
          </li>
          <li>
            <strong>Everything Together:</strong> Bird, Home, and "Birdhouse" text are all part of the same SVG element
          </li>
          <li>
            <strong>Gradient Flow:</strong> The gradient is applied to the entire SVG viewBox, so it flows continuously
            across all elements
          </li>
          <li>
            <strong>Custom "Font":</strong> This approach treats icons like characters in a custom font - everything is
            vector paths/text in one SVG
          </li>
          <li>
            <strong>Responsive:</strong> Different viewBox sizes for desktop/mobile - just show icons on mobile, full
            text on desktop
          </li>
          <li>
            <strong>Comparison:</strong> The "Separate Elements" example shows the current approach where icons and text
            have independent gradients
          </li>
          <li>
            <strong>Trade-offs:</strong> More complex to position, but gradient truly flows as one. Font rendering in
            SVG may differ slightly from HTML text.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Experiment06;
