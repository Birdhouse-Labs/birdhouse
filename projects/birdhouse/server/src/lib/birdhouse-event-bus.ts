// ABOUTME: Workspace-scoped event bus for Birdhouse-owned synthetic events sent to the frontend SSE stream.
// ABOUTME: Keeps Birdhouse events separate from harness runtime events while preserving a single subscribe contract.

import type { BirdhouseEvent } from "../harness";

export interface BirdhouseWorkspaceEvent extends BirdhouseEvent {
  sessionID?: string;
}

export interface BirdhouseEventBus {
  subscribe(listener: (event: BirdhouseWorkspaceEvent) => void | Promise<void>): () => void;
  emit(event: BirdhouseWorkspaceEvent): void;
}

class WorkspaceBirdhouseEventBus implements BirdhouseEventBus {
  private readonly listeners = new Set<(event: BirdhouseWorkspaceEvent) => void | Promise<void>>();

  subscribe(listener: (event: BirdhouseWorkspaceEvent) => void | Promise<void>): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: BirdhouseWorkspaceEvent): void {
    for (const listener of this.listeners) {
      void listener(event);
    }
  }
}

let testBus: WorkspaceBirdhouseEventBus | null = null;
const workspaceBuses = new Map<string, WorkspaceBirdhouseEventBus>();

export function getWorkspaceEventBus(workspaceDirectory: string): BirdhouseEventBus {
  const isTest = process.env.NODE_ENV === "test" || (typeof Bun !== "undefined" && Bun?.main?.includes(".test."));

  if (isTest) {
    if (!testBus) {
      testBus = new WorkspaceBirdhouseEventBus();
    }
    return testBus;
  }

  let bus = workspaceBuses.get(workspaceDirectory);
  if (!bus) {
    bus = new WorkspaceBirdhouseEventBus();
    workspaceBuses.set(workspaceDirectory, bus);
  }

  return bus;
}

export function resetBirdhouseEventBus(): void {
  testBus = null;
  workspaceBuses.clear();
}
