// ABOUTME: Renders todowrite and todoread tool calls with progressive disclosure
// ABOUTME: Shows task count, status breakdown, and expandable task list with status indicators

import { AlertCircle, CheckCircle2, CheckSquare, ChevronDown, ChevronUp, Loader } from "lucide-solid";
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import type { ToolBlock } from "../../../types/messages";

export interface TaskToolCardProps {
  block: ToolBlock;
}

// Task interface matching todowrite/todoread schema
interface Task {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
}

const TaskToolCard: Component<TaskToolCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const isTodoWrite = () => props.block.name === "todowrite";
  const isTodoRead = () => props.block.name === "todoread";

  // ============================================================================
  // Parse tasks from input or output
  // ============================================================================

  const tasks = createMemo<Task[]>(() => {
    try {
      // For todowrite, tasks are in input
      if (isTodoWrite() && props.block.input["todos"]) {
        const todos = props.block.input["todos"] as Task[];
        return Array.isArray(todos) ? todos : [];
      }

      // For todoread, tasks are in output (JSON string)
      if (isTodoRead() && props.block.output) {
        const parsed = JSON.parse(props.block.output);
        if (parsed.todos && Array.isArray(parsed.todos)) {
          return parsed.todos as Task[];
        }
      }

      return [];
    } catch (_error) {
      return [];
    }
  });

  // ============================================================================
  // Status counting and breakdown
  // ============================================================================

  const statusCounts = createMemo(() => {
    const counts = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const task of tasks()) {
      counts[task.status] = (counts[task.status] || 0) + 1;
    }

    return counts;
  });

  const totalTasks = createMemo(() => tasks().length);

  const completionPercentage = createMemo(() => {
    const total = totalTasks();
    if (total === 0) return 0;
    return Math.round((statusCounts()["completed"] / total) * 100);
  });

  // ============================================================================
  // Status breakdown text for header
  // ============================================================================

  const statusBreakdown = createMemo(() => {
    const parts: string[] = [];
    const counts = statusCounts();

    if (counts["in_progress"] > 0) {
      parts.push(`${counts["in_progress"]} in progress`);
    }
    if (counts["pending"] > 0) {
      parts.push(`${counts["pending"]} pending`);
    }
    if (counts["completed"] > 0) {
      parts.push(`${counts["completed"]} completed`);
    }
    if (counts["cancelled"] > 0) {
      parts.push(`${counts["cancelled"]} cancelled`);
    }

    return parts.join(", ");
  });

  // ============================================================================
  // Status icon for overall state
  // ============================================================================

  const statusIcon = () => {
    switch (props.block.status) {
      case "pending":
      case "running":
        return <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />;
      case "completed":
        return <CheckCircle2 size={16} class="text-green-600 dark:text-green-400" />;
      case "error":
        return <AlertCircle size={16} class="text-red-600 dark:text-red-400" />;
      default:
        return null;
    }
  };

  // ============================================================================
  // Duration from metadata
  // ============================================================================

  const duration = createMemo(() => {
    const ms = props.block.metadata?.["duration"] as number | undefined;
    return ms ? `${(ms / 1000).toFixed(1)}s` : undefined;
  });

  // ============================================================================
  // Group tasks by status for expanded view
  // ============================================================================

  const groupedTasks = createMemo(() => {
    const groups: Record<string, Task[]> = {
      in_progress: [],
      pending: [],
      completed: [],
      cancelled: [],
    };

    for (const task of tasks()) {
      if (!groups[task.status]) {
        groups[task.status] = [];
      }
      groups[task.status]?.push(task);
    }

    return groups;
  });

  // ============================================================================
  // Task status indicator component
  // ============================================================================

  const TaskStatusIndicator: Component<{ status: Task["status"] }> = (statusProps) => {
    switch (statusProps.status) {
      case "completed":
        return (
          <div class="flex-shrink-0 w-5 h-5 rounded border-2 border-green-600 dark:border-green-400 bg-green-600 dark:bg-green-400 flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="text-white"
              aria-hidden="true"
            >
              <path
                d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        );
      case "in_progress":
        return (
          <div class="flex-shrink-0 w-5 h-5 rounded border-2 border-accent bg-accent flex items-center justify-center">
            <Loader size={14} class="text-white animate-spin" />
          </div>
        );
      case "cancelled":
        return (
          <div class="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-400 dark:border-gray-600 bg-transparent flex items-center justify-center">
            <div class="w-2.5 h-0.5 bg-gray-400 dark:bg-gray-600" />
          </div>
        );
      default:
        return (
          <div class="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-400 dark:border-gray-600 bg-transparent" />
        );
    }
  };

  // ============================================================================
  // Priority badge component
  // ============================================================================

  const PriorityBadge: Component<{ priority: Task["priority"] }> = (priorityProps) => {
    const colors = {
      high: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
      medium: "bg-accent/10 text-accent",
      low: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
    };

    return (
      <span class={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[priorityProps.priority]}`}>
        {priorityProps.priority}
      </span>
    );
  };

  // ============================================================================
  // Task card component
  // ============================================================================

  const TaskCard: Component<{ task: Task }> = (taskProps) => {
    return (
      <div
        class={`flex items-start gap-3 px-3 py-2 rounded bg-surface-overlay border border-border ${taskProps.task.status === "cancelled" ? "opacity-50" : ""}`}
      >
        <TaskStatusIndicator status={taskProps.task.status} />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <PriorityBadge priority={taskProps.task.priority} />
            <span class="text-xs font-mono text-text-muted">#{taskProps.task.id.slice(0, 8)}</span>
          </div>
          <p class={`text-sm text-text-primary ${taskProps.task.status === "cancelled" ? "line-through" : ""}`}>
            {taskProps.task.content}
          </p>
        </div>
      </div>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      class="my-2 overflow-hidden rounded-lg border group/toolcard transition-colors"
      classList={{
        "border-border": isExpanded(),
        "border-transparent hover:border-border": !isExpanded(),
      }}
    >
      {/* Header - one line */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full px-3 py-2 flex items-center gap-2 bg-transparent hover:bg-surface-overlay/50 border-b border-transparent hover:border-border transition-colors"
        aria-expanded={isExpanded()}
      >
        {/* Icon: CheckSquare normally, Chevron on hover */}
        <div class="flex-shrink-0 relative w-4 h-4">
          <div class="absolute inset-0 opacity-100 group-hover/toolcard:opacity-0 transition-opacity flex items-center justify-center">
            <CheckSquare size={16} class="text-accent" />
          </div>
          <div class="absolute inset-0 opacity-0 group-hover/toolcard:opacity-100 transition-opacity flex items-center justify-center">
            {isExpanded() ? (
              <ChevronUp size={16} class="text-text-secondary" />
            ) : (
              <ChevronDown size={16} class="text-text-secondary" />
            )}
          </div>
        </div>

        {/* Type label */}
        <span class="text-sm font-medium text-accent">Tasks</span>

        {/* Task count */}
        <span class="text-sm text-text-primary">
          {totalTasks()} {totalTasks() === 1 ? "task" : "tasks"}
        </span>

        {/* Status breakdown */}
        <Show when={statusBreakdown()}>
          <span class="text-xs text-text-muted">({statusBreakdown()})</span>
        </Show>

        {/* Completion percentage for todoread */}
        <Show when={isTodoRead() && totalTasks() > 0}>
          <span class="text-xs text-text-secondary">{completionPercentage()}% complete</span>
        </Show>

        {/* Duration and status on the right */}
        <div class="ml-auto flex items-center gap-2">
          <Show when={duration()}>
            <span class="text-xs text-text-muted">{duration()}</span>
          </Show>
          <span class="text-sm">{statusIcon()}</span>
        </div>
      </button>

      {/* Expanded content */}
      <Show when={isExpanded()}>
        <div class="px-3 py-3 space-y-3 bg-surface-raised max-h-96 overflow-y-auto">
          {/* Task list grouped by status */}
          <Show when={totalTasks() > 0} fallback={<div class="text-sm text-text-muted text-center py-4">No tasks</div>}>
            {/* In Progress */}
            <Show when={(groupedTasks()["in_progress"]?.length || 0) > 0}>
              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-accent uppercase tracking-wide">
                  In Progress ({groupedTasks()["in_progress"]?.length || 0})
                </h4>
                <For each={groupedTasks()["in_progress"] || []}>{(task) => <TaskCard task={task} />}</For>
              </div>
            </Show>

            {/* Pending */}
            <Show when={(groupedTasks()["pending"]?.length || 0) > 0}>
              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  Pending ({groupedTasks()["pending"]?.length || 0})
                </h4>
                <For each={groupedTasks()["pending"] || []}>{(task) => <TaskCard task={task} />}</For>
              </div>
            </Show>

            {/* Completed */}
            <Show when={(groupedTasks()["completed"]?.length || 0) > 0}>
              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
                  Completed ({groupedTasks()["completed"]?.length || 0})
                </h4>
                <For each={groupedTasks()["completed"] || []}>{(task) => <TaskCard task={task} />}</For>
              </div>
            </Show>

            {/* Cancelled */}
            <Show when={(groupedTasks()["cancelled"]?.length || 0) > 0}>
              <div class="space-y-2">
                <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-600 uppercase tracking-wide">
                  Cancelled ({groupedTasks()["cancelled"]?.length || 0})
                </h4>
                <For each={groupedTasks()["cancelled"] || []}>{(task) => <TaskCard task={task} />}</For>
              </div>
            </Show>
          </Show>

          {/* Error message if present */}
          <Show when={props.block.error}>
            <div class="text-sm text-red-600 dark:text-red-400">
              <span class="font-medium">Error: </span>
              {props.block.error}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default TaskToolCard;
