// ABOUTME: Agent top bar experiment - Pulsing Gradient + Mouse Tracking
// ABOUTME: Working state pulses gradient brightness, hover adds cursor-following hotspot overlay

import { MoreVertical } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "19",
  title: "Pulsing Gradient + Mouse Tracking",
  description: "Working state pulses gradient brightness, hover adds cursor-following hotspot overlay",
};

const Experiment19 = () => {
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

  // Mouse tracking for cursor hotspot
  const handleMouseMove = (e: MouseEvent) => {
    if (!topBarRef) return;
    const rect = topBarRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    topBarRef.style.setProperty("--x", `${x}px`);
    topBarRef.style.setProperty("--y", `${y}px`);
  };

  const handleMouseLeave = () => {
    if (!topBarRef) return;
    topBarRef.style.setProperty("--x", `-9999px`);
    topBarRef.style.setProperty("--y", `-9999px`);
  };

  // Add CSS keyframes and styles, attach event listeners
  onMount(() => {
    const styleId = "experiment-19-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes pulse-gradient {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.1); }
        }

        .cursor-hotspot {
          position: relative;
        }

        .cursor-hotspot::before {
          content: '';
          position: absolute;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: radial-gradient(circle closest-side, rgba(255, 255, 255, 0.2), transparent);
          pointer-events: none;
          transform: translate(calc(var(--x, -9999px) - 100px), calc(var(--y, -9999px) - 100px));
          opacity: 0;
          transition: opacity 0.2s ease-out;
          z-index: 1;
        }

        .cursor-hotspot:hover::before {
          opacity: 1;
        }

        .pulse-gradient-active {
          animation: pulse-gradient 2s ease-in-out infinite;
        }
      `;
      document.head.appendChild(style);
    }

    // Attach event listeners programmatically to avoid lint errors
    if (topBarRef) {
      topBarRef.addEventListener("mousemove", handleMouseMove);
      topBarRef.addEventListener("mouseleave", handleMouseLeave);
    }
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
          class={`px-4 py-2 flex items-center gap-3 border-b border-border cursor-hotspot ${
            isWorking()
              ? "bg-gradient-to-r from-gradient-from to-gradient-to pulse-gradient-active"
              : "bg-surface-raised"
          }`}
        >
          <Show when={isWorking()}>
            <span class="w-2 h-2 rounded-full bg-white animate-pulse relative z-10" />
          </Show>
          <span
            class={`text-sm font-medium relative z-10 ${
              isWorking()
                ? "text-text-on-accent"
                : "bg-gradient-to-r from-gradient-from to-gradient-to bg-clip-text text-transparent"
            }`}
          >
            {title()}
          </span>
          <span
            class={`text-xs ml-auto mr-2 relative z-10 ${
              isWorking() ? "text-text-on-accent opacity-90" : "text-text-secondary"
            }`}
          >
            {mockAgent.modelName}
          </span>
          <IconButton
            icon={<MoreVertical size={16} />}
            variant="ghost"
            aria-label="Actions menu"
            fixedSize
            class={`relative z-10 ${isWorking() ? "text-text-on-accent" : ""}`}
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
    </div>
  );
};

export default Experiment19;
