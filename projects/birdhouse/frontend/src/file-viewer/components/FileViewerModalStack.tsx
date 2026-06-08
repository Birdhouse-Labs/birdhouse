// ABOUTME: Restores routed file viewer dialogs from the shared modal query stack.
// ABOUTME: Resolves workspace-relative file targets, fetches viewer content, and preserves stacked modal state.

import { type Accessor, type Component, createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { ZIndexProvider } from "../../contexts/ZIndexContext";
import { type ModalState, useModalRoute } from "../../lib/routing";
import { fetchFileViewerContent } from "../services/file-viewer-api";
import type { FileViewerFile } from "../types";
import { buildFileViewerModalId, FILE_VIEWER_MODAL_TYPE, parseFileViewerModalId } from "../utils/modal-target";
import { resolveWorkspaceFilePath } from "../utils/paths";
import FileViewerDialog from "./FileViewerDialog";

interface FileViewerModalStackProps {
  workspaceId: string;
  workspaceDirectory?: string | undefined;
}

interface FileViewerModalNodeProps {
  stack: Accessor<ModalState[]>;
  index: number;
  workspaceId: string;
  workspaceDirectory?: string | undefined;
  onClose: () => void;
  onOpenFileModal: (target: { path: string; line: number | null }) => void;
}

const FILE_VIEWER_BASE_Z_INDEX = 150;

const FileViewerModalNode: Component<FileViewerModalNodeProps> = (props) => {
  const modal = createMemo(() => props.stack()[props.index]);
  const target = createMemo(() => {
    const currentModal = modal();
    return currentModal ? parseFileViewerModalId(currentModal.id) : null;
  });

  const resolvedPath = createMemo(() => {
    const currentTarget = target();
    if (!currentTarget) {
      return null;
    }

    if (currentTarget.path.startsWith("/")) {
      return currentTarget.path;
    }

    if (!props.workspaceDirectory) {
      return null;
    }

    return resolveWorkspaceFilePath(props.workspaceDirectory, currentTarget.path);
  });

  const [file, setFile] = createSignal<FileViewerFile | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const currentTarget = target();
    const currentResolvedPath = resolvedPath();

    if (!currentTarget) {
      setFile(null);
      setLoading(false);
      setError("Invalid local file link target");
      return;
    }

    if (!currentResolvedPath) {
      setFile(null);
      setLoading(true);
      setError(null);
      return;
    }

    let cancelled = false;
    setFile(null);
    setLoading(true);
    setError(null);

    void fetchFileViewerContent(props.workspaceId, currentResolvedPath)
      .then((nextFile) => {
        if (cancelled) {
          return;
        }

        setFile(nextFile);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load file");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    onCleanup(() => {
      cancelled = true;
    });
  });

  const baseZIndex = FILE_VIEWER_BASE_Z_INDEX + props.index * 10;

  return (
    <Show when={modal()} keyed>
      {(currentModal) => (
        <ZIndexProvider baseZIndex={baseZIndex}>
          <FileViewerDialog
            open={true}
            onOpenChange={(open) => {
              if (!open && props.index === props.stack().length - 1) {
                props.onClose();
              }
            }}
            closeOnEscapeKeyDown={props.index === props.stack().length - 1}
            file={file()}
            workspaceId={props.workspaceId}
            loading={loading()}
            error={error()}
            requestedPath={resolvedPath() ?? target()?.path ?? null}
            line={target()?.line ?? null}
            onFileLinkClick={props.onOpenFileModal}
          />
          <FileViewerModalNode
            stack={props.stack}
            index={props.index + 1}
            workspaceId={props.workspaceId}
            workspaceDirectory={props.workspaceDirectory}
            onClose={props.onClose}
            onOpenFileModal={props.onOpenFileModal}
          />
        </ZIndexProvider>
      )}
    </Show>
  );
};

const FileViewerModalStack: Component<FileViewerModalStackProps> = (props) => {
  const { modalStack, closeModal, openModal } = useModalRoute();
  const fileModalStack = createMemo(() => modalStack().filter((modal) => modal.type === FILE_VIEWER_MODAL_TYPE));

  return (
    <FileViewerModalNode
      stack={fileModalStack}
      index={0}
      workspaceId={props.workspaceId}
      workspaceDirectory={props.workspaceDirectory}
      onClose={closeModal}
      onOpenFileModal={(target) => openModal(FILE_VIEWER_MODAL_TYPE, buildFileViewerModalId(target))}
    />
  );
};

export default FileViewerModalStack;
