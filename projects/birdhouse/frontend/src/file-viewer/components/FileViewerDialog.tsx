// ABOUTME: Read-only dialog for viewing themed file contents with optional markdown rich/raw modes.
// ABOUTME: Uses the shared markdown renderer and Monaco-based text editor so file previews match the current app theme.

import Dialog from "corvu/dialog";
import { FolderOpen } from "lucide-solid";
import { type Component, createEffect, createMemo, createSignal, Show } from "solid-js";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import CopyButton from "../../components/ui/CopyButton";
import IconButton from "../../components/ui/IconButton";
import TextEditor from "../../components/ui/TextEditor";
import { useZIndex } from "../../contexts/ZIndexContext";
import { borderColor, cardSurfaceFlat } from "../../styles/containerStyles";
import { revealFileViewerPath } from "../services/file-viewer-api";
import type { FileViewerFile } from "../types";
import { getFileNameFromPath } from "../utils/paths";

type MarkdownViewMode = "rich" | "raw";

export interface FileViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: FileViewerFile | null;
  workspaceId?: string;
  workspaceDirectory?: string;
  loading?: boolean;
  error?: string | null;
  requestedPath?: string | null;
  line?: number | null;
  closeOnEscapeKeyDown?: boolean;
  onFileLinkClick?: (target: { path: string; line: number | null }) => void;
}

const FileViewerDialog: Component<FileViewerDialogProps> = (props) => {
  const baseZIndex = useZIndex();
  const [markdownMode, setMarkdownMode] = createSignal<MarkdownViewMode>("rich");
  const [isRevealing, setIsRevealing] = createSignal(false);
  const [revealError, setRevealError] = createSignal<string | null>(null);
  const displayPath = createMemo(() => props.file?.path ?? props.requestedPath ?? null);

  createEffect(() => {
    const open = props.open;
    const file = props.file;

    if (!open) {
      return;
    }

    setRevealError(null);
    setMarkdownMode(file?.isMarkdown && !props.line ? "rich" : "raw");
  });

  const handleReveal = async () => {
    const path = displayPath();
    if (!props.workspaceId || !path || isRevealing()) {
      return;
    }

    setIsRevealing(true);
    setRevealError(null);
    try {
      await revealFileViewerPath(props.workspaceId, path);
    } catch (err) {
      setRevealError(err instanceof Error ? err.message : "Failed to reveal file");
    } finally {
      setIsRevealing(false);
    }
  };

  const title = createMemo(() => props.file?.name ?? (displayPath() ? getFileNameFromPath(displayPath() ?? "") : "File Viewer"));
  const isRichMarkdown = createMemo(() => props.file?.isMarkdown && markdownMode() === "rich");

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      closeOnEscapeKeyDown={props.closeOnEscapeKeyDown ?? true}
      closeOnOutsidePointer={false}
      closeOnOutsideFocus={false}
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
          <div class={`flex items-start justify-between gap-4 px-6 py-3 border-b ${borderColor} flex-shrink-0`}>
            <div class="min-w-0 space-y-1">
              <Dialog.Label class="text-lg font-semibold text-heading break-all">{title()}</Dialog.Label>
              <Show when={displayPath()}>
                <div class="font-mono text-xs text-text-muted break-all">{displayPath()}</div>
              </Show>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <Show when={props.file?.isMarkdown}>
                <div class="flex items-center rounded-lg border border-border overflow-hidden bg-surface">
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm font-medium transition-colors"
                    classList={{
                      "bg-accent text-text-on-accent": markdownMode() === "rich",
                      "text-text-muted hover:text-text-primary": markdownMode() !== "rich",
                    }}
                    aria-pressed={markdownMode() === "rich"}
                    onClick={() => setMarkdownMode("rich")}
                  >
                    Rich
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm font-medium transition-colors"
                    classList={{
                      "bg-accent text-text-on-accent": markdownMode() === "raw",
                      "text-text-muted hover:text-text-primary": markdownMode() !== "raw",
                    }}
                    aria-pressed={markdownMode() === "raw"}
                    onClick={() => setMarkdownMode("raw")}
                  >
                    Raw
                  </button>
                </div>
              </Show>
              <Show when={props.file?.content}>
                <CopyButton text={props.file?.content ?? ""} />
              </Show>
              <Show when={props.workspaceId && displayPath()}>
                <IconButton
                  icon={<FolderOpen size={16} />}
                  variant="ghost"
                  fixedSize={true}
                  disabled={isRevealing()}
                  aria-label="Reveal file in Finder"
                  title="Reveal file in Finder"
                  onClick={() => void handleReveal()}
                />
              </Show>
              <Dialog.Close class="text-text-muted hover:text-text-primary transition-colors focus:outline-none rounded p-1 w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span class="text-xl leading-none select-none">×</span>
              </Dialog.Close>
            </div>
          </div>

          <div
            class="flex-1 overflow-auto rounded-b-2xl"
            classList={{
              "p-6": !!isRichMarkdown(),
            }}
          >
            <Show when={revealError()}>
              <div class="m-6 rounded-lg border border-danger bg-danger/10 p-3 text-sm text-danger">
                {revealError()}
              </div>
            </Show>
            <Show when={!props.loading} fallback={<div class="text-text-muted text-center py-12">Loading file...</div>}>
              <Show when={!props.error} fallback={<div class="text-danger text-center py-12">{props.error}</div>}>
                <Show
                  when={props.file?.content?.trim().length}
                  fallback={<div class="text-text-muted text-center py-12">No content to display</div>}
                >
                  <Show
                    when={props.file?.isMarkdown && markdownMode() === "rich"}
                    fallback={
                      <div class="h-full overflow-hidden">
                        <TextEditor
                          value={props.file?.content ?? ""}
                          onInput={() => {}}
                          language={props.file?.language || "text"}
                          disabled={true}
                          chrome={false}
                          height="100%"
                          class="h-full"
                          ariaLabel={`${title()} raw file content`}
                          revealLineNumber={props.line ?? null}
                          options={{ wordWrap: "off" }}
                        />
                      </div>
                    }
                  >
                    <div class="rounded-xl border border-border-muted/70 bg-surface-overlay/40 p-6">
                      <MarkdownRenderer
                        content={props.file?.content ?? ""}
                        {...(props.workspaceId ? { workspaceId: props.workspaceId } : {})}
                        {...(props.workspaceDirectory ? { workspaceDirectory: props.workspaceDirectory } : {})}
                        {...(props.onFileLinkClick ? { onFileLinkClick: props.onFileLinkClick } : {})}
                      />
                    </div>
                  </Show>
                </Show>
              </Show>
            </Show>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
};

export default FileViewerDialog;
