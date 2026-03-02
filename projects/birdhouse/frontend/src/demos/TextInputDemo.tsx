// ABOUTME: Simple textarea component for testing clipboard paste operations
// ABOUTME: Provides large text area for verifying copy functionality on mobile devices

import { type Component, createSignal } from "solid-js";
import { borderColor } from "../styles/containerStyles";

const TextInputDemo: Component = () => {
  const [pastedText, setPastedText] = createSignal("");

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Text Input</h2>
        <p class="text-sm text-text-secondary hidden md:block">Test area for clipboard paste operations</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        <div class="w-full max-w-2xl space-y-4">
          <div class="space-y-2">
            <label for="paste-area" class="block text-sm font-medium text-text-primary">
              Paste Test Area
            </label>
            <textarea
              id="paste-area"
              value={pastedText()}
              onInput={(e) => setPastedText(e.currentTarget.value)}
              placeholder="Paste copied code here to verify it works..."
              class={`w-full h-96 p-4 rounded border font-mono text-sm resize-y bg-surface ${borderColor} text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent`}
              aria-label="Paste test area for verifying clipboard operations"
            />
          </div>

          <div class="flex items-center gap-2 text-sm text-text-secondary">
            <span>Characters: {pastedText().length}</span>
            {pastedText().length > 0 && (
              <button
                type="button"
                onClick={() => setPastedText("")}
                class={`px-2 py-1 text-xs rounded bg-surface-raised hover:bg-surface-overlay border ${borderColor} text-text-primary transition-colors`}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextInputDemo;
