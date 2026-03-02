// ABOUTME: Mobile navigation drawer sliding from left
// ABOUTME: Accepts custom children or falls back to ComponentNav

import Drawer from "corvu/drawer";
import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
import type { ComponentItem } from "./ComponentNav";
import ComponentNav from "./ComponentNav";

interface MobileNavDrawerProps {
  components?: ComponentItem[];
  selectedComponent?: string;
  onSelect?: (componentId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: JSX.Element;
  children?: JSX.Element;
  zIndex?: number;
}

const MobileNavDrawer: Component<MobileNavDrawerProps> = (props) => {
  const handleSelect = (componentId: string) => {
    props.onSelect?.(componentId);
    // Close drawer after selection
    props.onOpenChange(false);
  };

  // Default z-index values (can be overridden)
  const overlayZ = props.zIndex ? props.zIndex - 10 : 40;
  const contentZ = props.zIndex ?? 50;

  return (
    <Drawer side="left" open={props.open} onOpenChange={props.onOpenChange} breakPoints={[0.75]}>
      {(drawerProps) => (
        <>
          {props.trigger}
          <Drawer.Portal>
            <Drawer.Overlay
              class="fixed inset-0 data-[transitioning]:transition-colors data-[transitioning]:duration-300 data-[transitioning]:ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{
                "background-color": `rgb(0 0 0 / ${0.5 * drawerProps.openPercentage})`,
                "z-index": overlayZ,
              }}
            />
            <Drawer.Content
              class="fixed inset-y-0 left-0 flex w-full max-w-[85vw] flex-col border-r data-[transitioning]:transition-transform data-[transitioning]:duration-300 data-[transitioning]:ease-[cubic-bezier(0.32,0.72,0,1)] bg-surface-raised border-border"
              style={{
                "padding-top": "var(--safe-top)",
                "padding-bottom": "var(--safe-bottom)",
                "padding-left": "var(--safe-left)",
                "z-index": contentZ,
              }}
            >
              <Show
                when={props.children}
                fallback={
                  <ComponentNav
                    components={props.components ?? []}
                    selectedComponent={props.selectedComponent ?? ""}
                    onSelect={handleSelect}
                  />
                }
              >
                {props.children}
              </Show>
            </Drawer.Content>
          </Drawer.Portal>
        </>
      )}
    </Drawer>
  );
};

export default MobileNavDrawer;
