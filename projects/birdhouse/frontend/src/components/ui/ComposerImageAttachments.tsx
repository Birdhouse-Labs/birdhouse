// ABOUTME: Thumbnail strip for pasted composer images in new-agent and reply flows.
// ABOUTME: Supports hover remove controls and click-to-preview modal behavior.

import { X } from "lucide-solid";
import { type Component, createSignal, For, Show } from "solid-js";
import type { ComposerImageAttachment } from "../../types/composer-attachments";
import ImagePreviewDialog from "./ImagePreviewDialog";

export interface ComposerImageAttachmentsProps {
  attachments: ComposerImageAttachment[];
  onRemove: (id: string) => void;
}

const ComposerImageAttachments: Component<ComposerImageAttachmentsProps> = (props) => {
  const [selectedAttachment, setSelectedAttachment] = createSignal<ComposerImageAttachment | null>(null);

  return (
    <Show when={props.attachments.length > 0}>
      <div>
        <div class="flex flex-wrap gap-2 pt-2">
          <For each={props.attachments}>
            {(attachment) => (
              <div class="relative group">
                <button
                  type="button"
                  class="block rounded-lg overflow-hidden border border-border bg-surface-raised hover:border-accent/50 transition-colors"
                  onClick={() => setSelectedAttachment(attachment)}
                  aria-label={`Open image preview for ${attachment.filename}`}
                >
                  <img src={attachment.url} alt={attachment.filename} class="w-16 h-16 object-cover" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onRemove(attachment.id);
                  }}
                  class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface-raised border border-border shadow-sm flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Remove ${attachment.filename}`}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </For>
        </div>

        <ImagePreviewDialog
          open={selectedAttachment() !== null}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedAttachment(null);
            }
          }}
          src={selectedAttachment()?.url}
          alt={selectedAttachment()?.filename}
        />
      </div>
    </Show>
  );
};

export default ComposerImageAttachments;
