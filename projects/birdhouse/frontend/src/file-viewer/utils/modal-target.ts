// ABOUTME: Converts parsed local file links into modal ids and back for routed file viewer dialogs.
// ABOUTME: Keeps markdown click handling and modal restoration aligned on one file target format.

import { parseLocalFileLinkTarget, type LocalFileLinkTarget } from "./link-targets";

export const FILE_VIEWER_MODAL_TYPE = "file-viewer";

export function buildFileViewerModalId(target: LocalFileLinkTarget): string {
  return target.line === null ? target.path : `${target.path}#L${target.line}`;
}

export function parseFileViewerModalId(modalId: string): LocalFileLinkTarget | null {
  return parseLocalFileLinkTarget(modalId);
}
