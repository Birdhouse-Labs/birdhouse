// ABOUTME: Confirmation dialog for discarding unsaved changes
// ABOUTME: Warns user before closing config dialog with unsaved provider or MCP changes

import Dialog from "corvu/dialog";
import type { Component } from "solid-js";
import { Button } from "../../components/ui";

export interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}

const UnsavedChangesDialog: Component<UnsavedChangesDialogProps> = (props) => {
  const handleDiscard = () => {
    props.onDiscard();
  };

  const handleCancel = () => {
    props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content class="fixed left-1/2 top-1/2 z-50 w-full max-w-md rounded-2xl p-6 border shadow-2xl -translate-x-1/2 -translate-y-1/2 bg-surface-raised border-border">
          <div class="flex items-center justify-between mb-2">
            <Dialog.Label class="text-2xl font-bold text-heading">Unsaved Changes</Dialog.Label>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors focus:outline-none rounded p-1 w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span class="text-xl leading-none select-none">×</span>
            </Dialog.Close>
          </div>
          <Dialog.Description class="mb-6 text-text-secondary">
            You have unsaved changes to your workspace configuration. If you close now, these changes will be lost.
          </Dialog.Description>

          {/* Actions */}
          <div class="flex gap-3 justify-end">
            <Button variant="secondary" onClick={handleCancel}>
              Keep Editing
            </Button>
            <Button variant="danger" onClick={handleDiscard}>
              Discard Changes
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default UnsavedChangesDialog;
