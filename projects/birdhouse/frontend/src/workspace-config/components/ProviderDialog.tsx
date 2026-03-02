// ABOUTME: Dialog for entering AI provider API key and provider-specific options
// ABOUTME: Provider is pre-selected, user just needs to enter the API key

import Dialog from "corvu/dialog";
import { CheckCircle, ExternalLink, Loader, XCircle } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, Show } from "solid-js";
import { Button } from "../../components/ui";
import { testProviderKey } from "../services/workspace-config-api";
import { PROVIDERS } from "../types/provider-registry";
import PasswordInput from "./PasswordInput";

export interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  hasExistingKey: boolean;
  currentKey?: string | undefined; // The actual key value if editing
  extendedContext?: boolean; // Anthropic only: 1M context window toggle
  onSave: (providerId: string, apiKey: string, extendedContext?: boolean) => void;
}

type TestState = "idle" | "testing" | "success" | "error";

const ProviderDialog: Component<ProviderDialogProps> = (props) => {
  const [apiKey, setApiKey] = createSignal<string>("");
  const [extendedContext, setExtendedContext] = createSignal<boolean>(false);
  const [testState, setTestState] = createSignal<TestState>("idle");
  const [testError, setTestError] = createSignal<string>("");

  // Populate form with current values when dialog opens for editing
  createEffect(() => {
    if (props.open) {
      setApiKey(props.currentKey || "");
      setExtendedContext(props.extendedContext ?? false);
      setTestState("idle");
      setTestError("");
    }
  });

  // Reset test state when the key changes
  createEffect(() => {
    apiKey();
    setTestState("idle");
    setTestError("");
  });

  // Get provider metadata
  const provider = createMemo(() => {
    return PROVIDERS.find((p) => p.id === props.providerId);
  });

  // Validation: require key for new providers, optional for existing (keeps current key)
  const canSave = createMemo(() => {
    return apiKey().trim() !== "" || props.hasExistingKey;
  });

  const keyToTest = createMemo(() => apiKey().trim() || props.currentKey || "");

  const handleTest = async () => {
    const key = keyToTest();
    if (!key) return;
    setTestState("testing");
    setTestError("");
    const result = await testProviderKey(props.providerId, key);
    if (result.success) {
      setTestState("success");
    } else {
      setTestState("error");
      setTestError(result.error ?? "Unknown error");
    }
  };

  const handleSave = () => {
    if (!canSave()) return;
    if (props.providerId === "anthropic") {
      props.onSave(props.providerId, apiKey(), extendedContext());
    } else {
      props.onSave(props.providerId, apiKey());
    }
  };

  const handleCancel = () => {
    props.onOpenChange(false);
  };

  const dialogTitle = () => {
    const p = provider();
    if (props.hasExistingKey) {
      return `Edit ${p?.label || "Provider"}`;
    }
    return `Add ${p?.label || "Provider"}`;
  };

  const saveButtonLabel = () => {
    return props.hasExistingKey ? "Save" : "Add Provider";
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-50 w-full max-w-md rounded-2xl p-6 border shadow-2xl -translate-x-1/2 -translate-y-1/2 bg-surface-raised border-border">
          <div class="flex items-center justify-between mb-2">
            <Dialog.Label class="text-2xl font-bold text-heading">{dialogTitle()}</Dialog.Label>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors focus:outline-none rounded p-1 w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span class="text-xl leading-none select-none">×</span>
            </Dialog.Close>
          </div>

          <div class="space-y-4 mt-4">
            {/* API Key Input */}
            <div class="space-y-2">
              <label for="api-key" class="text-sm font-medium text-text-primary block">
                API Key
              </label>
              <PasswordInput value={apiKey()} onInput={setApiKey} placeholder="Enter API key" />
            </div>

            {/* Test key button + result — Anthropic only */}
            <Show when={props.providerId === "anthropic"}>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={!keyToTest() || testState() === "testing"}
                  class="text-sm text-accent hover:text-accent/80 disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
                >
                  {testState() === "testing" ? "Testing..." : "Test key"}
                </button>
                <Show when={testState() === "testing"}>
                  <Loader size={14} class="text-text-muted animate-spin" />
                </Show>
                <Show when={testState() === "success"}>
                  <span class="flex items-center gap-1 text-sm text-success">
                    <CheckCircle size={14} />
                    Valid
                  </span>
                </Show>
                <Show when={testState() === "error"}>
                  <span class="flex items-center gap-1 text-sm text-danger" title={testError()}>
                    <XCircle size={14} />
                    {testError()}
                  </span>
                </Show>
              </div>
            </Show>

            {/* Get API Key Link */}
            <Show when={provider()?.docUrl}>
              <a
                href={provider()?.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-accent hover:text-accent/80 text-sm flex items-center gap-1.5 transition-colors"
              >
                <span>Get API Key</span>
                <ExternalLink size={14} />
              </a>
            </Show>

            {/* Anthropic-specific options */}
            <Show when={props.providerId === "anthropic"}>
              <div class="pt-2 border-t border-border">
                <label class="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 rounded border-border accent-accent cursor-pointer"
                    checked={extendedContext()}
                    onChange={(e) => setExtendedContext(e.currentTarget.checked)}
                  />
                  <div class="space-y-0.5">
                    <span class="text-sm font-medium text-text-primary block">1M context window</span>
                    <span class="text-xs text-text-muted block">
                      Enables 1M token context for Sonnet and Opus models. Requires account access.
                    </span>
                  </div>
                </label>
              </div>
            </Show>
          </div>

          {/* Actions */}
          <div class="flex gap-3 justify-end mt-6">
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!canSave()}>
              {saveButtonLabel()}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default ProviderDialog;
