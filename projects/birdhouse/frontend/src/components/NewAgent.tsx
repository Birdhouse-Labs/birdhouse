// ABOUTME: New agent creation form with model selector
// ABOUTME: Allows users to create agents with optional title and model selection

import { useNavigate, useSearchParams } from "@solidjs/router";
import { Hammer, LibraryBig, Lightbulb } from "lucide-solid";
import { type Component, createEffect, createMemo, createResource, createSignal, onMount, Show } from "solid-js";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { createAgent, fetchModels, type Model } from "../services/messages-api";
import { previewSkillAttachments } from "../services/skill-attachments-api";
import { extractSkillLinkNames } from "../utils/skillLinks";
import AutoGrowTextarea from "./ui/AutoGrowTextarea";
import Button from "./ui/Button";
import { Combobox, type ComboboxOption, type ComboboxRenderFn } from "./ui/Combobox";
import SkillAttachmentsDialog from "./ui/SkillAttachmentsDialog";

const STORAGE_KEY = "birdhouse:last-selected-model";
const NEW_AGENT_DRAFT_KEY = "birdhouse:new-agent-draft";
const DRAFT_BACKUP_PREFIX = "birdhouse:draft-backup-";

const modelToOption = (model: Model): ComboboxOption<string> => ({
  value: model.id,
  label: model.name,
  // description kept as provider so typeahead search includes provider name
  description: model.provider,
});

const makeModelRenderOption =
  (modelMap: Map<string, Model>): ComboboxRenderFn<string> =>
  (option) => {
    const model = modelMap.get(option.value);
    return (
      <div>
        <div class="font-medium text-text-primary">{option.label}</div>
        <div class="flex flex-wrap justify-between gap-x-3 mt-0.5">
          <span class="text-text-secondary text-xs">{option.description}</span>
          {model && model.contextLimit > 0 && (
            <span class="text-text-muted text-xs">{model.contextLimit.toLocaleString()} limit</span>
          )}
        </div>
      </div>
    );
  };

