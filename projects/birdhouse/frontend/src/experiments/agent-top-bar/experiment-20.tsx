// ABOUTME: Agent top bar experiment - Gradient Shift + Shimmer
// ABOUTME: Working animates gradient position, hover adds mouse-tracking shimmer overlay

import { MoreVertical } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "20",
  title: "Gradient Shift + Shimmer",
  description: "Working animates gradient position, hover adds mouse-tracking shimmer overlay",
};

const Experiment20 = () => {
  // Mock state
  const [title] = createSignal("Research Agent");
  const [isWorking, setIsWorking] = createSignal(false);
  const [inputValue, setInputValue] = createSignal("");
  let topBarRef: HTMLDivElement | undefined;

  const mockAgent = {
    modelName: "claude-sonnet-4-5",
    tokenUsage: 12500,
    tokenLimit: 200000,
  };

  // Toggle working state for demo purposes
  const toggleWorking = () => setIsWorking(!isWorking());

  // Mouse tracking for shimmer effect
  const handleMouseMove = (e: MouseEvent) => {
    if (!topBarRef) return;
    const rect = topBarRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    topBarRef.style.setProperty("--mouse-x", `${x}px`);
    topBarRef.style.setProperty("--mouse-y", `${y}px`);
  };

  // Add CSS keyframes for gradient shift animation and attach mouse listener
  onMount(() => {
    // Add styles
    const styleId = "experiment-20-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .shimmer-bar {
          position: relative;
          overflow: hidden;
        }

        .shimmer-bar::after {
          content: '';
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.3), rgba(255,255,255,0.1) 50%, transparent);
          pointer-events: none;
          transform: translate(calc(var(--mouse-x, -9999px) - 75px), calc(var(--mouse-y, -9999px) - 75px));
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 2;
        }

        .shimmer-bar:hover::after {
          opacity: 1;
        }

        .shimmer-bar > * {
          position: relative;
          z-index: 3;
        }
      `;
      document.head.appendChild(style);
    }

    // Attach mouse listener via ref to avoid linter warning
    if (topBarRef) {
      topBarRef.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      if (topBarRef) {
        topBarRef.removeEventListener("mousemove", handleMouseMove);
      }
    };
  });

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
        <div
          ref={topBarRef}
          class="px-4 py-2 flex items-center gap-3 border-b border-border shimmer-bar"
          style={{
            background: isWorking()
              ? "linear-gradient(90deg, var(--theme-gradient-from), var(--theme-gradient-to), var(--theme-gradient-from))"
              : "var(--theme-surface-raised)",
            "background-size": "200% 100%",
            animation: isWorking() ? "gradient-shift 3s ease infinite" : "none",
          }}
        >
          <Show when={isWorking()}>
            <span class="w-2 h-2 rounded-full bg-accent animate-pulse" />
          </Show>
          <span
            class="text-sm font-medium text-text-primary"
            style={{
              color: isWorking() ? "var(--theme-text-on-accent)" : undefined,
            }}
          >
            {title()}
          </span>
          <span
            class="text-xs ml-auto mr-2"
            style={{
              color: isWorking() ? "var(--theme-text-on-accent)" : "var(--theme-text-secondary)",
            }}
          >
            {mockAgent.modelName}
          </span>
          <div
            style={{
              color: isWorking() ? "var(--theme-text-on-accent)" : undefined,
            }}
          >
            <IconButton icon={<MoreVertical size={16} />} variant="ghost" aria-label="Actions menu" fixedSize />
          </div>
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
    </div>
  );
};

export default Experiment20;
