// ABOUTME: Header title experiment - Icon Font Approach (Pseudo-elements)
// ABOUTME: Uses inline SVG in CSS pseudo-elements to treat icons as text characters with seamless gradient flow

import type { Component } from "solid-js";

export const metadata = {
  id: "05",
  title: "Icon Font Approach (Pseudo-elements)",
  description: "Uses inline SVG in CSS pseudo-elements to treat icons as text characters",
};

const Experiment05: Component = () => {
  return (
    <div class="space-y-8">
      {/* Desktop View - Full Text */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Desktop View (Full Text)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Title with icons as pseudo-elements */}
          <h1
            class="experiment-05-title text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap"
            title="Birdhouse"
          >
            Birdhouse
          </h1>
        </div>
      </div>

      {/* Desktop View - Playground */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Desktop View (Playground Mode)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          {/* Title with icons as pseudo-elements */}
          <h1
            class="experiment-05-title text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap"
            title="Birdhouse Playground"
          >
            Birdhouse Playground
          </h1>
        </div>
      </div>

      {/* Mobile View - Icons Only */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Mobile View (Icons Only)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border w-fit">
          {/* Icons only - text hidden */}
          <div class="experiment-05-icons-only bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent" />
        </div>
      </div>

      {/* Approach 1: SVG as background-image with mask */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Approach 1: SVG Background + Mask</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          <div class="experiment-05-bg-mask bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to">
            <span class="experiment-05-bg-mask-text">Birdhouse</span>
          </div>
        </div>
      </div>

      {/* Approach 2: Inline SVG pseudo-element content */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Approach 2: Pseudo-element with SVG Content</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          <div class="experiment-05-pseudo bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
            Birdhouse
          </div>
        </div>
      </div>

      {/* Approach 3: Unicode Icon Font Simulation */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Approach 3: Unicode Placeholder + SVG Mask</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          <div class="experiment-05-unicode bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
            🐦🏠 Birdhouse
          </div>
        </div>
      </div>

      {/* Approach 4: Single text node with ::before icons */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Approach 4: ::before Icons in Same Text Flow</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          <h1
            class="experiment-05-inline-icons text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap"
            title="Birdhouse"
          >
            Birdhouse
          </h1>
        </div>
      </div>

      {/* Comparison: Current approach (separate containers) */}
      <div class="space-y-2">
        <h3 class="text-sm font-medium text-text-secondary">Comparison: Current Approach (Separate Containers)</h3>
        <div class="flex items-center gap-3 px-4 py-3 bg-surface-raised rounded-lg border border-border">
          <div class="flex items-center gap-0.5 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <title>Bird Icon</title>
              <path d="M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
            </svg>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <title>Home Icon</title>
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
          </div>
          <h1 class="text-lg font-semibold bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent whitespace-nowrap">
            Birdhouse
          </h1>
          <span class="text-sm text-text-muted ml-2">(Icons in separate container from text)</span>
        </div>
      </div>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Experiment #05 - Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>Goal:</strong> Make icons behave EXACTLY like text characters so bg-clip-text gradient flows
            seamlessly
          </li>
          <li>
            <strong>Challenge:</strong> Icons (SVG) and text (DOM text nodes) are fundamentally different rendering
            contexts
          </li>
          <li>
            <strong>Approach 1 (bg-mask):</strong> Uses SVG as background-image with mask to clip gradient - but
            background doesn't flow with text
          </li>
          <li>
            <strong>Approach 2 (pseudo):</strong> Uses ::before pseudo-elements with SVG content - but pseudo-elements
            are separate from text flow
          </li>
          <li>
            <strong>Approach 3 (unicode):</strong> Uses Unicode emoji placeholders with SVG mask overlay - limited by
            emoji appearance
          </li>
          <li>
            <strong>Approach 4 (inline-icons):</strong> Uses ::before with inline SVG data URIs positioned before text -
            achieves closest to single text flow
          </li>
          <li>
            <strong>Key Limitation:</strong> CSS bg-clip-text only clips to text content, not to background images or
            pseudo-element content. True seamless gradient requires icons and text in same text node.
          </li>
          <li>
            <strong>Alternative Solution:</strong> Use inline SVG with shared gradient (see Experiment 01) which gives
            true seamless gradient but requires managing SVG directly
          </li>
          <li>
            <strong>Trade-off:</strong> Icon font approach (if we had a custom icon font) would work perfectly, but
            requires building/maintaining a font file
          </li>
        </ul>
      </div>

      {/* Technical Exploration */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Technical Exploration:</h3>
        <div class="space-y-2 text-text-secondary">
          <p>
            <strong>Why this is hard:</strong> bg-clip-text clips the background to the "text" content of an element. In
            CSS, "text" means actual text nodes, not background images, not pseudo-elements, not child elements.
          </p>
          <p>
            <strong>What works:</strong> A single text node like "Birdhouse" gets the gradient clipped perfectly to
            letter shapes.
          </p>
          <p>
            <strong>What doesn't work:</strong> Trying to inject SVG icons as if they were letters - they're rendered in
            different layers.
          </p>
          <p>
            <strong>Closest solution (without icon fonts):</strong> Inline SVG with shared gradient definition that
            encompasses both icons and text. The gradient is defined in SVG coordinate space and flows naturally.
          </p>
          <p>
            <strong>Icon font solution:</strong> Convert Bird and Home icons to font glyphs, then use them as actual
            text characters (e.g., "\ue001 \ue002 Birdhouse"). This would make them true text nodes and bg-clip-text
            would work perfectly.
          </p>
        </div>
      </div>

      {/* CSS defined inline for experiment */}
      <style>
        {`
          /* Approach 1: Background mask */
          .experiment-05-bg-mask {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            -webkit-mask-composite: source-in;
            mask-composite: intersect;
          }
          
          .experiment-05-bg-mask::before {
            content: '';
            display: inline-block;
            width: 24px;
            height: 24px;
            background: currentColor;
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20'/%3E%3C/svg%3E");
            -webkit-mask-size: contain;
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20'/%3E%3C/svg%3E");
            mask-size: contain;
          }
          
          .experiment-05-bg-mask::after {
            content: '';
            display: inline-block;
            width: 24px;
            height: 24px;
            background: currentColor;
            -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpath d='M9 22V12h6v10'/%3E%3C/svg%3E");
            -webkit-mask-size: contain;
            mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/%3E%3Cpath d='M9 22V12h6v10'/%3E%3C/svg%3E");
            mask-size: contain;
          }
          
          .experiment-05-bg-mask-text {
            background: inherit;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-size: 1.125rem;
            font-weight: 600;
          }

          /* Approach 2: Pseudo-element with gradient */
          .experiment-05-pseudo {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 1.125rem;
            font-weight: 600;
            padding-left: 3.5rem;
          }
          
          .experiment-05-pseudo::before {
            content: '';
            position: absolute;
            left: 0;
            display: inline-block;
            width: 48px;
            height: 24px;
            background: currentColor;
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 24' fill='none'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cg transform='translate(24,0)'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M9 22V12h6v10' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E") no-repeat;
            -webkit-mask-size: contain;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 24' fill='none'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cg transform='translate(24,0)'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M9 22V12h6v10' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E") no-repeat;
            mask-size: contain;
          }

          /* Approach 3: Unicode with overlay */
          .experiment-05-unicode {
            font-size: 1.125rem;
            font-weight: 600;
          }

          /* Approach 4: Inline icons - BEST ATTEMPT */
          .experiment-05-inline-icons::before {
            content: '';
            display: inline-block;
            width: 48px;
            height: 24px;
            margin-right: 0.75rem;
            vertical-align: middle;
            background: currentColor;
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 24' fill='none'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cg transform='translate(24,0)'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M9 22V12h6v10' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E") no-repeat;
            -webkit-mask-size: contain;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 24' fill='none'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cg transform='translate(24,0)'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M9 22V12h6v10' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E") no-repeat;
            mask-size: contain;
          }

          /* Main title approach - icons before text */
          .experiment-05-title::before {
            content: '';
            display: inline-block;
            width: 48px;
            height: 24px;
            margin-right: 0.75rem;
            vertical-align: middle;
            background: currentColor;
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 24' fill='none'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cg transform='translate(24,0)'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M9 22V12h6v10' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E") no-repeat;
            -webkit-mask-size: contain;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 24' fill='none'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cg transform='translate(24,0)'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M9 22V12h6v10' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E") no-repeat;
            mask-size: contain;
          }

          /* Icons only version */
          .experiment-05-icons-only {
            display: inline-block;
            width: 48px;
            height: 24px;
            position: relative;
          }
          
          .experiment-05-icons-only::before {
            content: '';
            position: absolute;
            inset: 0;
            background: currentColor;
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 24' fill='none'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cg transform='translate(24,0)'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M9 22V12h6v10' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E") no-repeat;
            -webkit-mask-size: contain;
            mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 24' fill='none'%3E%3Cpath d='M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cg transform='translate(24,0)'%3E%3Cpath d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M9 22V12h6v10' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3C/svg%3E") no-repeat;
            mask-size: contain;
          }
        `}
      </style>
    </div>
  );
};

export default Experiment05;
