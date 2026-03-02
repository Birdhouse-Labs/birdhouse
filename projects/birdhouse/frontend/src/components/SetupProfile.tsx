// ABOUTME: First-launch welcome screen at /setup/profile — collects the user's display name
// ABOUTME: Shown once before accessing the app; redirects to workspace selector on submit

import { useNavigate, useSearchParams } from "@solidjs/router";
import { type Component, createSignal, Show } from "solid-js";
import { submitUserName } from "../services/user-profile-api";
import Button from "./ui/Button";

const REDIRECT_KEY = "birdhouse.setup.redirect";

const SetupProfile: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = createSignal("");
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const redirectParam = () => searchParams["redirect"] as string | undefined;

  const handleSubmit = async () => {
    const trimmedName = name().trim();

    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await submitUserName(trimmedName);

      const redirect = redirectParam() ?? sessionStorage.getItem(REDIRECT_KEY);
      sessionStorage.removeItem(REDIRECT_KEY);
      navigate(redirect ?? "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="min-h-screen overflow-auto p-8 bg-gradient-to-br from-bg-from via-bg-via to-bg-to flex items-center justify-center">
      <div class="w-full max-w-lg">
        <div class="mb-8 text-center">
          <h1 class="text-4xl font-bold text-text-primary mb-3">Welcome to Birdhouse</h1>
          <p class="text-lg text-text-muted">Where your agents work as a team</p>
        </div>

        <div class="p-8 bg-surface-raised rounded-lg border border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            class="space-y-6"
          >
            <div>
              <label for="name-input" class="block text-sm font-medium text-text-primary mb-2">
                What should we call you?
              </label>
              <input
                id="name-input"
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Jillian"
                class="w-full px-4 py-3 bg-surface border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                autofocus
              />
            </div>

            <Show when={error()}>
              <div class="p-3 bg-danger/10 border border-danger rounded">
                <p class="text-sm text-danger">{error()}</p>
              </div>
            </Show>

            <Button variant="primary" disabled={isSubmitting()} onClick={handleSubmit} class="w-full">
              <Show when={isSubmitting()} fallback="Get Started">
                Saving...
              </Show>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetupProfile;
