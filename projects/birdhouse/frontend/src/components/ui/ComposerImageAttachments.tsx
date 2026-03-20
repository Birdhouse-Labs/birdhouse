// ABOUTME: Attachment strip for pasted and dropped composer files in new-agent and reply flows.
// ABOUTME: Supports image previews, PDF tiles, and hover remove controls.

import { FileText, Trash2, X } from "lucide-solid";
import { type Component, createSignal, For, Show } from "solid-js";
import type { ComposerAttachment } from "../../types/composer-attachments";
import Button from "./Button";
import ImagePreviewDialog from "./ImagePreviewDialog";

export interface ComposerImageAttachmentsProps {
  attachments: ComposerAttachment[];
  onRemove: (id: string) => void;
}

const ComposerImageAttachments: Component<ComposerImageAttachmentsProps> = (props) => {
  const [selectedAttachment, setSelectedAttachment] = createSignal<ComposerAttachment | null>(null);

  const handleRemoveSelectedAttachment = () => {
    const attachment = selectedAttachment();
    if (!attachment) return;

    props.onRemove(attachment.id);
    setSelectedAttachment(null);
  };

  const isImageAttachment = (attachment: ComposerAttachment) => attachment.mime.startsWith("image/");

  return (
    <Show when={props.attachments.length > 0}>
      <div>
        <div class="flex flex-wrap gap-2 pt-2">
          <For each={props.attachments}>
            {(attachment) => (
              <div class="relative group">
                <Show
                  when={isImageAttachment(attachment)}
                  fallback={
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open PDF ${attachment.filename}`}
                      class="flex h-16 w-36 items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 text-left text-text-primary hover:border-accent/50 transition-colors"
                    >
                      <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent flex-shrink-0">
                        <FileText size={18} />
                      </div>
                      <div class="min-w-0">
                        <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">PDF</div>
                        <div class="truncate text-sm">{attachment.filename}</div>
                      </div>
                    </a>
                  }
                >
                  <button
                    type="button"
                    class="block rounded-lg overflow-hidden border border-border bg-surface-raised hover:border-accent/50 transition-colors"
                    onClick={() => setSelectedAttachment(attachment)}
                    aria-label={`Open image preview for ${attachment.filename}`}
                  >
                    <img src={attachment.url} alt={attachment.filename} class="w-16 h-16 object-cover" />
                  </button>
                </Show>
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
          action={
            <Button variant="tertiary" leftIcon={<Trash2 size={16} />} onClick={handleRemoveSelectedAttachment}>
              Remove
            </Button>
          }
        />
      </div>
    </Show>
  );
};

export default ComposerImageAttachments;
