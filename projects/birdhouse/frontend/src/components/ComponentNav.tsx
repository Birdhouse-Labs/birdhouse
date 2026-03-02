// ABOUTME: Component navigation sidebar showing list of available demos
// ABOUTME: Reusable in both desktop resizable panel and mobile drawer

import { type Component, For } from "solid-js";

export interface ComponentItem {
  id: string;
  name: string;
  component: Component;
  description: string;
}

interface ComponentNavProps {
  components: ComponentItem[];
  selectedComponent: string;
  onSelect: (componentId: string) => void;
}

const ComponentNav: Component<ComponentNavProps> = (props) => {
  return (
    <div class="h-full flex flex-col p-4">
      <h2 class="text-2xl font-bold mb-4 bg-gradient-to-r from-gradient-from via-gradient-via to-gradient-to bg-clip-text text-transparent">
        Components
      </h2>
      <nav class="flex-1 overflow-y-auto">
        <ul class="space-y-1">
          <For each={props.components}>
            {(component) => (
              <li>
                <button
                  type="button"
                  onClick={() => props.onSelect(component.id)}
                  class="w-full text-left px-4 py-2 rounded-lg transition-colors duration-200"
                  classList={{
                    "bg-accent/20 text-accent font-semibold": props.selectedComponent === component.id,
                    "hover:bg-surface-overlay text-text-secondary": props.selectedComponent !== component.id,
                  }}
                >
                  {component.name}
                </button>
              </li>
            )}
          </For>
        </ul>
      </nav>
    </div>
  );
};

export default ComponentNav;
