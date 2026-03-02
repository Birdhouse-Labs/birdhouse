// ABOUTME: Checkbox demo showing various states and usage patterns
// ABOUTME: Demonstrates checked/unchecked, disabled states, and keyboard interaction

import { type Component, createSignal } from "solid-js";
import { Checkbox } from "../components/ui";
import { cardSurfaceFlat } from "../styles/containerStyles";

const CheckboxDemo: Component = () => {
  const [termsAccepted, setTermsAccepted] = createSignal(false);
  const [newsletterEnabled, setNewsletterEnabled] = createSignal(true);
  const [updatesEnabled, setUpdatesEnabled] = createSignal(false);
  const [featureEnabled, setFeatureEnabled] = createSignal(false);

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Checkbox</h2>
        <p class="text-sm text-text-secondary hidden md:block">
          Simple checkbox with keyboard support and theme integration
        </p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Interactive Examples */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Interactive Examples</h3>
          <div class={`rounded-xl ${cardSurfaceFlat} p-6 space-y-4`}>
            <Checkbox checked={termsAccepted()} onChange={setTermsAccepted} label="I accept the terms and conditions" />
            <Checkbox checked={newsletterEnabled()} onChange={setNewsletterEnabled} label="Subscribe to newsletter" />
            <Checkbox checked={updatesEnabled()} onChange={setUpdatesEnabled} label="Receive product updates" />
            <Checkbox checked={featureEnabled()} onChange={setFeatureEnabled} label="Enable experimental features" />
          </div>
        </div>

        {/* States Grid */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Component States</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Unchecked */}
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-3`}>
              <h4 class="font-medium text-accent">Unchecked</h4>
              <Checkbox checked={false} onChange={() => {}} label="Default unchecked state" />
              <p class="text-xs text-text-muted">Basic unchecked checkbox with border</p>
            </div>

            {/* Checked */}
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-3`}>
              <h4 class="font-medium text-accent">Checked</h4>
              <Checkbox checked={true} onChange={() => {}} label="Default checked state" />
              <p class="text-xs text-text-muted">Checked state with accent background and checkmark</p>
            </div>

            {/* Disabled Unchecked */}
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-3`}>
              <h4 class="font-medium text-accent">Disabled (Unchecked)</h4>
              <Checkbox checked={false} onChange={() => {}} label="Disabled unchecked state" disabled={true} />
              <p class="text-xs text-text-muted">Reduced opacity with cursor-not-allowed</p>
            </div>

            {/* Disabled Checked */}
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-3`}>
              <h4 class="font-medium text-accent">Disabled (Checked)</h4>
              <Checkbox checked={true} onChange={() => {}} label="Disabled checked state" disabled={true} />
              <p class="text-xs text-text-muted">Checked state with disabled styling</p>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Features</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Keyboard Support</h4>
              <p class="text-sm text-text-secondary">Space and Enter keys toggle the checkbox when focused</p>
            </div>
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Accessibility</h4>
              <p class="text-sm text-text-secondary">
                Native HTML checkbox with proper ARIA attributes and label association
              </p>
            </div>
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Theme Integration</h4>
              <p class="text-sm text-text-secondary">
                Uses CSS variables for colors - adapts to all themes automatically
              </p>
            </div>
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Focus States</h4>
              <p class="text-sm text-text-secondary">Visible focus ring using accent color for keyboard navigation</p>
            </div>
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Disabled State</h4>
              <p class="text-sm text-text-secondary">Reduced opacity and prevented interactions when disabled</p>
            </div>
            <div class={`rounded-lg ${cardSurfaceFlat} p-4 space-y-2`}>
              <h4 class="font-medium text-accent">Hover Effects</h4>
              <p class="text-sm text-text-secondary">Subtle brightness change on hover for interactive feedback</p>
            </div>
          </div>
        </div>

        {/* Usage Examples */}
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-heading">Usage Examples</h3>
          <div class={`rounded-xl ${cardSurfaceFlat} p-6 space-y-4`}>
            <div>
              <h4 class="font-medium text-heading mb-2">Basic Usage</h4>
              <pre class="text-xs text-text-secondary overflow-x-auto">
                {`const [checked, setChecked] = createSignal(false);

<Checkbox
  checked={checked()}
  onChange={setChecked}
  label="Accept terms"
/>`}
              </pre>
            </div>
            <div>
              <h4 class="font-medium text-heading mb-2">With Custom ID</h4>
              <pre class="text-xs text-text-secondary overflow-x-auto">
                {`<Checkbox
  checked={checked()}
  onChange={setChecked}
  label="Enable feature"
  id="feature-toggle"
/>`}
              </pre>
            </div>
            <div>
              <h4 class="font-medium text-heading mb-2">Disabled State</h4>
              <pre class="text-xs text-text-secondary overflow-x-auto">
                {`<Checkbox
  checked={true}
  onChange={() => {}}
  label="Permanently enabled"
  disabled={true}
/>`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckboxDemo;
