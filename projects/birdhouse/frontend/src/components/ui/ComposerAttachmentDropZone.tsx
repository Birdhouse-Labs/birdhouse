// ABOUTME: Wraps composer surfaces with drag-and-drop affordances for file attachments.
// ABOUTME: Shows active drop styling and inline validation errors without changing input layout.

import { Upload } from "lucide-solid";
import { type Component, createMemo, createSignal, type JSX, Show } from "solid-js";

export interface ComposerAttachmentDropZoneProps {
  children: JSX.Element;
  onAttachmentsAdded?: ((files: File[]) => void | Promise<void>) | undefined;
  error?: string | null | undefined;
  disabled?: boolean | undefined;
}

function hasFilePayload(dataTransfer: DataTransfer | null | undefined): boolean {
  return Array.from(dataTransfer?.types || []).includes("Files");
}

const ComposerAttachmentDropZone: Component<ComposerAttachmentDropZoneProps> = (props) => {
  const [dragDepth, setDragDepth] = createSignal(0);

  const isActive = createMemo(() => dragDepth() > 0);

  const handleDragEnter = (event: DragEvent & { currentTarget: HTMLFieldSetElement }) => {
    if (props.disabled || !hasFilePayload(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragDepth((current) => current + 1);
  };

  const handleDragOver = (event: DragEvent & { currentTarget: HTMLFieldSetElement }) => {
    if (props.disabled || !hasFilePayload(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (event: DragEvent & { currentTarget: HTMLFieldSetElement }) => {
    if (props.disabled || !hasFilePayload(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragDepth((current) => Math.max(0, current - 1));
  };

  const handleDrop = (event: DragEvent & { currentTarget: HTMLFieldSetElement }) => {
    if (props.disabled || !hasFilePayload(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragDepth(0);

    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length === 0) {
      return;
    }

    void props.onAttachmentsAdded?.(files);
  };

  return (
    <div>
      <fieldset
        data-testid="composer-attachment-drop-zone"
        aria-label="Composer attachment drop zone"
        class="relative rounded-xl border border-transparent transition-colors duration-150"
        classList={{
          "border-accent/50 bg-accent/5": isActive(),
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {props.children}
        <Show when={isActive()}>
          <div class="pointer-events-none absolute inset-0 rounded-xl border-2 border-dashed border-accent/60 bg-accent/5">
            <div class="flex h-full items-center justify-center p-4">
              <div class="flex items-center gap-2 rounded-lg border border-accent/30 bg-surface-raised/95 px-3 py-2 text-sm text-text-primary shadow-lg">
                <Upload size={16} class="text-accent" />
                <span>Drop images or PDFs to attach</span>
              </div>
            </div>
          </div>
        </Show>
      </fieldset>
      <Show when={props.error}>
        <div role="alert" class="mt-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {props.error}
        </div>
      </Show>
    </div>
  );
};

export default ComposerAttachmentDropZone;