const NewAgent: Component = () => {
  // Get workspace context
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();

  // Load models from API (with workspace ID)
  const [models] = createResource(() => fetchModels(workspaceId));

  const [selectedModelId, setSelectedModelId] = createSignal<string>("");
  const [messageText, setMessageText] = createSignal("");
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedMode, setSelectedMode] = createSignal<"build" | "plan">("build");

  const [searchParams, setSearchParams] = useSearchParams();

  const linkedSkillNames = createMemo(() => extractSkillLinkNames(messageText().trim()));

  const [skillAttachments] = createResource(
    () => {
      const text = messageText().trim();
      if (!text || linkedSkillNames().length === 0) {
        return null;
      }

      return text;
    },
    (text) => previewSkillAttachments(workspaceId, text),
  );
  const visibleSkillAttachments = createMemo(() => {
    if (linkedSkillNames().length === 0 || !messageText().trim() || skillAttachments.error) {
      return [];
    }

    return skillAttachments() ?? [];
  });
  const patternCount = createMemo(() => {
    return visibleSkillAttachments().length;
  });
  const [patternDialogOpen, setPatternDialogOpen] = createSignal(false);

  // Handle URL param pre-fill with timestamped draft backup
  onMount(() => {
    const urlMessage = searchParams["message"];

    if (urlMessage) {
      // URL param exists - backup any existing draft with timestamp before overwriting
      const existingDraft = localStorage.getItem(NEW_AGENT_DRAFT_KEY);
      if (existingDraft) {
        const timestamp = Date.now();
        localStorage.setItem(`${DRAFT_BACKUP_PREFIX}${timestamp}`, existingDraft);
      }

      // Set message from URL param (handle array case though we expect single value)
      const messageValue = Array.isArray(urlMessage) ? urlMessage[0] : urlMessage;
      if (messageValue) {
        setMessageText(messageValue);
      }

      // Clean up URL param using router's setSearchParams (removes 'message' key by setting to undefined)
      // This properly updates both the URL bar and router state without navigation side effects
      setSearchParams({ message: undefined }, { replace: true, scroll: false });
    } else {
      // Load existing draft if available
      const draft = localStorage.getItem(NEW_AGENT_DRAFT_KEY);
      if (draft) {
        setMessageText(draft);
      }
    }
  });

  // Save draft to localStorage when input changes (only if non-empty)
  createEffect(() => {
    const value = messageText().trim();
    if (value) {
      localStorage.setItem(NEW_AGENT_DRAFT_KEY, messageText());
    } else {
      localStorage.removeItem(NEW_AGENT_DRAFT_KEY);
    }
  });

  // Get available models or fallback to empty array
  const availableModels = () => models() || [];

  // Map of model id → model for the custom render function
  const modelMap = createMemo(() => {
    const map = new Map<string, Model>();
    for (const m of availableModels()) map.set(m.id, m);
    return map;
  });
  const renderModelOption = createMemo(() => makeModelRenderOption(modelMap()));

  // Display value shown in the closed combobox input (includes provider name for disambiguation)
  const modelDisplayValue = createMemo(() => {
    const model = modelMap().get(selectedModelId());
    if (!model) return undefined;
    return `${model.provider} / ${model.name}`;
  });

  // Set default model once models load
  createEffect(() => {
    const modelList = models();
    if (modelList && modelList.length > 0 && !selectedModelId()) {
      // Try to restore from localStorage first
      const storedModelId = localStorage.getItem(STORAGE_KEY);
      if (storedModelId && modelList.some((m) => m.id === storedModelId)) {
        setSelectedModelId(storedModelId);
        return;
      }

      // Default to the highest-versioned Anthropic Sonnet, then first model
      // Parses version from IDs like "anthropic/claude-sonnet-4-6" -> [4, 6]
      const parseSonnetVersion = (id: string): [number, number] | null => {
        const match = id.match(/^anthropic\/claude-sonnet-(\d+)-(\d+)/);
        return match?.[1] && match?.[2] ? [parseInt(match[1], 10), parseInt(match[2], 10)] : null;
      };
      const anthropicSonnets = modelList.flatMap((m) => {
        const version = parseSonnetVersion(m.id);
        return version ? [{ model: m, version }] : [];
      });
      const latestSonnet = anthropicSonnets.sort((a, b) => {
        return b.version[0] - a.version[0] || b.version[1] - a.version[1];
      })[0]?.model;
      const defaultModel = latestSonnet || modelList[0];
      if (defaultModel) {
        setSelectedModelId(defaultModel.id);
      }
    }
  });

  // Save selected model to localStorage whenever it changes
  createEffect(() => {
    const modelId = selectedModelId();
    if (modelId) {
      localStorage.setItem(STORAGE_KEY, modelId);
    }
  });

  // Compute agent based on selected mode
  const agentForMode = createMemo(() => {
    const mode = selectedMode();
    return mode === "plan" ? "plan" : undefined;
  });

  const handleCreateAgent = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const modelId = selectedModelId();
      const message = messageText().trim();

      // Create the agent with optional first message
      // If message provided, server sends it and injects Birdhouse system prompt
      const agent = await createAgent(workspaceId, undefined, modelId, message || undefined, agentForMode());

      // Clear draft after successful creation
      localStorage.removeItem(NEW_AGENT_DRAFT_KEY);

      // Navigate to the new agent (workspace-aware)
      navigate(`/workspace/${workspaceId}/agent/${agent.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div class="flex flex-col items-center justify-center h-full p-8 relative">
      <div class="max-w-md w-full space-y-6">
        {/* Header */}
        <div class="text-center">
          <h2 class="text-2xl font-semibold mb-2 text-text-primary" data-ph-reveal>
            Launch a New Agent
          </h2>
          <p class="text-text-secondary" data-ph-reveal>
            Choose a model and begin chatting
          </p>
        </div>

        {/* Model Selector */}
        <div class="space-y-2">
          <div class="text-sm font-medium text-text-primary" data-ph-reveal>
            Model
          </div>
          <Combobox
            options={availableModels().map(modelToOption)}
            value={selectedModelId()}
            onSelect={setSelectedModelId}
            placeholder={models.loading ? "Loading models..." : "Select a model..."}
            renderOption={renderModelOption()}
            displayValue={modelDisplayValue()}
          />
        </div>

        {/* Message Input */}
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <div class="text-sm font-medium text-text-primary" data-ph-reveal>
              Start with a message
            </div>
            {/* Mode Toggle */}
            <button
              type="button"
              onClick={() => setSelectedMode((current) => (current === "build" ? "plan" : "build"))}
              class="relative flex items-center justify-center w-7 h-7 rounded-lg transition-all"
              classList={{
                "bg-accent/20 text-accent hover:bg-accent/30": selectedMode() === "plan",
                "text-text-secondary hover:bg-surface hover:text-text-primary": selectedMode() === "build",
              }}
              aria-label={`Switch to ${selectedMode() === "build" ? "plan" : "build"} mode`}
              title={`Current: ${selectedMode()} mode. Click to switch.`}
              data-ph-capture-attribute-button-type="toggle-agent-mode"
              data-ph-capture-attribute-current-mode={selectedMode()}
              data-ph-capture-attribute-action={selectedMode() === "build" ? "switch-to-plan" : "switch-to-build"}
            >
              {selectedMode() === "plan" ? <Lightbulb size={14} /> : <Hammer size={14} />}
            </button>
          </div>
          <div class="flex">
            <AutoGrowTextarea
              value={messageText()}
              onInput={setMessageText}
              onSend={handleCreateAgent}
              disabled={isCreating()}
              placeholder="What would you like help with?"
            />
          </div>
        </div>

        {/* Error Message */}
        {error() && (
          <div class="text-danger text-sm p-3 bg-surface-raised rounded-lg border border-danger">{error()}</div>
        )}

        {/* Launch Button */}
        <Button
          onClick={handleCreateAgent}
          disabled={isCreating()}
          variant="primary"
          class="w-full"
          data-ph-capture-attribute-button-type="launch-agent"
          data-ph-capture-attribute-workspace-id={workspaceId}
          data-ph-capture-attribute-model-id={selectedModelId()}
          data-ph-capture-attribute-mode={selectedMode()}
          data-ph-capture-attribute-has-message={messageText().trim() ? "true" : "false"}
          data-ph-capture-attribute-is-creating={isCreating() ? "true" : "false"}
          data-ph-reveal
        >
          {isCreating() ? "Launching..." : "Launch Agent"}
        </Button>

        {/* Skill indicator - spacer button prevents layout jump */}
        <div class="flex justify-center">
          <Show
            when={patternCount() > 0}
            fallback={
              <Button variant="tertiary" leftIcon={<LibraryBig size={16} />} class="invisible">
                Launching with 1 skill
              </Button>
            }
          >
            <Button
              variant="tertiary"
              leftIcon={<LibraryBig size={16} />}
              onClick={() => setPatternDialogOpen(true)}
              data-ph-reveal
            >
              Launching with {patternCount()} {patternCount() === 1 ? "skill" : "skills"}
            </Button>
          </Show>
        </div>
      </div>

      {/* Loading Overlay - covers entire container */}
      <Show when={models.loading}>
        <div class="absolute inset-0 bg-surface/80 backdrop-blur-sm flex items-center justify-center z-10">
          {/* Spinner */}
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
        </div>
      </Show>

      {/* Skill attachments dialog */}
      <SkillAttachmentsDialog
        attachments={visibleSkillAttachments()}
        open={patternDialogOpen()}
        onClose={() => setPatternDialogOpen(false)}
      />
    </div>
  );
};

export default NewAgent;
