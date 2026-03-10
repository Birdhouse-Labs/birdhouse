// ABOUTME: Table displaying configured AI providers with edit/delete actions
// ABOUTME: Shows only providers that have keys configured, with add button showing available providers

import Popover from "corvu/popover";
import { ChevronDown, Plus } from "lucide-solid";
import type { Component } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import { Button } from "../../components/ui";
import { useZIndex } from "../../contexts/ZIndexContext";
import { PROVIDERS } from "../types/provider-registry";

export interface ProvidersListProps {
  providers: Map<string, string>; // providerId → api_key
  onAdd: (providerId: string) => void;
  onEdit: (providerId: string) => void;
  onDelete: (providerId: string) => void;
}

const ProvidersList: Component<ProvidersListProps> = (props) => {
  const baseZIndex = useZIndex();
  const [isAddMenuOpen, setIsAddMenuOpen] = createSignal(false);

  // Helper function to mask API key: first 4 chars + "..." + last 6 chars
  const maskApiKey = (key: string): string => {
    if (key.length <= 10) return `${key.slice(0, 4)}...`;
    return `${key.slice(0, 4)}...${key.slice(-6)}`;
  };

  // Get only providers that have keys configured, in registry order (Anthropic, OpenAI, Google first)
  const configuredProviders = () => {
    return PROVIDERS.filter((provider) => props.providers.has(provider.id));
  };

  // All providers in registry order — configured ones shown faded/disabled in the add menu
  const allProviders = () => PROVIDERS;

  const handleAddProvider = (providerId: string) => {
    setIsAddMenuOpen(false);
    // Small delay to let popover dismiss cleanly before opening dialog
    setTimeout(() => {
      props.onAdd(providerId);
    }, 50);
  };

  return (
    <div class="space-y-4">
      {/* Add Provider Button */}
      <div class="flex justify-end mb-4">
        <Popover open={isAddMenuOpen()} onOpenChange={setIsAddMenuOpen}>
          <Popover.Trigger
            as={Button}
            variant="primary"
            leftIcon={<Plus size={18} />}
            rightIcon={<ChevronDown size={16} />}
          >
            Add Provider
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              class="w-64 max-h-80 overflow-y-auto rounded-xl py-1 border shadow-2xl bg-surface-raised border-border"
              style={{ "z-index": baseZIndex }}
            >
              <For each={allProviders()}>
                {(provider) => {
                  const configured = () => props.providers.has(provider.id);
                  return (
                    <button
                      type="button"
                      class="w-full px-4 py-2 text-left text-sm transition-colors"
                      classList={{
                        "text-text-muted opacity-40 cursor-not-allowed": configured(),
                        "text-text-primary hover:bg-surface-overlay": !configured(),
                      }}
                      disabled={configured()}
                      onClick={() => !configured() && handleAddProvider(provider.id)}
                    >
                      {provider.label}
                    </button>
                  );
                }}
              </For>
            </Popover.Content>
          </Popover.Portal>
        </Popover>
      </div>

      {/* Table - only shows configured providers */}
      <Show
        when={configuredProviders().length > 0}
        fallback={
          <div class="text-text-muted text-center py-8 bg-surface-raised rounded-lg border border-border">
            No providers configured. Click Add Provider to get started.
          </div>
        }
      >
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full bg-surface-raised">
            <thead class="border-b border-border">
              <tr>
                <th class="text-left px-4 py-3 text-sm font-medium text-text-primary">Provider</th>
                <th class="text-left px-4 py-3 text-sm font-medium text-text-primary">API Key</th>
                <th class="text-right px-4 py-3 text-sm font-medium text-text-primary">Actions</th>
              </tr>
            </thead>
            <tbody>
              <For each={configuredProviders()}>
                {(provider) => (
                  <tr class="border-b border-border last:border-b-0">
                    <td class="px-4 py-3 text-sm text-text-primary">{provider.label}</td>
                    <td class="px-4 py-3 text-sm">
                      <span class="text-text-muted font-mono text-xs">
                        {maskApiKey(props.providers.get(provider.id) ?? "")}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-right">
                      <div class="flex gap-2 justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => props.onEdit(provider.id)}
                          data-ph-capture-attribute-button-type="edit-ai-provider"
                          data-ph-capture-attribute-provider-id={provider.id}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => props.onDelete(provider.id)}
                          data-ph-capture-attribute-button-type="delete-ai-provider"
                          data-ph-capture-attribute-provider-id={provider.id}
                        >
                          Delete
                        </Button>
                      </div>
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

export default ProvidersList;
