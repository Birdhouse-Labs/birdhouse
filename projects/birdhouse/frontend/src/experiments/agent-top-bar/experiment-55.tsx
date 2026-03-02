// ABOUTME: Agent top bar experiment - Pulsing Working State + Context Progress Bar
// ABOUTME: Working state uses pulse animation without hover gradient, divider shows context usage as progress bar

import Popover from "corvu/popover";
import { MoreVertical } from "lucide-solid";
import { createSignal } from "solid-js";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "55",
  title: "Pulsing Working State + Context Progress Bar",
  description: "Working state uses pulse animation (no hover gradient). Divider shows context usage as progress bar.",
};

// Helper to format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const Experiment55 = () => {
  // Mock state
  const [title] = createSignal("Research Agent");
  const [isWorking, setIsWorking] = createSignal(false);
  const [inputValue, setInputValue] = createSignal("");
  const [contextUsage, setContextUsage] = createSignal(45); // 0-100 percentage

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

  const percentage = () => contextUsage();

  // Toggle working state for demo purposes
  const toggleWorking = () => setIsWorking(!isWorking());

  // Cycle through different context usage levels
  const cycleContextUsage = () => {
    const current = contextUsage();
    if (current < 30) setContextUsage(50);
    else if (current < 60) setContextUsage(85);
    else if (current < 90) setContextUsage(98);
    else setContextUsage(15);
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
      <div class="flex gap-2 flex-wrap">
        <Button variant="secondary" onClick={toggleWorking}>
          Toggle Working State (Currently: {isWorking() ? "Working" : "Idle"})
        </Button>
        <Button variant="secondary" onClick={cycleContextUsage}>
          Cycle Context Usage (Currently: {contextUsage()}%)
        </Button>
      </div>

      {/* Experiment Card - Full Agent View Context */}
      <div class="flex flex-col h-[600px] bg-surface-raised rounded-lg overflow-hidden border border-border">
        {/* ============================================
            TOP BAR - THIS IS WHAT YOU'RE DESIGNING
            ============================================ */}
        <div
          class="px-4 py-1 flex items-center gap-3 hover-subtle-gradient relative overflow-hidden group rounded-t-lg flex-shrink-0"
          style={{
            background: "var(--theme-surface-raised)",
          }}
          classList={{
            "working-pulse": isWorking(),
          }}
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

        {/* Context Usage Progress Bar Divider */}
        <div class="relative h-[2px] bg-border flex-shrink-0">
          <div
            class="absolute inset-y-0 left-0 bg-gradient-to-r from-gradient-from to-gradient-to transition-all duration-300 ease-out"
            style={{
              width: `${percentage()}%`,
            }}
            classList={{
              "progress-pulse": isWorking(),
            }}
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
        /* Pulsing working state animation - applies to entire bar */
        @keyframes working-pulse {
          0%, 100% { 
            box-shadow: inset 0 0 0 2px var(--theme-accent);
            opacity: 1;
          }
          50% { 
            box-shadow: inset 0 0 0 2px var(--theme-accent);
            opacity: 0.7;
          }
        }

        .working-pulse {
          animation: working-pulse 2s ease-in-out infinite;
          box-shadow: inset 0 0 0 2px var(--theme-accent);
        }

        /* Progress bar pulse animation when working */
        @keyframes progress-pulse {
          0%, 100% { 
            opacity: 1;
          }
          50% { 
            opacity: 0.6;
          }
        }

        .progress-pulse {
          animation: progress-pulse 2s ease-in-out infinite;
        }

        /* Subtle gradient hover background (50% opacity) - ONLY on hover, NOT when working */
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

        .hover-subtle-gradient:not(.working-pulse):hover::after {
          opacity: 0.5;
        }

        .hover-subtle-gradient > * {
          position: relative;
          z-index: 1;
        }

        /* Color coding for context usage levels */
        .context-progress-bar {
          transition: background 0.3s ease;
        }

        /* High usage warning color (optional enhancement) */
        @keyframes warning-pulse {
          0%, 100% { 
            filter: brightness(1);
          }
          50% { 
            filter: brightness(1.2);
          }
        }
      `}</style>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>Working State:</strong> Uses pulsing opacity animation on the inset ring shadow. No hover gradient
            when working to avoid confusion with selected/active state.
          </li>
          <li>
            <strong>Context Progress Bar:</strong> The divider doubles as a progress indicator showing context usage
            percentage with the gradient colors. Also pulses when working.
          </li>
          <li>
            <strong>Visual Distinction:</strong> Working state (pulsing ring + pulsing progress) is clearly different
            from hover state (gradient overlay).
          </li>
          <li>
            <strong>Optional Enhancement:</strong> Could add color coding for high usage (e.g., orange/red when
            &gt;80%).
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Experiment55;
