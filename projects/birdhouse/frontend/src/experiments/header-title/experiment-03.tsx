// ABOUTME: Header title experiment - SVG Path Direct Gradient Fill
// ABOUTME: Extracts icon SVG paths and applies gradient fill directly, single gradient spans both icons

import { createSignal } from "solid-js";
import { Button } from "../../components/ui";

export const metadata = {
  id: "03",
  title: "SVG Path Direct Gradient Fill",
  description: "Extracts icon SVG paths and applies gradient fill directly, single gradient spans both icons",
};

// SVG paths manually extracted from lucide-solid icons
// Bird icon from lucide-solid
const BIRD_PATH = "M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20";

// Home icon from lucide-solid
const HOME_PATH = "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z";
const HOME_DOOR_PATH = "M9 22V12h6v10";

const Experiment03 = () => {
  const [view, setView] = createSignal<"desktop" | "mobile">("desktop");

  const toggleView = () => {
    setView(view() === "desktop" ? "mobile" : "desktop");
  };

  return (
    <div class="space-y-4">
      {/* Demo Controls */}
      <div class="flex gap-2 flex-wrap">
        <Button variant="secondary" onClick={toggleView}>
          Toggle View (Currently: {view()})
        </Button>
      </div>

      {/* Experiment Card */}
      <div class="bg-surface-raised rounded-lg border border-border p-8 flex items-center justify-center">
        {/* Desktop View - Full Text */}
        {view() === "desktop" && (
          <div class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24" class="h-6" aria-hidden="true">
              <title>Birdhouse Logo</title>
              {/* Single gradient definition spanning entire width */}
              <defs>
                <linearGradient id="birdhouseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                  <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                  <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
                </linearGradient>
              </defs>

              {/* Bird icon (left side) */}
              <g transform="translate(0, 0)">
                <path
                  d={BIRD_PATH}
                  fill="none"
                  stroke="url(#birdhouseGradient)"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>

              {/* Home icon (right side) */}
              <g transform="translate(24, 0)">
                <path
                  d={HOME_PATH}
                  fill="none"
                  stroke="url(#birdhouseGradient)"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d={HOME_DOOR_PATH}
                  fill="none"
                  stroke="url(#birdhouseGradient)"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
            </svg>

            <span class="text-2xl font-bold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
              Birdhouse
            </span>
          </div>
        )}

        {/* Mobile View - Icons Only */}
        {view() === "mobile" && (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24" class="h-6" aria-label="Birdhouse">
            <title>Birdhouse</title>
            {/* Single gradient definition spanning entire width */}
            <defs>
              <linearGradient id="birdhouseGradientMobile" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="50%" style={{ "stop-color": "var(--theme-gradient-via)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>

            {/* Bird icon (left side) */}
            <g transform="translate(0, 0)">
              <path
                d={BIRD_PATH}
                fill="none"
                stroke="url(#birdhouseGradientMobile)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>

            {/* Home icon (right side) */}
            <g transform="translate(24, 0)">
              <path
                d={HOME_PATH}
                fill="none"
                stroke="url(#birdhouseGradientMobile)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d={HOME_DOOR_PATH}
                fill="none"
                stroke="url(#birdhouseGradientMobile)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          </svg>
        )}
      </div>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Experiment #03 - Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>SVG Path Extraction:</strong> Manually extracted paths from lucide-solid Bird and Home icons
          </li>
          <li>
            <strong>Single Gradient:</strong> One linearGradient definition spans the entire combined width (both icons)
          </li>
          <li>
            <strong>Gradient Colors:</strong> Uses from-gradient-from (0%), via-gradient-via (50%), to-gradient-to
            (100%) matching title text
          </li>
          <li>
            <strong>Desktop View:</strong> Shows icons + "Birdhouse" text with matching gradient
          </li>
          <li>
            <strong>Mobile View:</strong> Shows just the two icons side-by-side
          </li>
          <li>
            <strong>No Button Styling:</strong> Icons are static, no hover states or pointer cursor
          </li>
          <li>
            <strong>Seamless Flow:</strong> Gradient flows continuously across both icons (Bird → Home)
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Experiment03;
