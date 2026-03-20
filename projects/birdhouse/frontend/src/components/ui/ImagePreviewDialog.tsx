// ABOUTME: Modal dialog for viewing image attachments at a larger size.
// ABOUTME: Shared by composer previews and sent message attachment rendering.

import Dialog from "corvu/dialog";
import { type Component, type JSX, Show } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";

export interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src?: string | undefined;
  alt?: string | undefined;
  action?: JSX.Element | undefined;
}

const ImagePreviewDialog: Component<ImagePreviewDialogProps> = (props) => {
  const baseZIndex = useZIndex();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} preventScroll={false} restoreScrollPosition={false}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/70 backdrop-blur-sm" style={{ "z-index": baseZIndex }} />
        <Dialog.Content
          class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-5xl max-h-[90dvh] rounded-2xl bg-surface-raised border border-border shadow-2xl overflow-hidden"
          style={{ "z-index": baseZIndex }}
        >
          <div class="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-raised">
            <Dialog.Label class="text-sm font-medium text-text-primary truncate">
              {props.alt || "Image preview"}
            </Dialog.Label>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors focus:outline-none rounded p-1 w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span class="text-xl leading-none select-none">×</span>
            </Dialog.Close>
          </div>
          <div class="flex items-center justify-center bg-surface p-4 max-h-[calc(90dvh-57px)] overflow-auto">
            <Show when={props.src}>
              <img
                src={props.src}
                alt={props.alt || "Image preview"}
                class="max-w-full max-h-[calc(90dvh-89px)] object-contain rounded-xl"
              />
            </Show>
          </div>
          <Show when={props.action}>
            <div class="flex justify-end px-4 py-3 border-t border-border bg-surface-raised">{props.action}</div>
          </Show>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default ImagePreviewDialog;
