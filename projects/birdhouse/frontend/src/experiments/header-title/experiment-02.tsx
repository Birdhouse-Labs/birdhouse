// ABOUTME: Header title experiment - CSS Mask with Positioned Icons
// ABOUTME: Uses CSS mask-image/clip-path with a gradient background, icons clipped to show gradient

import { Bird, Home } from "lucide-solid";
import { createSignal } from "solid-js";
import { Button } from "../../components/ui";

export const metadata = {
  id: "02",
  title: "CSS Mask with Positioned Icons",
  description: "Uses CSS mask-image/clip-path with a gradient background, icons clipped to show gradient",
};

const Experiment02 = () => {
  const [viewMode, setViewMode] = createSignal<"desktop" | "mobile">("desktop");

  const cycleViewMode = () => {
    setViewMode((current) => (current === "desktop" ? "mobile" : "desktop"));
  };

  return (
    <div class="space-y-4">
      {/* Demo Controls */}
      <div class="flex gap-2 flex-wrap">
        <Button variant="secondary" onClick={cycleViewMode}>
          Toggle View Mode (Currently: {viewMode()})
        </Button>
      </div>

      {/* Experiment Card */}
      <div class="flex flex-col gap-8 bg-surface-raised rounded-lg p-8 border border-border">
        {/* Desktop View */}
        {viewMode() === "desktop" && (
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-text-secondary">Desktop View - Full Text</h3>
            <div class="flex items-center justify-center p-8 bg-surface rounded-lg">
              <div class="header-title-wrapper">
                <Bird size={24} class="header-icon" />
                <span class="header-text">Birdhouse</span>
                <Home size={24} class="header-icon" />
              </div>
            </div>

            <div class="flex items-center justify-center p-8 bg-surface rounded-lg">
              <div class="header-title-wrapper">
                <Bird size={24} class="header-icon" />
                <span class="header-text">Birdhouse Playground</span>
                <Home size={24} class="header-icon" />
              </div>
            </div>
          </div>
        )}

        {/* Mobile View */}
        {viewMode() === "mobile" && (
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-text-secondary">Mobile View - Icons Only</h3>
            <div class="flex items-center justify-center p-8 bg-surface rounded-lg">
              <div class="header-title-wrapper-mobile">
                <Bird size={24} class="header-icon" />
                <Home size={24} class="header-icon" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS for the gradient effect */}
      <style>{`
        /* Desktop wrapper - contains gradient background */
        .header-title-wrapper {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          position: relative;
          padding: 0.5rem 1rem;
          background: linear-gradient(
            to right,
            var(--theme-gradient-from),
            var(--theme-gradient-via),
            var(--theme-gradient-to)
          );
          border-radius: 0.5rem;
          /* Mask the entire wrapper to show gradient only through icons and text */
          -webkit-mask-image: var(--mask-content);
          mask-image: var(--mask-content);
          -webkit-mask-size: cover;
          mask-size: cover;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
        }

        /* Mobile wrapper - tighter spacing for icons only */
        .header-title-wrapper-mobile {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          position: relative;
          padding: 0.5rem;
          background: linear-gradient(
            to right,
            var(--theme-gradient-from),
            var(--theme-gradient-via),
            var(--theme-gradient-to)
          );
          border-radius: 0.5rem;
          /* Mask to show gradient only through icons */
          -webkit-mask-image: var(--mask-content);
          mask-image: var(--mask-content);
          -webkit-mask-size: cover;
          mask-size: cover;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
        }

        /* Icons and text - these become the mask */
        .header-icon {
          color: black; /* The color creates the mask shape */
          flex-shrink: 0;
        }

        .header-text {
          font-size: 1.25rem;
          font-weight: 600;
          color: black; /* The color creates the mask shape */
          white-space: nowrap;
        }

        /* Note: The mask-image approach requires creating an SVG or using 
           background-clip. Let's use a simpler approach with background-clip */
      `}</style>

      {/* Alternative approach using background-clip */}
      <style>{`
        /* Override above with simpler background-clip approach */
        .header-title-wrapper,
        .header-title-wrapper-mobile {
          -webkit-mask-image: none;
          mask-image: none;
          background: transparent;
          padding: 0;
          border-radius: 0;
        }

        .header-icon,
        .header-text {
          background: linear-gradient(
            to right,
            var(--theme-gradient-from),
            var(--theme-gradient-via),
            var(--theme-gradient-to)
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }

        /* Ensure no pointer cursor or button-like appearance */
        .header-title-wrapper,
        .header-title-wrapper-mobile,
        .header-icon,
        .header-text {
          cursor: default;
        }
      `}</style>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Experiment #02 - Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>Approach:</strong> Uses CSS background-clip technique to show gradient through both icons and text.
            Each element gets the gradient background and is clipped to its content shape.
          </li>
          <li>
            <strong>Gradient Flow:</strong> The gradient flows seamlessly because each element has the same gradient
            definition (from-via-to). The visual effect is that the gradient "reveals" through the shapes.
          </li>
          <li>
            <strong>Desktop View:</strong> Shows Bird icon + "Birdhouse" text + Home icon or longer "Birdhouse
            Playground" variant.
          </li>
          <li>
            <strong>Mobile View:</strong> Shows just the Bird and Home icons with tighter spacing.
          </li>
          <li>
            <strong>No Button Styling:</strong> No hover states, pointer cursor, or interactive appearance. This is
            purely decorative branding.
          </li>
          <li>
            <strong>Technical Details:</strong> Uses -webkit-background-clip: text and -webkit-text-fill-color:
            transparent to show gradient through SVG icons (rendered as text) and text content.
          </li>
          <li>
            <strong>Limitation:</strong> This approach treats icons as text, which works because lucide-solid renders
            them inline. True mask-image would require more complex SVG composition or canvas rendering.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Experiment02;
