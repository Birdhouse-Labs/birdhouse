// ABOUTME: Generic dialog for displaying content in a syntax-highlighted code block
// ABOUTME: Reusable modal for showing full tool outputs, input parameters, or any formatted text

import Dialog from "corvu/dialog";
import { type Component, createMemo, Show, Suspense } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { borderColor, cardSurface, cardSurfaceFlat } from "../../styles/containerStyles";
import { codeTheme, isDark } from "../../theme";
import { resolveCodeTheme } from "../../theme/codeThemes";
import CodeBlockContainer from "./CodeBlockContainer";

export interface ContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  language?: string;
}

const ContentDialog: Component<ContentDialogProps> = (props) => {
  const baseZIndex = useZIndex();
  const resolvedTheme = createMemo(() => resolveCodeTheme(codeTheme(), isDark()));

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      // Disable closeOnOutsideFocus because CodeBlockContainer's fallback copy method
      // creates a temporary textarea and calls focus() on it (required for execCommand
      // copy on iOS). This focus event outside Dialog.Content would otherwise dismiss
      // the dialog. See CodeBlockContainer.tsx:38-41
      closeOnOutsideFocus={false}
      // Disable scroll management - our scroll container is internal, not body
      // Corvu's scroll lock and restoration targets <body>, but our messages scroll
      // in an internal div. The scroll lock was causing the internal container to
      // reset to top when the dialog opened.
      preventScroll={false}
      restoreScrollPosition={false}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ "z-index": baseZIndex }} />
        <Dialog.Content
          class={`fixed rounded-2xl ${cardSurfaceFlat} shadow-2xl
                 w-[95vw] h-[95dvh] max-w-6xl
                 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                 flex flex-col
                 md:w-[90vw] md:h-[90dvh]`}
          style={{ "z-index": baseZIndex }}
        >
          {/* Header */}
          <div class={`flex items-center justify-between px-6 py-3 border-b ${borderColor} flex-shrink-0`}>
            <Dialog.Label class="text-lg font-semibold text-heading">{props.title}</Dialog.Label>
            <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors focus:outline-none rounded p-1 w-8 h-8 flex items-center justify-center flex-shrink-0">
              <span class="text-xl leading-none select-none">×</span>
            </Dialog.Close>
          </div>

          {/* Content - scrollable code block */}
          <div class="flex-1 overflow-auto pb-4 rounded-b-2xl">
            <Show
              when={props.content && props.content.trim().length > 0}
              fallback={<div class="text-text-muted text-center py-12">No content to display</div>}
            >
              <Suspense
                fallback={
                  <div class={`rounded ${cardSurface} overflow-hidden`}>
                    <div class="h-24 bg-surface-raised animate-pulse" />
                  </div>
                }
              >
                <CodeBlockContainer
                  code={props.content}
                  language={props.language || "text"}
                  theme={resolvedTheme()}
                  showCopyButton={true}
                />
              </Suspense>
            </Show>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default ContentDialog;
