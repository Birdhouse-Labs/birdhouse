// ABOUTME: Agent top bar experiment - Simplified Click Feedback (Show While Held)
// ABOUTME: Working state gradient pulses with white content, click border shows while mouse is down

import Popover from "corvu/popover";
import { MoreVertical } from "lucide-solid";
import { createSignal } from "solid-js";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "58",
  title: "Simplified Click Feedback (Show While Held)",
  description:
    "Working state gradient pulses with white content. Click border shows while mouse is held down. Simple and clean!",
  date: "2025-02-23",
};

// Helper to format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const Experiment58 = () => {
  // Mock state
  const [title] = createSignal("Research Agent");
  const [isWorking, setIsWorking] = createSignal(false);
  const [inputValue, setInputValue] = createSignal("");
  const [contextUsage, setContextUsage] = createSignal(45); // 0-100 percentage
  const [showClickFeedback, setShowClickFeedback] = createSignal(false);

  let topBarRef: HTMLButtonElement | undefined;

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

  // Handle mouse down/up for click feedback
  const handleMouseDown = (_e: MouseEvent) => {
    setShowClickFeedback(true);
  };

  const handleMouseUp = () => {
    setShowClickFeedback(false);
  };

  // Context Usage Donut Component (inline for experiment)
  const ContextUsageIndicator = () => {
    const pct = percentage();

    return (
      <Popover>
        <Popover.Trigger
          as="button"
          class="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-surface-overlay active:scale-85 md:active:scale-90 cursor-pointer relative group/donut"
          aria-label="View context usage"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <title>Context usage indicator</title>
            {/* Background ring - white on bar hover/working, back to muted on button hover */}
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke="var(--theme-text-muted)"
              class="donut-bg-ring group-hover/donut:stroke-[var(--theme-text-muted)]"
              stroke-width="2"
              opacity="0.3"
            />

            {/* Filled ring - white on bar hover/working, back to gradient on button hover */}
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke="url(#contextGradient)"
              class="donut-filled-ring group-hover/donut:!stroke-[url(#contextGradient)]"
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
        <div class="text-sm text-text-secondary">
          💡 Click and hold the top bar to see border feedback (currently: {showClickFeedback() ? "SHOWING" : "hidden"})
        </div>
      </div>

      {/* Experiment Card - Full Agent View Context */}
      <div class="flex flex-col h-[600px] bg-surface-raised rounded-lg overflow-hidden border border-border">
        {/* ============================================
            TOP BAR - THIS IS WHAT YOU'RE DESIGNING
            ============================================ */}
        <button
          ref={topBarRef}
          type="button"
          class="px-4 py-1 flex items-center top-bar-container relative overflow-hidden group rounded-t-lg flex-shrink-0 cursor-pointer w-full text-left"
          style={{
            background: "var(--theme-surface-raised)",
            "box-shadow": showClickFeedback() ? "inset 0 0 0 2px var(--theme-accent)" : "none",
          }}
          classList={{
            "working-gradient-pulse": isWorking(),
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Gradient pulse overlay for working state (z:0) */}
          <div class="gradient-overlay" />

          {/* Content wrapper - creates separate stacking context above border (z:2) */}
          <div class="content-wrapper">
            {/* Context Usage Donut Indicator */}
            <ContextUsageIndicator />

            {/* Title - gradient text normally, white when working/hover */}
            <span
              class="text-sm font-medium bg-gradient-to-r from-gradient-from to-gradient-to bg-clip-text text-transparent transition-all"
              classList={{
                "group-hover:text-text-on-accent group-hover:bg-none": !isWorking(),
                "!text-text-on-accent !bg-none": isWorking(),
              }}
            >
              {title()}
            </span>

            {/* Model name - secondary normally, white when working/hover */}
            <span
              class="text-xs text-text-secondary ml-auto mr-2 transition-colors"
              classList={{
                "group-hover:text-text-on-accent": !isWorking(),
                "!text-text-on-accent": isWorking(),
              }}
            >
              {mockAgent.modelName}
            </span>

            {/* IconButton - white when working/hover */}
            <IconButton
              icon={<MoreVertical size={16} />}
              variant="ghost"
              aria-label="Actions menu"
              fixedSize
              class={isWorking() ? "!text-text-on-accent" : "group-hover:text-text-on-accent"}
            />
          </div>
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
        /* ===== LAYER 0: Gradient Overlay ===== */
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

        /* Working state: Gradient pulses between 50% and 30% opacity */
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

        /* Hover state (non-working): Gradient shows at 50% opacity */
        .top-bar-container:not(.working-gradient-pulse):hover .gradient-overlay {
          opacity: 0.5;
        }

        /* ===== LAYER 1: Click Border (inline style) ===== */
        /* Border applied via inline style box-shadow, same as production */

        /* ===== LAYER 2: Content Wrapper ===== */
        /* Creates separate stacking context BELOW border */
        .content-wrapper {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 0.75rem; /* gap-3 = 3 * 0.25rem */
          width: 100%;
        }

        /* ===== Progress Bar Animation ===== */
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

        /* ===== Donut Indicator White State ===== */
        /* Turn donut white on hover (when not working) */
        .top-bar-container:not(.working-gradient-pulse):hover .donut-bg-ring {
          stroke: var(--theme-text-on-accent);
        }

        .top-bar-container:not(.working-gradient-pulse):hover .donut-filled-ring {
          stroke: var(--theme-text-on-accent) !important;
        }

        /* Turn donut white when working (static, not hover-dependent) */
        .working-gradient-pulse .donut-bg-ring {
          stroke: var(--theme-text-on-accent);
        }

        .working-gradient-pulse .donut-filled-ring {
          stroke: var(--theme-text-on-accent) !important;
        }
      `}</style>

      {/* Design Notes */}
      <div class="bg-surface-raised border border-border rounded-lg p-4 text-sm space-y-2">
        <h3 class="font-medium text-text">Experiment #58 - Design Notes:</h3>
        <ul class="list-disc list-inside space-y-1 text-text-secondary">
          <li>
            <strong>Working State:</strong> Gradient pulses (0.5 → 0.3 → 0.5 opacity) while content stays STATIC white.
            No synchronization needed - content doesn't animate, only gradient does.
          </li>
          <li>
            <strong>Click Feedback:</strong> Border shows while mouse is held down (mousedown/mouseup events). Simple
            opacity transition, no complex animations. Border on ::before pseudo-element (z:1).
          </li>
          <li>
            <strong>Hover State:</strong> Same as production #54 - gradient at 50% opacity, content turns white.
            Disabled during working state via :not(.working-gradient-pulse):hover.
          </li>
          <li>
            <strong>Layer Architecture:</strong> z:0 = gradient, z:1 = border, z:2 = content wrapper. Content wrapper
            uses `display: contents` to be invisible to layout while creating separate stacking context.
          </li>
          <li>
            <strong>State Transitions:</strong> All smooth via CSS transitions. Working/hover mutually exclusive. Click
            border shows/hides with simple opacity transition (0.15s).
          </li>
          <li>
            <strong>Simplifications from earlier attempts:</strong> Removed complex fade animation (was causing stacking
            context issues). Click feedback now uses simple show-while-held pattern with mousedown/mouseup. Much cleaner
            and more predictable!
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Experiment58;
