// ABOUTME: Health status display for workspace with gear icon for config
// ABOUTME: Shows online/offline status with tooltip details, gear opens config dialog

import Popover from "corvu/popover";
import { Settings } from "lucide-solid";
import { type Component, createSignal } from "solid-js";
import { useZIndex } from "../contexts/ZIndexContext";
import type { WorkspaceHealthStatus as HealthStatus } from "../types/workspace";
import IconButton from "./ui/IconButton";

export interface WorkspaceHealthStatusProps {
  workspaceId: string;
  health: HealthStatus | null;
  isChecking: boolean;
  onEditConfig: () => void;
}

const WorkspaceHealthStatus: Component<WorkspaceHealthStatusProps> = (props) => {
  const baseZIndex = useZIndex();
  const [isTooltipOpen, setIsTooltipOpen] = createSignal(false);

  // Format "X seconds ago" text
  const formatLastChecked = (timestamp: number): string => {
    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
    if (secondsAgo < 5) return "just now";
    if (secondsAgo < 60) return `${secondsAgo} seconds ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo === 1) return "1 minute ago";
    if (minutesAgo < 60) return `${minutesAgo} minutes ago`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo === 1) return "1 hour ago";
    return `${hoursAgo} hours ago`;
  };

  // Build tooltip content
  const tooltipContent = (): string => {
    if (!props.health) {
      return "Status: Checking...";
    }

    const lines: string[] = [];
    lines.push(`Status: ${props.health.harnessRunning ? "Online" : "Offline"}`);

    if (props.health.harnessRunning) {
      if (props.health.port !== null) {
        lines.push(`Port: ${props.health.port}`);
      }

      if (props.health.pid !== null) {
        lines.push(`PID: ${props.health.pid}`);
      }
    } else if (props.health.error) {
      lines.push(`Error: ${props.health.error}`);
    }

    lines.push(`Last checked: ${formatLastChecked(props.health.lastChecked)}`);

    return lines.join("\n");
  };

  // Inline status text
  const statusText = () => {
    if (props.isChecking && !props.health) {
      return "Checking...";
    }

    if (!props.health) {
      return "Unknown";
    }

    if (props.health.harnessRunning) {
      return "Online";
    }

    return "Offline";
  };

  // Status color classes
  const statusColorClass = () => {
    if (props.isChecking && !props.health) {
      return "text-text-muted";
    }

    if (!props.health) {
      return "text-text-muted";
    }

    return props.health.harnessRunning ? "text-success" : "text-danger";
  };

  return (
    <div class="flex items-center gap-2">
      {/* Status with tooltip */}
      <Popover open={isTooltipOpen()} onOpenChange={setIsTooltipOpen}>
        <Popover.Trigger
          as="span"
          class="text-xs cursor-help"
          classList={{ [statusColorClass()]: true }}
          onMouseEnter={() => setIsTooltipOpen(true)}
          onMouseLeave={() => setIsTooltipOpen(false)}
        >
          ● {statusText()}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            class="px-3 py-2 rounded-lg border border-border shadow-lg bg-surface-raised max-w-xs"
            style={{ "z-index": baseZIndex }}
          >
            <pre class="text-xs text-text-primary whitespace-pre-wrap font-mono">{tooltipContent()}</pre>
          </Popover.Content>
        </Popover.Portal>
      </Popover>

      {/* Gear icon - opens config dialog via URL routing */}
      <IconButton
        icon={<Settings size={14} />}
        variant="ghost"
        aria-label="Edit configuration"
        fixedSize
        class="w-5 h-5"
        onClick={props.onEditConfig}
      />
    </div>
  );
};

export default WorkspaceHealthStatus;
