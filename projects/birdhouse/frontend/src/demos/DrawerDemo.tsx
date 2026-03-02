// ABOUTME: Drawer demo component showing slide-out panel with snap points
// ABOUTME: Demonstrates corvu Drawer with smooth animations and drag interactions

import Drawer from "corvu/drawer";
import { type Component, For } from "solid-js";
import { Button } from "../components/ui";
import { cardSurfaceFlat } from "../styles/containerStyles";

const DrawerDemo: Component = () => {
  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Drawer</h2>
        <p class="text-sm text-text-secondary hidden md:block">Slide-out panels with snap points</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8">
        <Drawer>
          {(props) => (
            <>
              <Drawer.Trigger as={Button} variant="primary">
                Open Drawer
              </Drawer.Trigger>
              <Drawer.Portal>
                <Drawer.Overlay
                  class="fixed inset-0 z-50 data-[transitioning]:transition-colors data-[transitioning]:duration-500 data-[transitioning]:ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{
                    "background-color": `rgb(0 0 0 / ${0.6 * props.openPercentage})`,
                  }}
                />
                <Drawer.Content
                  class={`fixed inset-x-0 bottom-0 z-50 flex h-full max-h-[85vh] flex-col rounded-t-2xl pt-4 border-t data-[transitioning]:transition-transform data-[transitioning]:duration-500 data-[transitioning]:ease-[cubic-bezier(0.32,0.72,0,1)] ${cardSurfaceFlat}`}
                >
                  <div class="mx-auto h-1.5 w-12 rounded-full mb-4 bg-border-muted" />
                  <div class="px-6 pb-6 overflow-auto">
                    <Drawer.Label class="text-2xl font-bold mb-2 text-heading">Drawer Panel</Drawer.Label>
                    <Drawer.Description class="mb-6 text-text-secondary">
                      Drag me up and down! I support snap points and smooth animations.
                    </Drawer.Description>
                    <p class="mb-4 text-text-secondary">
                      Current open percentage:{" "}
                      <span class="font-mono text-accent">{(props.openPercentage * 100).toFixed(0)}%</span>
                    </p>
                    <div class="grid gap-3">
                      <For each={["Settings", "Profile", "Notifications", "Help"]}>
                        {(item) => (
                          <Button variant="tertiary" class="w-full text-left">
                            {item}
                          </Button>
                        )}
                      </For>
                    </div>
                    <Drawer.Close as={Button} variant="primary" class="mt-6 w-full">
                      Close Drawer
                    </Drawer.Close>
                  </div>
                </Drawer.Content>
              </Drawer.Portal>
            </>
          )}
        </Drawer>
      </div>
    </div>
  );
};

export default DrawerDemo;
