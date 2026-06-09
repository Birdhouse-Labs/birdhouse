// ABOUTME: Inline file reference button with an instant tooltip for the resolved local path.
// ABOUTME: Reuses Birdhouse reference styling while opening the shared file viewer on click.

import Tooltip from "corvu/tooltip";
import { type Component, createMemo } from "solid-js";
import { useZIndex } from "../../contexts/ZIndexContext";
import { resolveWorkspaceFilePath } from "../../file-viewer/utils/paths";

export interface FileReferenceButtonProps {
  label: string;
  path: string;
  line: number | null;
  workspaceDirectory?: string;
  onClick: (target: { path: string; line: number | null }) => void;
}

export const FileReferenceButton: Component<FileReferenceButtonProps> = (props) => {
  const baseZIndex = useZIndex();
  const resolvedPath = createMemo(() => {
    if (props.path.startsWith("/") || !props.workspaceDirectory) {
      return props.path;
    }

    try {
      return resolveWorkspaceFilePath(props.workspaceDirectory, props.path);
    } catch {
      return props.path;
    }
  });
  const tooltipText = createMemo(() => (props.line === null ? resolvedPath() : `${resolvedPath()}#L${props.line}`));

  return (
    <Tooltip openDelay={0} closeDelay={0} openOnFocus={false} placement="top">
      <Tooltip.Trigger
        as="button"
        type="button"
        class="agent-btn inline-flex items-center gap-1 rounded font-medium cursor-pointer no-underline"
        onClick={() => props.onClick({ path: props.path, line: props.line })}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          width="16"
          height="16"
          class="lucide lucide-file-text"
          aria-hidden="true"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
        <span>{props.label}</span>
        {props.line !== null && <span class="font-mono text-[0.85em]">#L{props.line}</span>}
      </Tooltip.Trigger>

      <Tooltip.Portal>
        <Tooltip.Content
          class="z-50 max-w-[min(80vw,48rem)] break-all rounded-lg border border-border bg-surface-overlay px-3 py-2 text-xs text-text-primary shadow-xl"
          style={{ "z-index": baseZIndex }}
        >
          {tooltipText()}
          <Tooltip.Arrow style={{ color: "var(--color-surface-overlay)" }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip>
  );
};

export default FileReferenceButton;
