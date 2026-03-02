// ABOUTME: Current production button styles with cursor-following gradient hotspot effect
// ABOUTME: Shows Button and ButtonGroup components with interactive cursor-tracking

import { Download } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal } from "solid-js";
import { Button, ButtonGroup } from "../../components/ui";

export const metadata = {
  id: "15",
  title: "Current Live Buttons (Cursor-Following Gradient)",
  description: "Production Button and ButtonGroup components with cursor-tracking radial gradient hotspot",
};

/**
 * Current Live Button Implementation
 *
 * Features:
 * - Cursor-following radial gradient hotspot on hover
 * - Primary: Gradient background with glow shadow and scale effects
 * - Secondary: Solid surface with brightness shift
 * - Tertiary: Ghost style with accent color
 * - ButtonGroup: Segmented controls with cursor-following effect
 *
 * The cursor-following effect:
 * - Tracks mouse position within button bounds
 * - Creates radial gradient "light source" at cursor position
 * - GPU-accelerated via CSS custom properties and transforms
 * - Respects prefers-reduced-motion and disabled on touch devices
 */
const Experiment15: Component = () => {
  const [timeRange, setTimeRange] = createSignal<"day" | "week" | "month">("week");

  return (
    <div class="space-y-6">
      {/* Primary Buttons */}
      <div class="space-y-2">
        <h4 class="text-xs text-text-secondary">Primary Button</h4>
        <div class="flex flex-wrap gap-3">
          <Button variant="primary">Get Started</Button>
          <Button variant="primary" leftIcon={<Download />}>
            Download
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </div>

      {/* Secondary Buttons */}
      <div class="space-y-2">
        <h4 class="text-xs text-text-secondary">Secondary Button</h4>
        <div class="flex flex-wrap gap-3">
          <Button variant="secondary">View Details</Button>
          <Button variant="secondary" leftIcon={<Download />}>
            Export
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
      </div>

      {/* Tertiary Buttons */}
      <div class="space-y-2">
        <h4 class="text-xs text-text-secondary">Tertiary Button</h4>
        <div class="flex flex-wrap gap-3">
          <Button variant="tertiary">Skip</Button>
          <Button variant="tertiary" leftIcon={<Download />}>
            Maybe Later
          </Button>
          <Button variant="tertiary" disabled>
            Disabled
          </Button>
        </div>
      </div>

      {/* Button Groups */}
      <div class="space-y-2">
        <h4 class="text-xs text-text-secondary">Button Groups (with cursor-following)</h4>
        <div class="flex flex-wrap gap-6">
          <ButtonGroup
            items={[
              { value: "day", label: "Day" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
            value={timeRange()}
            onChange={(value) => setTimeRange(value as "day" | "week" | "month")}
          />
        </div>
      </div>
    </div>
  );
};

export default Experiment15;
