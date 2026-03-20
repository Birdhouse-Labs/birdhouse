// ABOUTME: Main application component showcasing corvu UI primitives
// ABOUTME: Split-view layout with resizable sidebar and component demo viewer

import Resizable from "corvu/resizable";
import { type Component, createEffect, createMemo, createSignal, Show } from "solid-js";
import ComponentNav from "./components/ComponentNav";
import MobileNavDrawer from "./components/MobileNavDrawer";
import {
  AccordionDemo,
  AgentCellStatesDemo,
  ButtonStylesDemo,
  CheckboxDemo,
  CodeBlockDemo,
  ComboboxDemo,
  ConnectionStatusBannerDemo,
  DialogDemo,
  DiffViewerDemo,
  DisclosureDemo,
  DrawerDemo,
  ExperimentsDemo,
  MarkdownDemo,
  MessagesDemo,
  PopoverDemo,
  ResizableDemo,
  TextInputDemo,
  TooltipDemo,
  TreeViewDemo,
} from "./demos";
import { usePageTitle } from "./lib/page-title";
import { usePlaygroundComponent, useSetPlaygroundComponent } from "./lib/routing";
import { createMediaQuery } from "./theme/createMediaQuery";

// Component registry
interface ComponentItem {
  id: string;
  name: string;
  component: Component;
  description: string;
  fullScreen?: boolean;
}

const components: ComponentItem[] = [
  {
    id: "experiments",
    name: "Experiments",
    component: ExperimentsDemo,
    description: "Creative explorations of UI patterns and styling",
  },
  {
    id: "buttons",
    name: "Button Styles",
    component: ButtonStylesDemo,
    description: "Comprehensive button variations and states",
  },
  {
    id: "checkbox",
    name: "Checkbox",
    component: CheckboxDemo,
    description: "Simple checkbox with keyboard support and theme integration",
  },
  {
    id: "combobox",
    name: "Combobox",
    component: ComboboxDemo,
    description: "Searchable dropdowns with typeahead and live preview",
  },
  {
    id: "dialog",
    name: "Dialog",
    component: DialogDemo,
    description: "Modal dialogs with focus management",
  },
  {
    id: "drawer",
    name: "Drawer",
    component: DrawerDemo,
    description: "Slide-out panels with snap points",
  },
  {
    id: "accordion",
    name: "Accordion",
    component: AccordionDemo,
    description: "Expandable content sections",
  },
  {
    id: "tooltip",
    name: "Tooltip",
    component: TooltipDemo,
    description: "Contextual information on hover",
  },
  {
    id: "popover",
    name: "Popover",
    component: PopoverDemo,
    description: "Floating content panels",
  },
  {
    id: "resizable",
    name: "Resizable",
    component: ResizableDemo,
    description: "Draggable panel layouts with nested splits",
  },
  {
    id: "disclosure",
    name: "Disclosure",
    component: DisclosureDemo,
    description: "Show/hide content toggle",
  },
  {
    id: "treeview",
    name: "Animated Tree View",
    component: TreeViewDemo,
    description: "Collapsible tree with FLIP animations on reorder",
  },
  {
    id: "agent-cell-states",
    name: "Agent Cell States",
    component: AgentCellStatesDemo,
    description: "Visual comparison of all agent cell states for design review",
  },
  {
    id: "connection-status-banner",
    name: "Connection Status Banner",
    component: ConnectionStatusBannerDemo,
    description: "Test connection banner in all states and themes",
  },
  {
    id: "markdown",
    name: "Markdown",
    component: MarkdownDemo,
    description: "Typography and markdown rendering samples",
  },
  {
    id: "messages",
    name: "Messages",
    component: MessagesDemo,
    description: "Chat messages with markdown content",
    fullScreen: true,
  },
  {
    id: "codeblock",
    name: "Code Blocks",
    component: CodeBlockDemo,
    description: "Premium syntax highlighting with live preview",
  },
  {
    id: "diffviewer",
    name: "Diff Viewer",
    component: DiffViewerDemo,
    description: "Visual diffs with syntax highlighting and theme support",
  },
  {
    id: "textinput",
    name: "Text Input",
    component: TextInputDemo,
    description: "Test area for clipboard paste operations",
  },
];

