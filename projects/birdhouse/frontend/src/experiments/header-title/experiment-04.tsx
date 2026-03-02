// ABOUTME: Header title experiment - Text Gradient Technique (bg-clip-text)
// ABOUTME: Uses same bg-gradient-to-r bg-clip-text text-transparent as current title, icons use currentColor

import { Bird, Home } from "lucide-solid";
import type { Component } from "solid-js";

export const metadata = {
  id: "04",
  title: "Text Gradient Technique (bg-clip-text)",
  description: "Uses same bg-gradient-to-r bg-clip-text text-transparent as current title, icons use currentColor",
};

const Experiment04: Component = () => {
  return (
    <div class="space-y-8">
      {/* Desktop View - Full Text */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Desktop View (Full Text)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Icon container with bg-clip-text gradient */}
          <div class="flex items-center gap-0.5 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
            <Bird size={24} style={{ stroke: "currentColor", fill: "none" }} />
            <Home size={24} style={{ stroke: "currentColor", fill: "none" }} />
          </div>

          <h1 class="text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
            Birdhouse
          </h1>
        </div>
      </div>

      {/* Desktop View - Playground */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Desktop View (Playground Mode)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Icon container with bg-clip-text gradient */}
          <div class="flex items-center gap-0.5 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
            <Bird size={24} style={{ stroke: "currentColor", fill: "none" }} />
            <Home size={24} style={{ stroke: "currentColor", fill: "none" }} />
          </div>

          <h1 class="text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
            Birdhouse Playground
          </h1>
        </div>
      </div>

      {/* Mobile View - Icons Only */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Mobile View (Icons Only)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border w-fit">
          {/* Icon container with bg-clip-text gradient */}
          <div class="flex items-center gap-0.5 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
            <Bird size={24} style={{ stroke: "currentColor", fill: "none" }} />
            <Home size={24} style={{ stroke: "currentColor", fill: "none" }} />
          </div>
        </div>
      </div>

      {/* Variation: Tighter Spacing */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Variation: Tighter Spacing (gap-0)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border w-fit">
          {/* Icon container with bg-clip-text gradient and no gap */}
          <div class="flex items-center gap-0 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
            <Bird size={24} style={{ stroke: "currentColor", fill: "none" }} />
            <Home size={24} style={{ stroke: "currentColor", fill: "none" }} />
          </div>
        </div>
      </div>

      {/* Variation: Different Sizes */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Variation: Different Sizes</h3>
        <div class="flex items-center gap-4 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Small */}
          <div class="flex flex-col items-center gap-1">
            <div class="flex items-center gap-0.5 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
              <Bird size={16} style={{ stroke: "currentColor", fill: "none" }} />
              <Home size={16} style={{ stroke: "currentColor", fill: "none" }} />
            </div>
            <span class="text-xs text-text-muted">16px</span>
          </div>

          {/* Medium */}
          <div class="flex flex-col items-center gap-1">
            <div class="flex items-center gap-0.5 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
              <Bird size={20} style={{ stroke: "currentColor", fill: "none" }} />
              <Home size={20} style={{ stroke: "currentColor", fill: "none" }} />
            </div>
            <span class="text-xs text-text-muted">20px</span>
          </div>

          {/* Default */}
          <div class="flex flex-col items-center gap-1">
            <div class="flex items-center gap-0.5 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
              <Bird size={24} style={{ stroke: "currentColor", fill: "none" }} />
              <Home size={24} style={{ stroke: "currentColor", fill: "none" }} />
            </div>
            <span class="text-xs text-text-muted">24px</span>
          </div>

          {/* Large */}
          <div class="flex flex-col items-center gap-1">
            <div class="flex items-center gap-0.5 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
              <Bird size={32} style={{ stroke: "currentColor", fill: "none" }} />
              <Home size={32} style={{ stroke: "currentColor", fill: "none" }} />
            </div>
            <span class="text-xs text-text-muted">32px</span>
          </div>
        </div>
      </div>

      {/* Comparison: Without Gradient */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Comparison: Without Gradient (Plain Text Color)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          <div class="flex items-center gap-0.5 text-text-primary">
            <Bird size={24} style={{ stroke: "currentColor", fill: "none" }} />
            <Home size={24} style={{ stroke: "currentColor", fill: "none" }} />
          </div>
          <h1 class="text-lg font-semibold text-text-primary whitespace-nowrap">Birdhouse</h1>
          <span class="text-sm text-text-muted ml-2">(No gradient applied)</span>
        </div>
      </div>

      {/* Technical Demo: How bg-clip-text Works */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Technical Demo: How bg-clip-text Works</h3>
        <div class="space-y-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Step 1: Background gradient */}
          <div class="space-y-1">
            <p class="text-xs text-text-muted">1. Apply background gradient (bg-gradient-to-r)</p>
            <div class="bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to p-3 rounded">
              <div class="flex items-center gap-0.5">
                <Bird size={24} style={{ stroke: "currentColor", fill: "none" }} />
                <Home size={24} style={{ stroke: "currentColor", fill: "none" }} />
              </div>
            </div>
          </div>

          {/* Step 2: Clip to text */}
          <div class="space-y-1">
            <p class="text-xs text-text-muted">2. Clip background to text content (bg-clip-text)</p>
            <div class="bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text p-3 rounded border border-border">
              <div class="flex items-center gap-0.5">
                <Bird size={24} style={{ stroke: "currentColor", fill: "none" }} />
                <Home size={24} style={{ stroke: "currentColor", fill: "none" }} />
              </div>
            </div>
          </div>

          {/* Step 3: Make text transparent */}
          <div class="space-y-1">
            <p class="text-xs text-text-muted">3. Make text transparent to reveal gradient (text-transparent)</p>
            <div class="bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent p-3 rounded border border-border">
              <div class="flex items-center gap-0.5">
                <Bird size={24} style={{ stroke: "currentColor", fill: "none" }} />
                <Home size={24} style={{ stroke: "currentColor", fill: "none" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Experiment #04 - Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>Same Technique as Text:</strong> Uses identical bg-gradient-to-r bg-clip-text text-transparent as
            current title
          </li>
          <li>
            <strong>currentColor Inheritance:</strong> Icons use stroke: currentColor to inherit the gradient color from
            the container
          </li>
          <li>
            <strong>Seamless Gradient Flow:</strong> Gradient flows across both icons since they're in the same
            container with bg-clip-text
          </li>
          <li>
            <strong>Three-Stop Gradient:</strong> Uses from-gradient-from, via-gradient-via, to-gradient-to matching
            existing title
          </li>
          <li>
            <strong>No Button Behavior:</strong> Icons are decorative only - no hover states or cursor pointer
          </li>
          <li>
            <strong>Responsive:</strong> Shows full "Birdhouse" text on desktop, icons only on mobile
          </li>
          <li>
            <strong>Limitation:</strong> bg-clip-text clips to the icon strokes, so the gradient visibility depends on
            stroke coverage. Works best with outline icons.
          </li>
          <li>
            <strong>Gap Control:</strong> Can adjust gap between icons (gap-0, gap-0.5, gap-1) to control how gradient
            flows
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Experiment04;
