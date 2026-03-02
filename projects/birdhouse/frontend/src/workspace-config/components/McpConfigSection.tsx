// ABOUTME: Table displaying configured MCP servers with enable/disable toggles
// ABOUTME: Shows server name, command/URL info, and enabled status with checkboxes

import { type Component, For, Show } from "solid-js";
import { Button } from "../../components/ui";
import Checkbox from "../../components/ui/Checkbox";
import type { McpServerConfig, McpServers } from "../types/config-types";

export interface McpConfigSectionProps {
  mcpServers: McpServers | null;
  onToggle: (serverName: string, enabled: boolean) => void;
  onConfigureJson: () => void;
}

const McpConfigSection: Component<McpConfigSectionProps> = (props) => {
  // Get array of server entries from mcpServers object
  const serverEntries = () => {
    if (!props.mcpServers) return [];
    return Object.entries(props.mcpServers).sort(([a], [b]) => a.localeCompare(b));
  };

  const hasServers = () => serverEntries().length > 0;

  // Get enabled state for a server (default to true if undefined)
  const isEnabled = (config: McpServerConfig) => {
    return config.enabled ?? true;
  };

  // Format the command/URL for display
  const formatCommand = (config: McpServerConfig): string => {
    if (config.type === "remote") {
      return config.url || "No URL configured";
    }

    // Local server - show command (can be string or array)
    if (config.command) {
      // Handle command as array (OpenCode format) or string
      if (Array.isArray(config.command)) {
        return config.command.join(" ");
      }
      // Legacy: command as string with separate args
      const args = config.args?.join(" ") || "";
      return args ? `${config.command} ${args}` : config.command;
    }

    return "No command configured";
  };

  return (
    <div class="space-y-4">
      {/* Configure Button */}
      <div class="flex justify-end mb-4">
        <Button variant="secondary" onClick={props.onConfigureJson}>
          Configure JSON
        </Button>
      </div>

      {/* Table or Empty State */}
      <Show
        when={hasServers()}
        fallback={
          <div class="text-text-muted text-center py-8 bg-surface-raised rounded-lg border border-border">
            No MCP servers configured. Click Configure JSON to add.
          </div>
        }
      >
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full bg-surface-raised">
            <thead class="border-b border-border">
              <tr>
                <th class="text-left px-4 py-3 text-sm font-medium text-text-primary w-10">
                  <span class="sr-only">Enabled</span>
                </th>
                <th class="text-left px-4 py-3 text-sm font-medium text-text-primary">Server</th>
                <th class="text-left px-4 py-3 text-sm font-medium text-text-primary">Command</th>
              </tr>
            </thead>
            <tbody>
              <For each={serverEntries()}>
                {([serverName, config]) => (
                  <tr class="border-b border-border last:border-b-0">
                    <td class="px-4 py-3">
                      <Checkbox
                        checked={isEnabled(config)}
                        onChange={(enabled) => props.onToggle(serverName, enabled)}
                        label=""
                      />
                    </td>
                    <td class="px-4 py-3 text-sm text-text-primary">{serverName}</td>
                    <td class="px-4 py-3 text-sm max-w-0 w-full">
                      <span class="text-text-muted font-mono text-xs block truncate" title={formatCommand(config)}>
                        {formatCommand(config)}
                      </span>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
};

export default McpConfigSection;
