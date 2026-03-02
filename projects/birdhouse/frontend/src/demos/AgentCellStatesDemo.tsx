// ABOUTME: Agent cell states playground showing current vs new design side-by-side
// ABOUTME: Each cell configurable via checkboxes to compare any state combinations

import { type Component, createSignal } from "solid-js";
import AgentTreeItem from "../components/AgentTreeItem";
import type { TreeNode } from "../components/TreeView";
import { AgentTreeProvider } from "../contexts/AgentTreeContext";
import { borderColor, cardSurfaceFlat } from "../styles/containerStyles";

// Helper to create mock TreeNode
const createMockNode = (id: string): TreeNode => ({
  id,
  title: "Fix authentication bug in login flow",
  level: 0,
  children: [],
  collapsed: false,
  createdAt: new Date(Date.now() - 3600000),
  updatedAt: new Date(Date.now() - 300000),
  clonedFrom: null,
  clonedAt: null,
  archivedAt: null,
  isActivelyWorking: false,
  hasUnreadMessages: false,
  modelName: "anthropic/claude-sonnet-4",
  tokenUsage: 15000,
});

const AgentCellStatesDemo: Component = () => {
  // Cell 1 state (current design)
  const [cell1Selected, setCell1Selected] = createSignal(false);
  const [cell1Working, setCell1Working] = createSignal(false);
  const [cell1Unread, setCell1Unread] = createSignal(false);

  // Cell 2 state (new design)
  const [cell2Selected, setCell2Selected] = createSignal(false);
  const [cell2Working, setCell2Working] = createSignal(true);
  const [cell2Unread, setCell2Unread] = createSignal(false);

  // Mock handlers
  const mockSelectAgent = (_id: string) => {};
  const mockToggleCollapse = (_id: string) => {};

  // Create nodes based on state
  const cell1Node = (): TreeNode => ({
    ...createMockNode("agent_cell1_current"),
    isActivelyWorking: cell1Working(),
    hasUnreadMessages: cell1Unread(),
  });

  const cell2Node = (): TreeNode => ({
    ...createMockNode("agent_cell2_new"),
    isActivelyWorking: cell2Working(),
    hasUnreadMessages: cell2Unread(),
  });

  const Checkbox: Component<{
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }> = (props) => (
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
        class="w-4 h-4 cursor-pointer"
      />
      <span class="text-sm">{props.label}</span>
    </label>
  );

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Agent Cell States</h2>
        <p class="text-sm text-text-secondary hidden md:block">
          Visual comparison of all agent cell states for design review
        </p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        <div class="grid grid-cols-2 gap-8">
          {/* Cell 1 */}
          <div class="space-y-4">
            <h2 class="text-lg font-semibold">Cell 1</h2>

            {/* Controls */}
            <div class={`p-4 ${cardSurfaceFlat} rounded-lg space-y-2`}>
              <Checkbox label="Selected" checked={cell1Selected()} onChange={setCell1Selected} />
              <Checkbox label="Working" checked={cell1Working()} onChange={setCell1Working} />
              <Checkbox label="Has Unread" checked={cell1Unread()} onChange={setCell1Unread} />
            </div>

            {/* Cell Preview */}
            <AgentTreeProvider selectAgent={mockSelectAgent} toggleCollapse={mockToggleCollapse}>
              <div class={`border ${borderColor} rounded-lg overflow-hidden bg-surface`}>
                <AgentTreeItem node={cell1Node()} isSelected={cell1Selected()} />
              </div>
            </AgentTreeProvider>
          </div>

          {/* Cell 2 */}
          <div class="space-y-4">
            <h2 class="text-lg font-semibold">Cell 2</h2>

            {/* Controls */}
            <div class={`p-4 ${cardSurfaceFlat} rounded-lg space-y-2`}>
              <Checkbox label="Selected" checked={cell2Selected()} onChange={setCell2Selected} />
              <Checkbox label="Working" checked={cell2Working()} onChange={setCell2Working} />
              <Checkbox label="Has Unread" checked={cell2Unread()} onChange={setCell2Unread} />
            </div>

            {/* Cell Preview */}
            <AgentTreeProvider selectAgent={mockSelectAgent} toggleCollapse={mockToggleCollapse}>
              <div class={`border ${borderColor} rounded-lg overflow-hidden bg-surface`}>
                <AgentTreeItem node={cell2Node()} isSelected={cell2Selected()} />
              </div>
            </AgentTreeProvider>
          </div>
        </div>

        {/* Design Notes */}
        <div class={`p-4 ${cardSurfaceFlat} rounded-lg`}>
          <h3 class="font-semibold mb-3">New Design Features</h3>
          <div class="text-sm text-text-secondary space-y-2">
            <div>• Gradient pulse when working (matches AgentHeader)</div>
            <div>• No pulsing dot indicator</div>
            <div>• Bold title + unified color when selected</div>
            <div>• Cleaner, more professional appearance</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentCellStatesDemo;
