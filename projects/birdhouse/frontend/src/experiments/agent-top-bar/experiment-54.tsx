// ABOUTME: Agent top bar experiment - Donut Button with Smart Hover
// ABOUTME: Donut turns white on bar hover, back to gradient on button hover (button bg provides contrast)

import Popover from "corvu/popover";
import { MoreVertical } from "lucide-solid";
import { createSignal } from "solid-js";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "54",
  title: "Donut Button with Smart Hover",
  description: "Donut turns white on bar hover, back to gradient on button hover (button bg provides contrast)",
};

// Helper to format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const Experiment54 = () => {
  // Mock state
  const [title] = createSignal("Research Agent");
  const [isWorking, setIsWorking] = createSignal(false);
  const [inputValue, setInputValue] = createSignal("");

  const mockAgent = {
    modelName: "claude-sonnet-4-5",
    tokenUsage: 12500,
    tokenLimit: 200000,
  };

  const mockStats = {
    used: 184200,
    limit: 1000000,
    model: "claude-sonnet-4-5",
    totalInput: 379,
    totalOutput: 77700,
    cacheRead: 12300000,
    cacheWrite: 1500000,
  };

  const percentage = () => (mockStats.used / mockStats.limit) * 100;

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

  // Context Usage Donut Component (inline for experiment)
  const ContextUsageIndicator = () => {
    const pct = percentage();

    return (
      <Popover>
        <Popover.Trigger
          as="button"
          class="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-surface-overlay active:scale-85 md:active:scale-90 cursor-pointer relative z-10 group/donut"
          aria-label="View context usage"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <title>Context usage indicator</title>
            {/* Background ring - white on bar hover, back to muted on button hover */}
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke="var(--theme-text-muted)"
              class="group-hover:stroke-text-on-accent group-hover/donut:stroke-[var(--theme-text-muted)]"
              stroke-width="2"
              opacity="0.3"
            />

            {/* Filled ring - white on bar hover, back to gradient on button hover */}
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke="url(#contextGradient)"
              class="group-hover:!stroke-text-on-accent group-hover/donut:!stroke-[url(#contextGradient)]"
              stroke-width="2"
              stroke-dasharray={`${(pct / 100) * 44} 44`}
              stroke-linecap="round"
              transform="rotate(-90 9 9)"
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="contextGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ "stop-color": "var(--theme-gradient-from)" }} />
                <stop offset="100%" style={{ "stop-color": "var(--theme-gradient-to)" }} />
              </linearGradient>
            </defs>
          </svg>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content class="z-50 w-fit min-w-72 max-w-96 rounded-xl px-4 py-0 border shadow-2xl bg-surface-raised border-border">
            <MarkdownRenderer
              content={`**${formatNumber(mockStats.used)} (${pct.toFixed(1)}%)**

\`${mockStats.model}\` with \`${formatNumber(mockStats.limit)}\` limit

- **${formatNumber(mockStats.totalInput)}** Total Input
- **${formatNumber(mockStats.totalOutput)}** Total Output
- **${formatNumber(mockStats.cacheRead)}** Cache Read
- **${formatNumber(mockStats.cacheWrite)}** Cache Write`}
              class="text-xs"
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover>
    );
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
          class="px-4 py-1 flex items-center gap-3 hover-subtle-gradient brightness-track relative overflow-hidden group rounded-t-lg"
          style={{
            background: "var(--theme-surface-raised)",
            // Inset ring (like input focus ring but inside) when working
            "box-shadow": isWorking() ? "inset 0 0 0 2px var(--theme-accent)" : "none",
            animation: isWorking() ? "ring-pulse 2s ease-in-out infinite" : "none",
            "--bright-x": "-9999px",
            "--bright-y": "-9999px",
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Context Usage Donut Indicator */}
          <ContextUsageIndicator />
          {/* Title with gradient text */}
          <span class="text-sm font-medium bg-gradient-to-r from-gradient-from to-gradient-to bg-clip-text text-transparent group-hover:text-text-on-accent group-hover:bg-none transition-all relative z-10">
            {title()}
          </span>
          {/* Model name turns white on hover */}
          <span class="text-xs text-text-secondary ml-auto mr-2 group-hover:text-text-on-accent transition-colors relative z-10">
            {mockAgent.modelName}
          </span>
          {/* IconButton turns white on hover */}
          <IconButton
            icon={<MoreVertical size={16} />}
            variant="ghost"
            aria-label="Actions menu"
            fixedSize
            class="relative z-10 group-hover:text-text-on-accent"
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
        /* Ring pulse animation */
        @keyframes ring-pulse {
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

        /* Mouse-tracking brightness boost - Clipped by overflow:hidden on parent */
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

export default Experiment54;
