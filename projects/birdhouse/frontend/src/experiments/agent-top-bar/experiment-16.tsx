// ABOUTME: Agent top bar experiment - Gradient Underline
// ABOUTME: Simple gradient border-bottom accent for clean, minimal header

import { MoreVertical } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { Button, IconButton } from "../../components/ui";
import AutoGrowTextarea from "../../components/ui/AutoGrowTextarea";

export const metadata = {
  id: "16",
  title: "Gradient Underline",
  description: "Simple gradient border-bottom accent for clean, minimal header",
};

const Experiment16 = () => {
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
          class="px-4 py-2 flex items-center gap-3 bg-surface-raised"
          style={{
            "border-bottom": "3px solid transparent",
            "border-image": "linear-gradient(to right, var(--theme-gradient-from), var(--theme-gradient-to)) 1",
          }}
        >
          <Show when={isWorking()}>
            <span class="w-2 h-2 rounded-full bg-accent animate-pulse" />
          </Show>
          <span class="text-sm font-medium text-text-primary">{title()}</span>
          <span class="text-xs text-text-secondary ml-auto mr-2">{mockAgent.modelName}</span>
          <IconButton icon={<MoreVertical size={16} />} variant="ghost" aria-label="Actions menu" fixedSize />
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

export default Experiment16;