interface PlaygroundProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Playground: Component<PlaygroundProps> = (props) => {
  // Get component from route params, default to buttons
  const routeComponent = usePlaygroundComponent();
  const setPlaygroundComponent = useSetPlaygroundComponent();

  const getValidComponent = (component: string | undefined): string => {
    return component && components.find((c) => c.id === component) ? component : "experiments";
  };

  const [selectedComponent, setSelectedComponent] = createSignal(getValidComponent(routeComponent()));

  // Responsive breakpoint: use drawer on screens < 768px (md breakpoint)
  const isDesktop = createMediaQuery("(min-width: 768px)");

  // Sync internal state with route changes (browser back/forward)
  createEffect(() => {
    const component = routeComponent();
    const validComponent = getValidComponent(component);
    if (validComponent !== selectedComponent()) {
      setSelectedComponent(validComponent);
    }
  });

  const selectedComponentName = createMemo(() => {
    const item = components.find((c) => c.id === selectedComponent());
    return item?.name ?? selectedComponent();
  });

  usePageTitle(() => `${selectedComponentName()} - Playground - Birdhouse`);

  // Handle component selection - navigate to new route
  const handleSelectComponent = (id: string) => {
    setSelectedComponent(id);
    setPlaygroundComponent(id);
  };

  const getSelectedComponent = () => {
    return components.find((c) => c.id === selectedComponent());
  };

  const isFullScreen = () => {
    const component = getSelectedComponent();
    return component?.fullScreen === true;
  };

  return (
    <div class="h-full overflow-hidden p-2">
      <Show
        when={isDesktop()}
        fallback={
          <>
            {/* Mobile: Drawer + Content */}
            <MobileNavDrawer
              components={components}
              selectedComponent={selectedComponent()}
              onSelect={handleSelectComponent}
              open={props.sidebarOpen}
              onOpenChange={props.setSidebarOpen}
              trigger={null}
            />
            <Show when={getSelectedComponent()} keyed>
              {(selected) => (
                <div class="h-full bg-surface rounded-lg overflow-hidden">
                  <selected.component />
                </div>
              )}
            </Show>
          </>
        }
      >
        {/* Desktop: Resizable Split View or Full Width */}
        <Show
          when={props.sidebarOpen}
          fallback={
            /* Full width when sidebar closed */
            <div
              class="h-full bg-surface rounded-lg"
              classList={{
                "overflow-y-auto": !isFullScreen(),
                "overflow-hidden": isFullScreen(),
              }}
            >
              <Show when={getSelectedComponent()} keyed>
                {(selected) => (
                  <div class="h-full">
                    <selected.component />
                  </div>
                )}
              </Show>
            </div>
          }
        >
          <Resizable class="h-full" orientation="horizontal">
            {() => (
              <>
                {/* Left Sidebar */}
                <Resizable.Panel
                  initialSize={0.2}
                  minSize={0.15}
                  class="h-full bg-surface-raised rounded-lg overflow-hidden"
                >
                  <ComponentNav
                    components={components}
                    selectedComponent={selectedComponent()}
                    onSelect={handleSelectComponent}
                  />
                </Resizable.Panel>

                {/* Resizable Handle */}
                <Resizable.Handle
                  aria-label="Resize sidebar"
                  class="w-4 cursor-col-resize flex items-center justify-center group"
                >
                  <div class="w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                </Resizable.Handle>

                {/* Right Panel - Selected Component */}
                <Resizable.Panel
                  initialSize={0.8}
                  minSize={0.5}
                  class="h-full bg-surface rounded-lg"
                  classList={{
                    "overflow-y-auto": !isFullScreen(),
                    "overflow-hidden": isFullScreen(),
                  }}
                >
                  <Show when={getSelectedComponent()} keyed>
                    {(selected) => (
                      <div class="h-full">
                        <selected.component />
                      </div>
                    )}
                  </Show>
                </Resizable.Panel>
              </>
            )}
          </Resizable>
        </Show>
      </Show>
    </div>
  );
};

export default Playground;
