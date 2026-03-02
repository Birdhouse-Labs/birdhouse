// ABOUTME: Agent top bar experiment - Condensed Height + Dual Glow
// ABOUTME: Compact design (py-1) with working glow shadow and cursor-tracking brighter glow overlay

import { MoreVertical } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "21",
  title: "Condensed Height + Dual Glow",
  description: "Compact design (py-1) with working glow shadow and cursor-tracking brighter glow overlay",
};

const Experiment21 = () => {
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
          class="px-4 py-1 flex items-center gap-3 border-b border-border relative dual-glow"
          classList={{
            "working-glow": isWorking(),
          }}
          style={{
            background: isWorking()
              ? "linear-gradient(to right, var(--theme-gradient-from), var(--theme-gradient-to))"
              : "var(--theme-surface-raised)",
            transition: "background 0.3s ease",
          }}
        >
          <Show when={isWorking()}>
            <span class="w-2 h-2 rounded-full bg-accent-bright animate-pulse relative z-10" />
          </Show>
          <span
            class="text-sm font-medium relative z-10"
            classList={{
              "text-text-on-accent": isWorking(),
              "text-text": !isWorking(),
            }}
          >
            {title()}
          </span>
          <span
            class="text-xs ml-auto mr-2 relative z-10"
            classList={{
              "text-text-on-accent opacity-90": isWorking(),
              "text-text-secondary": !isWorking(),
            }}
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

      {/* Styles for dual glow effects */}
      <style>{`
        /* Pulsing glow shadow when working */
        @keyframes glow-pulse {
          0%, 100% { 
            box-shadow: 0 0 10px var(--theme-accent);
          }
          50% { 
            box-shadow: 0 0 20px var(--theme-accent), 0 0 30px var(--theme-accent);
          }
        }

        .working-glow {
          animation: glow-pulse 2s ease-in-out infinite;
        }

        /* Hover brighter glow overlay */
        .dual-glow::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at 50% 50%, 
            rgba(255, 255, 255, 0.15) 0%, 
            transparent 60%
          );
          pointer-events: none;
          opacity: 0;
          z-index: 1;
          transition: opacity 0.3s ease;
        }

        .dual-glow:hover::before {
          opacity: 1;
          animation: glow-shift 3s ease-in-out infinite;
        }

        @keyframes glow-shift {
          0%, 100% { 
            background: radial-gradient(
              circle at 30% 50%, 
              rgba(255, 255, 255, 0.15) 0%, 
              transparent 60%
            );
          }
          50% { 
            background: radial-gradient(
              circle at 70% 50%, 
              rgba(255, 255, 255, 0.15) 0%, 
              transparent 60%
            );
          }
        }
      `}</style>
    </div>
  );
};

export default Experiment21;
