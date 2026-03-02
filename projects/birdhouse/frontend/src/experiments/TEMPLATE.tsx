// ABOUTME: [Exploration] experiment - [Short description]
// ABOUTME: [More detailed description of what this approach does]

import type { Component } from "solid-js";
import { createSignal } from "solid-js";
// Import any components you need from the UI library:
// import { Button, IconButton } from "../../components/ui";

export const metadata = {
  id: "XX", // Replace with your experiment number (e.g., "01", "02")
  title: "Descriptive Title",
  description: "What makes this approach unique - explain key design decisions",
  date: "YYYY-MM-DD", // Today's date in ISO format for proper sorting
};

const ExperimentXX: Component = () => {
  // Add your experiment state and logic here
  const [exampleState, setExampleState] = createSignal(false);

  return (
    <div class="space-y-4">
      {/* Demo Controls (optional but recommended) */}
      <div class="flex gap-2">
        <button
          type="button"
          onClick={() => setExampleState(!exampleState())}
          class="px-3 py-1 text-sm bg-surface-raised rounded hover:bg-surface-overlay"
        >
          Toggle State: {exampleState() ? "On" : "Off"}
        </button>
      </div>

      {/* Your Experiment UI */}
      <div class="p-6 bg-surface-raised rounded-lg">
        <p class="text-text-secondary">Your experiment content goes here</p>
      </div>
    </div>
  );
};

export default ExperimentXX;
