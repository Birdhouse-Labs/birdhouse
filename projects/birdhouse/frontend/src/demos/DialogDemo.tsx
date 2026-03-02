// ABOUTME: Dialog demo component showing modal dialog with overlay
// ABOUTME: Demonstrates corvu Dialog with focus management and accessibility

import Dialog from "corvu/dialog";
import type { Component } from "solid-js";
import { Button } from "../components/ui";
import { cardSurfaceFlat } from "../styles/containerStyles";

const DialogDemo: Component = () => {
  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Dialog</h2>
        <p class="text-sm text-text-secondary hidden md:block">Modal dialogs with focus management</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        <Dialog>
          <Dialog.Trigger as={Button} variant="primary">
            Open Dialog
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <Dialog.Content
              class={`fixed left-1/2 top-1/2 z-50 w-full max-w-md rounded-2xl p-6 border shadow-2xl -translate-x-1/2 -translate-y-1/2 ${cardSurfaceFlat}`}
            >
              <Dialog.Label class="text-2xl font-bold mb-2 text-heading">Welcome!</Dialog.Label>
              <Dialog.Description class="mb-6 text-text-secondary">
                This is a beautiful dialog component powered by corvu. It handles focus management, keyboard navigation,
                and accessibility out of the box.
              </Dialog.Description>
              <div class="flex gap-3 justify-end">
                <Dialog.Close as={Button} variant="secondary">
                  Cancel
                </Dialog.Close>
                <Dialog.Close as={Button} variant="primary">
                  Continue
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      </div>
    </div>
  );
};

export default DialogDemo;
