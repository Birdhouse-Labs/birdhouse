// ABOUTME: Accordion demo component showing expandable content sections
// ABOUTME: Demonstrates corvu Accordion with collapsible items

import Accordion from "corvu/accordion";
import { type Component, For } from "solid-js";

const AccordionDemo: Component = () => {
  const items = [
    {
      value: "1",
      title: "What is SolidJS?",
      content:
        "SolidJS is a declarative JavaScript library for building user interfaces. It compiles templates to real DOM and updates them with fine-grained reactions.",
    },
    {
      value: "2",
      title: "What is Corvu?",
      content:
        "Corvu is a collection of unstyled, accessible UI primitives for SolidJS. It provides components like Dialog, Drawer, Accordion, and more.",
    },
    {
      value: "3",
      title: "Why use Tailwind?",
      content:
        "Tailwind CSS is a utility-first CSS framework that lets you build custom designs rapidly without writing traditional CSS.",
    },
  ];

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Accordion</h2>
        <p class="text-sm text-text-secondary hidden md:block">Expandable content sections</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8">
        <div class="w-full max-w-md space-y-2">
          <Accordion collapsible>
            <For each={items}>
              {(item) => (
                <div class="rounded-xl overflow-hidden border bg-surface-raised/30 border-border/50">
                  <Accordion.Item value={item.value}>
                    <Accordion.Trigger class="w-full px-4 py-3 flex justify-between items-center text-left transition-colors hover:bg-surface-overlay/50">
                      <span class="font-medium">{item.title}</span>
                      <svg
                        aria-hidden="true"
                        class="w-5 h-5 transition-transform duration-200 group-data-[expanded]:rotate-180 text-text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </Accordion.Trigger>
                    <Accordion.Content class="overflow-hidden">
                      <p class="px-4 pb-4 text-sm text-text-secondary">{item.content}</p>
                    </Accordion.Content>
                  </Accordion.Item>
                </div>
              )}
            </For>
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default AccordionDemo;
