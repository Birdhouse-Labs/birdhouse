// ABOUTME: Agent top bar experiment - Fixed Border Within Padding (Gemini)
// ABOUTME: Compact (py-1) with inset gradient border (no height change), clipped hover effects

import { MoreVertical } from "lucide-solid";
import { createSignal } from "solid-js";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "32",
  title: "Fixed Border Within Padding (Gemini)",
  description: "Compact (py-1) with inset gradient border (no height change), clipped hover effects",
};

const Experiment32 = () => {
  // Mock state
  const [title] = createSignal("Research Agent");
  const [isWorking, setIsWorking] = createSignal(false);
  const [inputValue, setInputValue] = createSignal("");

  const mockAgent = {
    modelName: "claude-sonnet-4-5",
    tokenUsage: 12500,
    tokenLimit: 200000,
  };

  // Toggle working state for demo purposes
  const toggleWorking = () => setIsWorking(!isWorking());

  // Mouse tracking for brightness boost
  const handleMouseMove = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    target.style.setProperty("--bright-x", `${x}px`);
    target.style.setProperty("--bright-y", `${y}px`);
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    target.style.setProperty("--bright-x", `-9999px`);
    target.style.setProperty("--bright-y", `-9999px`);
  };

  return (
    <div class="space-y-4">
      {/* Demo Controls */}
      <div class="flex gap-2">
        <Button variant="secondary" onClick={toggleWorking}>
          Toggle Working State (Currently: {isWorking() ? "Working" : "Idle"})
        </Button>
      </div>

      {/* Experiment Card - Full Agent View Context */}
      <div class="flex flex-col h-[600px] bg-surface-raised rounded-lg overflow-hidden border border-border">
        {/* ============================================
            TOP BAR - THIS IS WHAT YOU'RE DESIGNING
            ============================================ */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: Mouse tracking requires div for proper event handling */}
        <div
          class="px-4 py-1 flex items-center gap-3 hover-subtle-gradient brightness-track relative overflow-hidden"
          style={{
            background: "var(--theme-surface-raised)",
            "box-shadow": isWorking()
              ? "inset 0 3px 0 var(--theme-gradient-from), inset 0 -3px 0 var(--theme-gradient-to)"
              : "inset 0 -1px 0 var(--theme-border)",
            animation: isWorking() ? "border-pulse 2s ease-in-out infinite" : "none",
            "--bright-x": "-9999px",
            "--bright-y": "-9999px",
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <span class="text-sm font-medium text-text relative z-10">{title()}</span>
          <span class="text-xs text-text-secondary ml-auto mr-2 relative z-10">{mockAgent.modelName}</span>
          <IconButton
            icon={<MoreVertical size={16} />}
            variant="ghost"
            aria-label="Actions menu"
            fixedSize
            class="relative z-10"
          />
        </div>

        {/* Reply Box (from ChatContainer pattern) */}
        <div class="px-4 py-3 border-b bg-surface-overlay border-border flex-shrink-0">
          <div class="flex items-end gap-3">
            <AutoGrowTextarea
              value={inputValue()}
              onInput={setInputValue}
              onSend={() => {}}
              disabled={false}
              placeholder="Type a message..."
            />
            <button
              type="button"
              class="rounded-lg px-4 py-2 font-medium bg-gradient-to-r from-gradient-from to-gradient-to text-text-on-accent hover:opacity-90 text-sm"
            >
              Send
            </button>
          </div>
        </div>

        {/* Messages Area (simplified placeholder) */}
        <div class="flex-1 p-4 overflow-y-auto bg-surface">
          <div class="text-sm text-text-muted text-center py-8">Messages would appear here (newest at top)</div>
        </div>
      </div>

      {/* CSS Animations and Effects */}
      <style>{`
        /* Border pulse animation */
        @keyframes border-pulse {
          0%, 100% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(1.3);
          }
        }

        /* Subtle gradient hover background (50% opacity) */
        .hover-subtle-gradient::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right,
            var(--theme-gradient-from),
            var(--theme-gradient-to)
          );
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
          border-radius: inherit;
          z-index: 0;
        }

        .hover-subtle-gradient:hover::after {
          opacity: 0.5;
        }

        .hover-subtle-gradient > * {
          position: relative;
          z-index: 1;
        }

        /* Mouse-tracking brightness boost */
        .brightness-track::before {
          content: '';
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.3), transparent 70%);
          pointer-events: none;
          transform: translate(calc(var(--bright-x, -9999px) - 60px), calc(var(--bright-y, -9999px) - 60px));
          opacity: 0;
          mix-blend-mode: overlay;
          z-index: 2;
        }

        .brightness-track:hover::before {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default Experiment32;
