// ABOUTME: Agent top bar experiment - Fixed Click Border Fade (Border Only)
// ABOUTME: Click feedback now only fades the border, not the content - uses pseudo-element approach

import Popover from "corvu/popover";
import { MoreVertical } from "lucide-solid";
import { createSignal } from "solid-js";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "57",
  title: "Fixed Click Border Fade (Border Only)",
  description: "Fixed click feedback to only fade the border element, not the entire UI. Content stays fully visible.",
};

// Helper to format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const Experiment57 = () => {
  // Mock state
  const [title] = createSignal("Research Agent");
  const [isWorking, setIsWorking] = createSignal(false);
  const [inputValue, setInputValue] = createSignal("");
  const [contextUsage, setContextUsage] = createSignal(45); // 0-100 percentage
  const [showClickFeedback, setShowClickFeedback] = createSignal(false);

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

  // Handle top bar click - show border feedback for 5s
  const handleTopBarClick = () => {
    setShowClickFeedback(true);
    setTimeout(() => setShowClickFeedback(false), 5000);
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
        <Button variant="secondary" onClick={handleTopBarClick}>
          Trigger Click Feedback
        </Button>
      </div>

      {/* Experiment Card - Full Agent View Context */}
      <div class="flex flex-col h-[600px] bg-surface-raised rounded-lg overflow-hidden border border-border">
        {/* ============================================
            TOP BAR - THIS IS WHAT YOU'RE DESIGNING
            ============================================ */}
        <button
          type="button"
          class="px-4 py-1 flex items-center gap-3 top-bar-container relative overflow-hidden group rounded-t-lg flex-shrink-0 cursor-pointer w-full text-left"
          style={{
            background: "var(--theme-surface-raised)",
          }}
          classList={{
            "working-gradient-pulse": isWorking(),
            "click-border-fade": showClickFeedback(),
            "working-hover-state": isWorking(),
          }}
          onClick={handleTopBarClick}
        >
          {/* Gradient pulse overlay for working state */}
          <div class="gradient-overlay" />

          {/* Context Usage Donut Indicator */}
          <ContextUsageIndicator />
          {/* Title with gradient text - switches to white on hover/working */}
          <span
            class="text-sm font-medium bg-gradient-to-r from-gradient-from to-gradient-to bg-clip-text text-transparent transition-all relative z-10"
            classList={{
              "group-hover:text-text-on-accent group-hover:bg-none": !isWorking(),
              "text-text-on-accent bg-none": isWorking(),
            }}
          >
            {title()}
          </span>
          {/* Model name - turns white on hover/working */}
          <span
            class="text-xs text-text-secondary ml-auto mr-2 transition-colors relative z-10"
            classList={{
              "group-hover:text-text-on-accent": !isWorking(),
              "text-text-on-accent": isWorking(),
            }}
          >
            {mockAgent.modelName}
          </span>
          {/* IconButton - turns white on hover/working */}
          <IconButton
            icon={<MoreVertical size={16} />}
            variant="ghost"
            aria-label="Actions menu"
            fixedSize
            class={isWorking() ? "relative z-10 text-text-on-accent" : "relative z-10 group-hover:text-text-on-accent"}
          />
        </button>

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
        /* Gradient overlay container */
        .gradient-overlay {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right, 
            var(--theme-gradient-from), 
            var(--theme-gradient-to)
          );
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
          border-radius: inherit;
          z-index: 0;
        }

        /* Gradient pulse animation for working state */
        /* Pulses the gradient between 50% opacity (hover state) and 30% opacity */
        /* Content styling is always in hover state when working (via classList) */
        @keyframes gradient-pulse {
          0%, 100% { 
            opacity: 0.5;
          }
          50% { 
            opacity: 0.3;
          }
        }

        .working-gradient-pulse .gradient-overlay {
          animation: gradient-pulse 2s ease-in-out infinite;
          opacity: 0.5;
        }

        /* Click feedback border fade - FIXED: Only fades the border pseudo-element */
        /* Create a pseudo-element that holds the border */
        .top-bar-container::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow: inset 0 0 0 2px var(--theme-accent);
          opacity: 0;
          pointer-events: none;
          z-index: 5; /* Above gradient overlay but below content */
        }

        @keyframes border-fade-out {
          0% { 
            opacity: 1;
          }
          100% { 
            opacity: 0;
          }
        }

        /* When click feedback is active, animate ONLY the pseudo-element's opacity */
        .click-border-fade::before {
          animation: border-fade-out 5s ease-in forwards;
          opacity: 1;
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

        /* Minimal hover effect - just slightly brighten the gradient text */
        .top-bar-container:not(.working-gradient-pulse):hover .gradient-overlay {
          opacity: 0.15;
        }

        /* Ensure content is above the gradient overlay and border */
        .top-bar-container > *:not(.gradient-overlay) {
          position: relative;
          z-index: 10;
        }
      `}</style>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>Working State (FIXED):</strong> Gradient pulses between 50% and 30% opacity while ALL content uses
            hover state styling (title/model/icon turn white, matching production hover behavior). The gradient pulse
            and hover styling are now properly synchronized.
          </li>
          <li>
            <strong>Click Feedback (FIXED):</strong> Border implemented as ::before pseudo-element that fades from
            opacity 1 to 0 over 5 seconds. Content elements now use classList to maintain full opacity. No interference
            with text transparency or other content styles.
          </li>
          <li>
            <strong>Hover State:</strong> When not working, minimal gradient overlay (15% opacity) with content
            transitioning to white text via group-hover classes (matching production).
          </li>
          <li>
            <strong>Visual Hierarchy:</strong> Working state is most prominent (pulsing gradient + white content), click
            feedback is clear but temporary (fading border only), hover is subtle (slight gradient + white text).
          </li>
          <li>
            <strong>Implementation Details:</strong> Click border uses ::before pseudo-element (z:5) with opacity
            animation. Working state uses classList to force hover styling on content while gradient pulses. Z-index
            layering: gradient overlay (z:0) → border (z:5) → content (z:10).
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Experiment57;
