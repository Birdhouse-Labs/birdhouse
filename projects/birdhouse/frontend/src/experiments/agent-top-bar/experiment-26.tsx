// ABOUTME: Agent top bar experiment - Animated Border + Frosted Glass Hover
// ABOUTME: Compact design (py-1) with rotating gradient border when working and frosted glass gradient hover effect

/* eslint-disable jsx-a11y/no-static-element-interactions */
import { MoreVertical } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "26",
  title: "Animated Border + Frosted Glass Hover",
  description:
    "Compact (py-1) with rotating gradient border when working, frosted glass gradient (30% opacity + blur) on hover",
};

const Experiment26 = () => {
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
  let topBarRef: HTMLDivElement | undefined;

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
          ref={topBarRef}
          class="px-4 py-1 flex items-center gap-3 animated-border frosted-glass brightness-track relative overflow-hidden border-b border-border"
          classList={{
            working: isWorking(),
          }}
          style={{
            "--bright-x": "-9999px",
            "--bright-y": "-9999px",
          }}
          tabIndex={-1}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <Show when={isWorking()}>
            <span class="w-2 h-2 rounded-full bg-accent animate-pulse relative z-10" />
          </Show>
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

      {/* CSS Animations & Effects */}
      <style>{`
        /* Animated Gradient Border (Working State) */
        @keyframes rotate-border {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .animated-border {
          position: relative;
          background: var(--theme-surface-raised);
        }

        .animated-border::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          padding: 2px;
          background: conic-gradient(
            from 0deg,
            var(--theme-gradient-from),
            var(--theme-gradient-to),
            var(--theme-gradient-from)
          );
          -webkit-mask: 
            linear-gradient(#fff 0 0) content-box, 
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: rotate-border 3s linear infinite;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: 0;
        }

        .animated-border.working::before {
          opacity: 1;
        }

        /* Frosted Glass Effect (Hover State) */
        .frosted-glass::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right, 
            var(--theme-gradient-from), 
            var(--theme-gradient-to)
          );
          opacity: 0;
          backdrop-filter: blur(0px);
          transition: opacity 0.3s ease, backdrop-filter 0.3s ease;
          pointer-events: none;
          border-radius: inherit;
          z-index: 0;
        }

        .frosted-glass:hover::after {
          opacity: 0.3;
          backdrop-filter: blur(4px);
        }

        .frosted-glass > * {
          position: relative;
          z-index: 1;
        }

        /* Mouse Tracking Brightness Boost */
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
          transition: opacity 0.2s ease;
          z-index: 2;
        }
        
        .brightness-track:hover::before {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default Experiment26;
