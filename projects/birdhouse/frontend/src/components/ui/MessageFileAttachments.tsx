// ABOUTME: Renders sent file parts as attachment thumbnails or file pills inside message bubbles.
// ABOUTME: Keeps pasted images visible after send and supports click-to-preview for images.

import { FileText } from "lucide-solid";
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import type { FileBlock } from "../../types/messages";
import ImagePreviewDialog from "./ImagePreviewDialog";

export interface MessageFileAttachmentsProps {
  attachments: FileBlock[];
}

const MessageFileAttachments: Component<MessageFileAttachmentsProps> = (props) => {
  const [selectedAttachment, setSelectedAttachment] = createSignal<FileBlock | null>(null);

  const imageAttachments = createMemo(() =>
    props.attachments.filter((attachment) => attachment.mimeType.startsWith("image/")),
  );
  const pdfAttachments = createMemo(() =>
    props.attachments.filter((attachment) => attachment.mimeType === "application/pdf"),
  );
  const otherAttachments = createMemo(() =>
    props.attachments.filter(
      (attachment) => !attachment.mimeType.startsWith("image/") && attachment.mimeType !== "application/pdf",
    ),
  );

  return (
    <Show when={props.attachments.length > 0}>
      <div class="pt-1">
        <div class="flex flex-wrap gap-2 mb-3">
          <For each={imageAttachments()}>
            {(attachment) => (
              <button
                type="button"
                class="block rounded-xl overflow-hidden border border-border bg-surface-raised hover:border-accent/50 transition-colors"
                onClick={() => setSelectedAttachment(attachment)}
                aria-label={`Open attachment ${attachment.filename || "image attachment"}`}
              >
                <img
                  src={attachment.url}
                  alt={attachment.filename || "Image attachment"}
                  class="w-24 h-24 object-cover"
                />
              </button>
            )}
          </For>

          <For each={pdfAttachments()}>
            {(attachment) => (
              <fieldset
                aria-label={`PDF attachment ${attachment.filename || "attachment"}`}
                class="flex min-w-44 items-center gap-3 rounded-xl border border-border bg-surface-raised px-3 py-3 text-sm text-text-primary"
              >
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <FileText size={18} />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">PDF</div>
                  <div class="truncate">{attachment.filename || "PDF attachment"}</div>
                  <div class="text-xs text-text-muted">Preview unavailable in this browser</div>
                </div>
              </fieldset>
            )}
          </For>

          <For each={otherAttachments()}>
            {(attachment) => (
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                class="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary hover:border-accent/50 transition-colors"
              >
                <FileText size={16} class="text-text-secondary" />
                <span class="truncate max-w-48">{attachment.filename || attachment.mimeType}</span>
              </a>
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

export default MessageFileAttachments;
