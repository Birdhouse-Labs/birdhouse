# Experiments System

This directory contains UI/UX experiments organized into **explorations** — focused design investigations for specific components or patterns.

## Overview

Experiments allow rapid parallel iteration on UI designs. Each **exploration** is a category containing multiple **experiments** — individual design variations that can be viewed and compared in the Playground.

### Current Explorations

- **Header Title** (`header-title/`) - App header branding approaches
- **Agent Top Bar** (`agent-top-bar/`) - Agent card header designs  
- **Primary Buttons** (`primary-buttons/`) - Button styling variations

## Viewing Experiments

1. Navigate to Playground: `http://localhost:50100/#/playground/experiments`
2. Select an exploration from the dropdown
3. View all experiments for that exploration (sorted newest first)

## Creating a New Exploration

When starting a new design investigation (e.g., "Pattern Library UI"), follow these steps:

### 1. Create the Exploration Directory

```bash
mkdir src/experiments/pattern-library-ui
```

**Naming convention:** Use kebab-case matching the design focus area.

### 2. Add to Generation Script

Edit `scripts/generate-experiments.js` and add your exploration to the categories array:

```javascript
const experimentCategories = [
  "primary-buttons",
  "agent-top-bar", 
  "header-title",
  "pattern-library-ui",  // ← Add your exploration
];
```

### 3. Create Your First Experiment

Create `src/experiments/pattern-library-ui/experiment-01.tsx`:

```typescript
// ABOUTME: Pattern Library UI experiment - [Short description]
// ABOUTME: [More detailed description of what this approach does]

import type { Component } from "solid-js";
import { createSignal } from "solid-js";

export const metadata = {
  id: "01",
  title: "Descriptive Title",
  description: "What makes this approach unique",
  date: "2025-02-23",  // YYYY-MM-DD format - for sorting
};

const Experiment01: Component = () => {
  // Your experiment code here
  return (
    <div class="space-y-4">
      <p class="text-text-secondary">Your UI experiment</p>
    </div>
  );
};

export default Experiment01;
```

**Key points:**
- Metadata `id` must match the filename number
- `date` field controls sort order (newest experiments appear first)
- Export both `metadata` and a default component

### 4. Add to ExperimentsDemo Display

Edit `src/demos/ExperimentsDemo.tsx` and add your exploration to the `explorations` array:

```typescript
const explorations: Exploration[] = [
  // ... existing explorations
  {
    id: "pattern-library-ui",
    name: "Pattern Library UI",
    description: "Install/browse UI designs for the pattern library feature",
    experiments: patternLibraryUiExperiments,  // Imported from generated index
  },
];
```

Don't forget to import the experiments array at the top:

```typescript
let patternLibraryUiExperiments: Array<{
  id: string;
  component: Component;
  metadata: { id: string; title: string; description?: string; date?: string };
}> = [];

try {
  const experimentsModule = await import("../experiments");
  // ... existing imports
  patternLibraryUiExperiments = experimentsModule.patternLibraryUiExperiments || [];
} catch {
  // No experiments yet
}
```

### 5. Regenerate the Index

```bash
npm run generate:experiments
```

This scans all experiment files and generates `src/experiments/index.ts` with proper imports and exports.

### 6. View Your Exploration

Navigate to the Playground experiments page and select your new exploration from the dropdown!

## Adding More Experiments to an Exploration

Simply create new files with incremented numbers:

```bash
src/experiments/pattern-library-ui/experiment-02.tsx
src/experiments/pattern-library-ui/experiment-03.tsx
```

Then regenerate:

```bash
npm run generate:experiments
```

Experiments are automatically sorted by date (if provided), then by ID number.

## Parallel Workflow with Agents

The experiments system is designed for parallel agent workflows:

1. **Manager agent** defines the exploration and requirements
2. **Child agents** each create individual experiments in parallel
3. Each agent creates `experiment-XX.tsx` with unique ID
4. Regenerate index to see all experiments
5. Review and compare approaches side-by-side

**Example workflow:**
```
Manager: "We need to explore pattern library install UI. Create 5 variations."
Child Agent 1: Creates experiment-01.tsx (modal approach)
Child Agent 2: Creates experiment-02.tsx (slide-over approach)  
Child Agent 3: Creates experiment-03.tsx (inline approach)
Child Agent 4: Creates experiment-04.tsx (split-view approach)
Child Agent 5: Creates experiment-05.tsx (wizard approach)
Manager: Reviews all 5 in Playground, picks best or requests refinements
```

## Experiment Numbering

- Use sequential numbers starting from 01
- Don't reuse numbers (even if you delete an experiment)
- Find the highest number and increment:
  ```bash
  ls src/experiments/pattern-library-ui/ | sort -V | tail -1
  # If you see experiment-15.tsx, create experiment-16.tsx
  ```

## Best Practices

1. **Add dates** - Helps track recent work and ensures proper sorting
2. **Descriptive titles** - Make it easy to distinguish experiments
3. **Include context** - Add demo controls, sample data, realistic scenarios
4. **Document assumptions** - Use description field to explain tradeoffs
5. **Keep experiments small** - Focus on one approach per experiment
6. **Reuse components** - Import from `src/components/ui` when possible

## File Structure

```
src/experiments/
├── README.md (this file)
├── index.ts (GENERATED - do not edit manually)
├── agent-top-bar/
│   ├── experiment-01.tsx
│   ├── experiment-02.tsx
│   └── ...
├── header-title/
│   └── ...
└── pattern-library-ui/
    └── ...
```

## Troubleshooting

**Experiments not appearing?**
- Did you run `npm run generate:experiments`?
- Is your exploration added to `experimentCategories` in the generation script?
- Is your exploration added to the `explorations` array in `ExperimentsDemo.tsx`?

**Wrong sort order?**
- Add `date` field to metadata in YYYY-MM-DD format
- Regenerate experiments index
- Experiments without dates fall back to ID sorting

**Build errors?**
- Check that metadata export matches the pattern exactly
- Ensure default export is a valid SolidJS component
- Run `npm run build` to see detailed error messages
