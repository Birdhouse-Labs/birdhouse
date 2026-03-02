// ABOUTME: Dialog for editing MCP server configuration as raw JSON
// ABOUTME: Provides validation and error display for JSON syntax and structure

import Dialog from "corvu/dialog";
import Popover from "corvu/popover";
import { Info } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, Show } from "solid-js";
import { Button } from "../../components/ui";
import { useZIndex } from "../../contexts/ZIndexContext";
import type { McpServers } from "../types/config-types";

const LOCAL_EXAMPLE = `{
  "perplexity": {
    "enabled": true,
    "type": "local",
    "command": ["npx", "-y", "@perplexity-ai/mcp-server"],
    "environment": {
      "PERPLEXITY_API_KEY": "pplx-xxxxxxxxxxxx"
    }
  }
}`;

const REMOTE_EXAMPLE = `{
  "linear": {
    "enabled": true,
    "type": "remote",
    "url": "https://mcp.linear.app/sse",
    "headers": {
      "Authorization": "Bearer lin_api_xxxxxxxxxxxx"
    }
  }
}`;

export interface McpJsonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialJson: string; // Formatted JSON string
  onSave: (parsed: McpServers) => void;
}

const McpJsonDialog: Component<McpJsonDialogProps> = (props) => {
  const baseZIndex = useZIndex();
  const [jsonString, setJsonString] = createSignal<string>("");
  const [jsonError, setJsonError] = createSignal<string | null>(null);
  const [infoOpen, setInfoOpen] = createSignal(false);
  const [exampleType, setExampleType] = createSignal<"local" | "remote">("remote");

  // Reset form when dialog opens
  // Show empty string (to reveal placeholder) if config is empty object
  createEffect(() => {
    if (props.open) {
      const isEmpty = props.initialJson === "{}" || props.initialJson.trim() === "";
      setJsonString(isEmpty ? "" : props.initialJson);
      setJsonError(null);
    }
  });

  // Validate JSON on blur
  const validateJson = (value: string) => {
    // Empty means no MCP servers configured - that's valid
    if (value.trim() === "") {
      setJsonError(null);
      return { valid: true, parsed: {} };
    }

    try {
      const parsed = JSON.parse(value);
      setJsonError(null);
      return { valid: true, parsed };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Invalid JSON";
      setJsonError(errorMsg);
      return { valid: false, parsed: null };
    }
  };

  const handleBlur = () => {
    validateJson(jsonString());
  };

  const handleSave = () => {
    const result = validateJson(jsonString());
    if (result.valid && result.parsed) {
      props.onSave(result.parsed as McpServers);
    }
  };

  const handleCancel = () => {
    props.onOpenChange(false);
  };

  const canSave = createMemo(() => {
    // Allow empty (clears config) or valid JSON
    return jsonError() === null;
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl rounded-2xl p-6 border shadow-2xl -translate-x-1/2 -translate-y-1/2 bg-surface-raised border-border">
          {/* Header */}
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <Dialog.Label class="text-2xl font-bold text-heading">MCP Server Configuration</Dialog.Label>
              <Popover open={infoOpen()} onOpenChange={setInfoOpen}>
                <Popover.Trigger
                  class="text-text-muted hover:text-text-primary transition-colors p-1 rounded"
                  aria-label="Configuration help"
                >
                  <Info size={18} />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    class="w-96 rounded-xl p-4 border shadow-2xl bg-surface-raised border-border"
                    style={{ "z-index": baseZIndex }}
                  >
                    <div class="space-y-3">
                      <p class="text-sm text-text-muted">
                        Examples of how to set up remote and local MCP servers in Birdhouse.
                      </p>

                      {/* Toggle buttons */}
                      <div class="flex rounded-lg border border-border overflow-hidden">
                        <button
                          type="button"
                          class={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                            exampleType() === "remote"
                              ? "bg-accent text-text-on-accent"
                              : "bg-surface text-text-muted hover:text-text-primary"
                          }`}
                          onClick={() => setExampleType("remote")}
                        >
                          Remote
                        </button>
                        <button
                          type="button"
                          class={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                            exampleType() === "local"
                              ? "bg-accent text-text-on-accent"
                              : "bg-surface text-text-muted hover:text-text-primary"
                          }`}
                          onClick={() => setExampleType("local")}
                        >
                          Local
                        </button>
                      </div>

                      {/* Example */}
                      <pre class="text-xs font-mono bg-surface p-3 rounded-lg overflow-x-auto text-text-primary">
                        {exampleType() === "remote" ? REMOTE_EXAMPLE : LOCAL_EXAMPLE}
                      </pre>
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover>
            </div>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors focus:outline-none rounded p-1 w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span class="text-xl leading-none select-none">×</span>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div class="space-y-4">
            {/* JSON Editor */}
            <textarea
              value={jsonString()}
              onInput={(e) => setJsonString(e.currentTarget.value)}
              onBlur={handleBlur}
              placeholder={`{
  "linear": {
    "enabled": true,
    "type": "remote",
    "url": "https://mcp.linear.app/sse",
    "headers": {
      "Authorization": "Bearer lin_api_xxxxxxxxxxxx"
    }
  }
}`}
              class="w-full h-[500px] px-4 py-3 bg-surface text-text-primary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-none font-mono text-sm"
            />

            {/* Error Display */}
            <Show when={jsonError()}>
              <div class="flex items-start gap-2 text-danger text-sm">
                <span>⚠</span>
                <span>JSON Parse Error: {jsonError()}</span>
              </div>
            </Show>
          </div>

          {/* Actions */}
          <div class="flex gap-3 justify-end mt-6">
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!canSave()}>
              Save
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default McpJsonDialog;
