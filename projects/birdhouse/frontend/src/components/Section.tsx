// ABOUTME: Section wrapper component for demo sections
// ABOUTME: Provides consistent styling for demo component containers with title and description

import type { Component, JSX } from "solid-js";

const Section: Component<{
  title: string;
  description: string;
  children: JSX.Element;
}> = (props) => {
  return (
    <section class="backdrop-blur-sm rounded-2xl p-6 border transition-colors duration-300 bg-surface-raised/50 border-border/50">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold mb-1 text-heading">{props.title}</h2>
        <p class="text-sm text-text-secondary">{props.description}</p>
      </div>
      <div class="flex flex-wrap gap-4 items-start">{props.children}</div>
    </section>
  );
};

export default Section;
