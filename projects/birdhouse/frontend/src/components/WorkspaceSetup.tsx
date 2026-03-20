// ABOUTME: Workspace setup flow for creating new workspaces
// ABOUTME: Supports both CLI-driven (?directory=...) and manual browser-driven creation

import { useNavigate, useSearchParams } from "@solidjs/router";
import { type Component, createSignal, onMount, Show } from "solid-js";
import { usePageTitle } from "../lib/page-title";
import { checkWorkspace, createWorkspace } from "../services/workspaces-api";
import Button from "./ui/Button";

const LoadingSpinner = () => (
  <div class="flex items-center justify-center">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
  </div>
);

const WorkspaceSetup: Component = () => {
  usePageTitle("New Workspace - Birdhouse");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [directory, setDirectory] = createSignal("");
  const [name, setName] = createSignal("");
  const [isChecking, setIsChecking] = createSignal(false);
  const [isCreating, setIsCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  // CLI flow: Check if workspace exists, then either navigate or show form
  onMount(() => {
    const dirParam = searchParams["directory"];
    if (dirParam) {
      // Handle string or string[] from query params
      const dir = Array.isArray(dirParam) ? dirParam[0] : dirParam;
      if (dir) {
        setDirectory(dir);
        handleAutoSetup(dir);
      }
    }
  });

  const handleAutoSetup = async (dir: string) => {
    setIsChecking(true);
    setError(null);

    try {
      // Check if workspace exists
      const checkResult = await checkWorkspace(dir);

      if (checkResult.exists && checkResult.workspace_id) {
        // Workspace exists - navigate to it
        navigate(`/workspace/${checkResult.workspace_id}/agents`);
      } else {
        // Workspace doesn't exist - show form with pre-populated directory
        setIsChecking(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check workspace");
      setIsChecking(false);
    }
  };

  const handleCreateWorkspace = async (dir?: string) => {
    const workspaceDir = dir || directory();

    if (!workspaceDir.trim()) {
      setError("Please select a directory");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const workspaceName = name().trim();
      const createRequest: { directory: string; title?: string } = {
        directory: workspaceDir,
      };
      // If name is empty, derive it from the last path component
      if (workspaceName) {
        createRequest.title = workspaceName;
      } else {
        // Extract basename from directory path
        const pathParts = workspaceDir.split(/[/\\]/);
        const folderName = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
        if (folderName) {
          createRequest.title = folderName;
        }
      }
      const result = await createWorkspace(createRequest);

      // Navigate to new workspace
      navigate(`/workspace/${result.workspace_id}/agents`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
      setIsCreating(false);
    }
  };

  const handlePathInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    setDirectory(input.value);
  };

  const handleNameInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    setName(input.value);
  };

  const handleSubmit = () => {
    handleCreateWorkspace();
  };

  const isLoading = () => isChecking() || isCreating();

  return (
    <div class="min-h-screen overflow-auto p-8 bg-gradient-to-br from-bg-from via-bg-via to-bg-to">
      <div class="max-w-2xl mx-auto">
        {/* Header */}
        <div class="mb-8">
          <h1 class="text-4xl font-bold text-text-primary mb-2">Create Workspace</h1>
          <p class="text-text-muted">Set up a new workspace directory for your agents</p>
        </div>

        {/* Setup Form */}
        <div class="p-8 bg-surface-raised rounded-lg border border-border">
          <Show when={isChecking()}>
            <div class="flex flex-col items-center gap-4">
              <LoadingSpinner />
              <p class="text-text-muted">Checking workspace...</p>
            </div>
          </Show>

          <Show when={!isChecking()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              class="space-y-6"
            >
              {/* Workspace Name Input */}
              <div>
                <label for="workspace-name-input" class="block text-sm font-medium text-text-primary mb-2">
                  Workspace Name <span class="text-text-muted font-normal">(Optional)</span>
                </label>
                <input
                  id="workspace-name-input"
                  type="text"
                  value={name()}
                  onInput={handleNameInput}
                  placeholder="My Project"
                  class="w-full px-4 py-3 bg-surface border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p class="mt-2 text-sm text-text-muted">
                  Give your workspace a friendly name. If left blank, defaults to the folder name.
                </p>
              </div>

              {/* Directory Input */}
              <div>
                <label for="workspace-directory-input" class="block text-sm font-medium text-text-primary mb-2">
                  Workspace Directory
                </label>
                <input
                  id="workspace-directory-input"
                  type="text"
                  value={directory()}
                  onInput={handlePathInput}
                  placeholder="/Users/your-name/my-workspace"
                  class="w-full px-4 py-3 bg-surface border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <p class="mt-2 text-sm text-text-muted">
                  Enter the full path to the directory where you want to store your workspace data
                </p>
              </div>

              {/* Error Message */}
              <Show when={error()}>
                <div class="p-3 bg-danger/10 border border-danger rounded">
                  <p class="text-sm text-danger">{error()}</p>
                </div>
              </Show>

              {/* Actions */}
              <div class="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => navigate("/")}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={isLoading()} onClick={handleSubmit}>
                  <Show when={isCreating()} fallback="Create Workspace">
                    <div class="flex items-center gap-2">
                      <LoadingSpinner />
                      <span>Creating...</span>
                    </div>
                  </Show>
                </Button>
              </div>
            </form>
          </Show>
        </div>

        {/* Help Text */}
        <div class="mt-6 p-4 bg-surface-raised/50 rounded border border-border">
          <p class="text-sm text-text-primary font-medium mb-2">How to find your directory path:</p>
          <ul class="text-sm text-text-muted space-y-1 list-disc list-inside">
            <li>
              <strong>macOS/Linux:</strong> Open Terminal, navigate to your project folder, and run{" "}
              <code class="px-1 py-0.5 bg-surface rounded text-xs">pwd</code>
            </li>
            <li>
              <strong>Windows:</strong> Open your project folder in File Explorer, click the address bar, and copy the
              path
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSetup;
