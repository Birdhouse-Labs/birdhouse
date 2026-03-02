// ABOUTME: Dialog for displaying markdown content with copy functionality
// ABOUTME: Used for viewing agent prompts/messages in a full-screen modal

import Dialog from "corvu/dialog";
import { type Component, Show } from "solid-js";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useZIndex } from "../../contexts/ZIndexContext";
import { borderColor, cardSurfaceFlat } from "../../styles/containerStyles";
import { MarkdownRenderer } from "../MarkdownRenderer";
import CopyButton from "./CopyButton";

export interface MarkdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
}

const MarkdownDialog: Component<MarkdownDialogProps> = (props) => {
  const { workspaceId } = useWorkspace();
  const baseZIndex = useZIndex();

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} preventScroll={false} restoreScrollPosition={false}>
      <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ "z-index": baseZIndex }} />
        <Dialog.Content
          class={`fixed rounded-2xl ${cardSurfaceFlat} shadow-2xl
                 w-[95vw] h-[95dvh] max-w-4xl
                 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                 flex flex-col
                 md:w-[90vw] md:h-[90dvh]`}
          style={{ "z-index": baseZIndex }}
        >
          {/* Header */}
          <div class={`flex items-center justify-between px-6 py-3 border-b ${borderColor} flex-shrink-0`}>
            <Dialog.Label class="text-lg font-semibold text-heading">{props.title}</Dialog.Label>
            <div class="flex items-center gap-2">
              <CopyButton text={props.content} />
              <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors focus:outline-none rounded p-1 w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span class="text-xl leading-none select-none">×</span>
              </Dialog.Close>
            </div>
          </div>

          {/* Content - scrollable markdown */}
          <div class="flex-1 overflow-auto p-6">
            <Show
              when={props.content && props.content.trim().length > 0}
              fallback={<div class="text-text-muted text-center py-12">No content to display</div>}
            >
              <MarkdownRenderer content={props.content} workspaceId={workspaceId} />
            </Show>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default MarkdownDialog;
