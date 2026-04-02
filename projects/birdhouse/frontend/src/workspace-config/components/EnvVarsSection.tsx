// ABOUTME: Table of user-defined environment variables with inline add and per-row delete
// ABOUTME: Variables are injected into the OpenCode process when the workspace starts

import { type Component, createSignal, For, Show } from "solid-js";
import { Button } from "../../components/ui";

export interface EnvVarsSectionProps {
  envVars: Map<string, string>;
  onChange: (envVars: Map<string, string>) => void;
}

const EnvVarsSection: Component<EnvVarsSectionProps> = (props) => {
  const [newKey, setNewKey] = createSignal("");
  const [newValue, setNewValue] = createSignal("");
  const [addError, setAddError] = createSignal<string | null>(null);

  const sortedEntries = () => [...props.envVars.entries()].sort(([a], [b]) => a.localeCompare(b));

  const handleAdd = () => {
    const key = newKey().trim();
    const value = newValue().trim();

    if (!key) {
      setAddError("Variable name is required");
      return;
    }

    if (props.envVars.has(key)) {
      setAddError(`"${key}" already exists`);
      return;
    }

    const updated = new Map(props.envVars);
    updated.set(key, value);
    props.onChange(updated);
    setNewKey("");
    setNewValue("");
    setAddError(null);
  };

  const handleDelete = (key: string) => {
    const updated = new Map(props.envVars);
    updated.delete(key);
    props.onChange(updated);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleKeyInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    setNewKey(e.currentTarget.value);
    if (addError()) setAddError(null);
  };

  const handleValueInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    setNewValue(e.currentTarget.value);
    if (addError()) setAddError(null);
  };

  return (
    <div class="space-y-4">
      {/* Existing variables table */}
      <Show when={props.envVars.size > 0}>
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full bg-surface-raised">
            <thead class="border-b border-border">
              <tr>
                <th class="text-left px-4 py-3 text-sm font-medium text-text-primary">Name</th>
                <th class="text-left px-4 py-3 text-sm font-medium text-text-primary">Value</th>
                <th class="px-4 py-3 w-16">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <For each={sortedEntries()}>
                {([key, value]) => (
                  <tr class="border-b border-border last:border-b-0">
                    <td class="px-4 py-3 text-sm font-mono text-text-primary">{key}</td>
                    <td class="px-4 py-3 text-sm font-mono text-text-muted max-w-0 w-full">
                      <span class="block truncate" title={value}>
                        {value || <span class="italic opacity-50">empty</span>}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(key)}
                        aria-label={`Delete ${key}`}
                        class="text-text-muted hover:text-danger transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      {/* Add new variable row */}
      <div class="space-y-2">
        <div class="flex gap-2">
          <input
            type="text"
            value={newKey()}
            onInput={handleKeyInput}
            onKeyDown={handleKeyDown}
            placeholder="VARIABLE_NAME"
            class="w-48 flex-shrink-0 px-3 py-2 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-mono text-sm"
          />
          <input
            type="text"
            value={newValue()}
            onInput={handleValueInput}
            onKeyDown={handleKeyDown}
            placeholder="value"
            class="flex-1 min-w-0 px-3 py-2 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-mono text-sm"
          />
          <Button variant="secondary" onClick={handleAdd} disabled={!newKey().trim()}>
            Add
          </Button>
        </div>
        <Show when={addError()}>
          <p class="text-danger text-sm">{addError()}</p>
        </Show>
      </div>
    </div>
  );
};

export default EnvVarsSection;
